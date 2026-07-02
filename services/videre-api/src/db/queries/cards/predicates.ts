/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  and,
  defineFilters,
  eq,
  exists,
  ident,
  ilikeContains,
  lowerContains,
  notExists,
  optional,
  paramFilter,
  raw,
  select,
  sql,
  type QueryFilter,
  type SqlFragment
} from '@videre/sql-builder';
import {
  attributeColumn,
  attributeSearch,
  cardSearchAttributesRelation
} from './attributes.ts';
import {
  booleanPredicate,
  colorPredicate,
  comparisonPredicate,
  rarityPredicate
} from './filters.ts';
import {
  collectionPredicate,
  hasCollection
} from './collection.ts';
import { isUnset } from './modes.ts';
import { table } from '../../schema.g.ts';
import type { CardOrderMode, CardQueryParams, UniqueMode } from './types.ts';

type CardSearchOptimization = 'simpleCount' | 'uniqueNameFastPath';

type CardFilterDefinition = {
  readonly filter: QueryFilter<CardQueryParams>,
  readonly disables?: readonly CardSearchOptimization[],
};

const genericSearchOnly = ['simpleCount', 'uniqueNameFastPath'] as const;
const simpleCountOnly = ['simpleCount'] as const;

const cards = table('cards', 'c');
const cardLegalities = table('card_legalities', 'cl');
const sets = table('sets', 's');
const multiFaces = table('card_faces', 'cf_multi');

const cardFilterDefinitions = [
  cardFilter(
    paramFilter('id', (value) => eq(cards.column('id'), value)),
    genericSearchOnly
  ),
  cardFilter(
    paramFilter('name', (value) => exists(attributeSearch(cards.alias, 'a', (alias) => {
      return sql`(
        ${lowerContains(attributeColumn(alias, 'name_normalized'), value)}
        OR ${lowerContains(attributeColumn(alias, 'printed_name_normalized'), value)}
      )`;
    }))),
    genericSearchOnly
  ),
  cardFilter(
    paramFilter('exact', (value) => exists(attributeSearch(cards.alias, 'a', (alias) => {
      return sql`(
        ${attributeColumn(alias, 'name_normalized')} = lower(${value})
        OR ${attributeColumn(alias, 'printed_name_normalized')} = lower(${value})
      )`;
    }))),
    genericSearchOnly
  ),
  cardFilter(
    paramFilter('set', (value) => sql`upper(${cards.column('set_code')}) = upper(${value})`),
    genericSearchOnly
  ),
  cardFilter(
    (params) => colorPredicate(
      cards.column('color_mask'),
      params.colors,
      params.colors_operator,
      '>='
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => colorPredicate(
      cards.column('color_identity_mask'),
      params.color_identity,
      params.color_identity_operator,
      '<='
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => comparisonPredicate(
      cards.column('mana_value'),
      params.mana_value,
      params.mana_value_operator,
      'numeric'
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => rarityPredicate(params.rarity, params.rarity_operator),
    genericSearchOnly
  ),
  cardFilter(
    paramFilter('collector_number', (value) => {
      return sql`lower(coalesce(${cards.column('collector_number')}, '')) = lower(${value})`;
    }),
    genericSearchOnly
  ),
  cardFilter(
    paramFilter('frame_style', (value) => eq(cards.column('frame_style'), value)),
    genericSearchOnly
  ),
  cardFilter(
    paramFilter('promo_label', (value) => lowerContains(cards.column('promo_label'), value)),
    genericSearchOnly
  ),
  cardFilter(
    (params) => comparisonPredicate(
      sets.column('release_date'),
      params.released,
      params.released_operator,
      'date'
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => comparisonPredicate(
      sql`EXTRACT(YEAR FROM ${sets.column('release_date')})::int`,
      params.year,
      params.year_operator,
      'int'
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => booleanPredicate(
      sql`(coalesce(NULLIF(btrim(${cards.column('promo_label')}), ''), '') <> '')`,
      params.is_promo
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => booleanPredicate(
      sql`EXISTS (
        SELECT 1
        FROM ${multiFaces.source}
        WHERE ${multiFaces.column('card_id')} = ${cards.column('id')}
          AND ${multiFaces.column('face_index')} > 0
      )`,
      params.is_multiface
    ),
    genericSearchOnly
  ),
  cardFilter(
    (params) => booleanPredicate(splitCardExpression(), params.is_split),
    genericSearchOnly
  ),
  cardFilter(
    (params) => legalityPredicate(params.format, params.legality, cards.alias)
  ),
  cardFilter(
    (params) => attributePredicate(params),
    genericSearchOnly
  ),
  cardFilter(
    (params) => typePredicateForCard(cards.alias, params.type),
    simpleCountOnly
  ),
  cardFilter(
    paramFilter('q', (value) => sql`(
      ${cards.column('search_vector')} @@ websearch_to_tsquery('english'::regconfig, ${value})
      OR ${cards.column('name_normalized')} % lower(${value})
      OR ${cards.column('printed_name_normalized')} % lower(${value})
    )`),
    genericSearchOnly
  ),
  cardFilter(
    (params) => tokenPredicate(cards.alias, params)
  ),
  cardFilter(
    (params) => collectionPredicate(cards.alias, params),
    genericSearchOnly
  ),
] as const satisfies readonly CardFilterDefinition[];

const cardFilters = defineFilters<CardQueryParams>(
  cardFilterDefinitions.map((definition) => definition.filter)
);

export function cardPredicates(params: CardQueryParams): SqlFragment {
  return cardFilters.where(params);
}

export function usesUniqueNameFastPath(
  params: CardQueryParams,
  uniqueMode: UniqueMode,
  orderMode: CardOrderMode
): boolean {
  if (hasCollection(params)) {
    return false;
  }

  if (uniqueMode !== 'cards' || orderMode !== 'name') {
    return false;
  }

  return !hasOptimizationDisablingFilter(params, 'uniqueNameFastPath');
}

export function usesSimpleCountPath(params: CardQueryParams): boolean {
  if (hasCollection(params)) {
    return false;
  }

  return !hasOptimizationDisablingFilter(params, 'simpleCount');
}

export function hasLegalityFilter(params: CardQueryParams): boolean {
  return !isUnset(params.format) || !isUnset(params.legality);
}

function attributePredicate(params: CardQueryParams): SqlFragment | null {
  const predicates = [
    optional(
      params.text,
      ilikeContains(attributeColumn('a', 'oracle_text'), params.text ?? null)
    ),
    optional(
      params.artist,
      lowerContains(attributeColumn('a', 'artist'), params.artist ?? null)
    ),
    optional(
      params.flavor,
      lowerContains(attributeColumn('a', 'flavor_text'), params.flavor ?? null)
    ),
    optional(
      params.mana_cost,
      sql`lower(coalesce(
        ${attributeColumn('a', 'mana_cost')},
        ''
      )) = lower(${params.mana_cost ?? null})`
    ),
    optional(params.art_id, eq(attributeColumn('a', 'art_id'), params.art_id ?? null)),
    comparisonPredicate(
      sql`api_numeric_text_value(${attributeColumn('a', 'power')})`,
      params.power,
      params.power_operator,
      'numeric'
    ),
    comparisonPredicate(
      sql`api_numeric_text_value(${attributeColumn('a', 'toughness')})`,
      params.toughness,
      params.toughness_operator,
      'numeric'
    ),
    comparisonPredicate(
      sql`api_numeric_text_value(${attributeColumn('a', 'loyalty')})`,
      params.loyalty,
      params.loyalty_operator,
      'numeric'
    ),
    comparisonPredicate(
      sql`api_numeric_text_value(${attributeColumn('a', 'defense')})`,
      params.defense,
      params.defense_operator,
      'numeric'
    ),
  ].filter((fragment): fragment is SqlFragment => fragment !== null);

  if (predicates.length === 0) {
    return null;
  }

  return exists(attributeSearch('c', 'a', () => and(predicates)));
}

function cardFilter(
  filter: QueryFilter<CardQueryParams>,
  disables: readonly CardSearchOptimization[] = []
): CardFilterDefinition {
  return {
    filter,
    disables,
  };
}

function hasOptimizationDisablingFilter(
  params: CardQueryParams,
  optimization: CardSearchOptimization
): boolean {
  return cardFilterDefinitions.some((definition) => {
    return definition.disables?.includes(optimization) === true
      && definition.filter(params) !== null;
  });
}

export function typePredicateForCard(
  cardAlias: string,
  typeFilter?: string | null,
  attributeAlias = 'a_type'
): SqlFragment | null {
  const terms = splitTypeTerms(typeFilter);
  if (terms.length === 0) {
    return null;
  }

  const includedTerms = terms.filter((term) => !term.excluded);
  const excludedTerms = terms.filter((term) => term.excluded);
  const excludedAttributeAlias = `${attributeAlias}_excluded`;

  return and([
    includedTerms.length === 0
      ? null
      : exists(select('1')
        .from(cardSearchAttributesRelation(), attributeAlias)
        .where(and([
          eq(ident(attributeAlias, 'card_id'), ident(cardAlias, 'id')),
          and(includedTerms.map((term) => attributeTypePredicate(attributeAlias, term.value))),
        ]))),
    excludedTerms.length === 0
      ? null
      : notExists(select('1')
        .from(cardSearchAttributesRelation(), excludedAttributeAlias)
        .where(and([
          eq(ident(excludedAttributeAlias, 'card_id'), ident(cardAlias, 'id')),
          orTypePredicates(excludedAttributeAlias, excludedTerms.map((term) => term.value)),
        ]))),
  ]);
}

function attributeTypePredicate(alias: string, term: string): SqlFragment {
  if (/\s/.test(term)) {
    return ilikeContains(attributeColumn(alias, 'type_line'), term);
  }

  return sql`(
    ${attributeColumn(alias, 'card_types')} @> ${typeFilterJsonb(term)}
    OR ${attributeColumn(alias, 'supertypes')} @> ${typeFilterJsonb(term)}
    OR ${attributeColumn(alias, 'subtypes')} @> ${typeFilterJsonb(term)}
  )`;
}

function typeFilterJsonb(term: string): SqlFragment {
  return sql`jsonb_build_array(initcap(lower(${term})))`;
}

function orTypePredicates(alias: string, terms: readonly string[]): SqlFragment {
  return terms.length === 0
    ? raw('FALSE')
    : terms.slice(1).reduce(
      (current, term) => sql`(${current}) OR (${attributeTypePredicate(alias, term)})`,
      attributeTypePredicate(alias, terms[0])
    );
}

function splitTypeTerms(typeFilter?: string | null): readonly {
  readonly value: string,
  readonly excluded: boolean
}[] {
  return String(typeFilter ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => term.startsWith('!')
      ? { value: term.slice(1).trim(), excluded: true }
      : { value: term, excluded: false }
    )
    .filter((term) => term.value.length > 0);
}

export function legalityPredicate(
  format?: string | null,
  legality?: string | null,
  cardAlias = 'c'
): SqlFragment | null {
  if ((format === undefined || format === null || format === '')
    && (legality === undefined || legality === null || legality === '')) {
    return null;
  }

  return exists(select('1')
    .from(cardLegalities.source)
    .where(and([
      eq(cardLegalities.column('oracle_id'), ident(cardAlias, 'oracle_id')),
      optional(format, sql`${cardLegalities.column('format_code')} = lower(${format ?? null})`),
      optional(legality, sql`${cardLegalities.column('status')} = lower(${legality ?? null})`),
    ])));
}

export function tokenPredicate(cardAlias: string, params: CardQueryParams): SqlFragment | null {
  if (params.is_token !== undefined && params.is_token !== null) {
    return sql`coalesce(${ident(cardAlias, 'is_token')}, FALSE) = ${params.is_token}`;
  }

  if (params.include_tokens === true) {
    return null;
  }

  return sql`coalesce(${ident(cardAlias, 'is_token')}, FALSE) = FALSE`;
}

function splitCardExpression(): SqlFragment {
  return sql`(
    coalesce(jsonb_array_length(${cards.column('split_card_ids')}), 0) > 0
    OR ${cards.column('split_parent_card_id')} IS NOT NULL
    OR ${cards.column('split_other_card_id')} IS NOT NULL
  )`;
}
