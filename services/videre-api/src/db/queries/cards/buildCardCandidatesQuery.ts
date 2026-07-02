/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  and,
  eq,
  notExists,
  raw,
  select,
  sql,
  type SqlFragment
} from '@videre/sql-builder';
import { table } from '../../schema.g.ts';
import {
  collectionCandidateOrder,
  collectionCtes,
  collectionSelectExpression,
  collectionUniqueRepresentativeOrder
} from './collection.ts';
import { candidateOrder } from './modes.ts';
import {
  cardPredicates,
  legalityPredicate,
  tokenPredicate,
  typePredicateForCard,
  usesUniqueNameFastPath
} from './predicates.ts';
import type {
  CardOrderDirection,
  CardOrderMode,
  CardQueryParams,
  UniqueMode
} from './types.ts';

type CardCandidateQueryOptions = {
  readonly params: CardQueryParams,
  readonly uniqueMode: UniqueMode,
  readonly orderMode: CardOrderMode,
  readonly orderDirection: CardOrderDirection,
  readonly limit: number,
  readonly offset: number,
};

const cards = table('cards', 'c');
const sets = table('sets', 's');
const otherCards = table('cards', 'c2');
const otherSets = table('sets', 's2');

export function buildCardCandidatesQuery(options: CardCandidateQueryOptions): SqlFragment {
  return usesUniqueNameFastPath(options.params, options.uniqueMode, options.orderMode)
    ? fastUniqueNameCandidateQuery(options)
    : genericCandidateQuery(options);
}

function genericCandidateQuery(options: CardCandidateQueryOptions): SqlFragment {
  const {
    params,
    uniqueMode,
    orderMode,
    orderDirection,
    limit,
    offset,
  } = options;
  const uniqueCardOrder = uniqueMode === 'cards'
    ? sql`
      ORDER BY
        ${cards.column('oracle_id')},
        ${collectionUniqueRepresentativeOrder(params)}
        name_match_priority,
        ${sets.column('release_date')} DESC NULLS LAST,
        ${cards.column('id')} DESC
    `
    : raw('');
  const order = collectionCandidateOrder(
    params,
    candidateOrder(orderMode, orderDirection)
  );

  return sql`
    WITH
    ${collectionCtes(params)}
    candidate_cards AS MATERIALIZED (
      SELECT *
      FROM (
        SELECT ${uniqueMode === 'cards' ? sql`DISTINCT ON (${cards.column('oracle_id')})` : raw('')}
          ${cards.column('id')},
          ${cards.column('oracle_id')},
          ${collectionSelectExpression(params)} AS in_collection,
          CASE
            WHEN ${params.q ?? null}::text IS NULL THEN 0::real
            ELSE greatest(
              similarity(${cards.column('name_normalized')}, lower(${params.q ?? null}::text)),
              similarity(${cards.column('printed_name_normalized')}, lower(${params.q ?? null}::text))
            )
          END AS search_rank,
          ${nameMatchPriority(params)} AS name_match_priority,
          ${cards.column('name')},
          ${cards.column('set_code')},
          ${cards.column('collector_number')},
          ${cards.column('mana_value')},
          ${sets.column('release_date')}
        FROM ${cards.source}
        LEFT JOIN ${sets.source} ON ${sets.column('code')} = ${cards.column('set_code')}
        WHERE ${cardPredicates(params)}
        ${uniqueCardOrder}
      ) filtered_cards
      ORDER BY ${order}
      LIMIT ${limit}::int
      OFFSET ${offset}::int
    )
  `;
}

function fastUniqueNameCandidateQuery(options: CardCandidateQueryOptions): SqlFragment {
  const {
    params,
    orderMode,
    orderDirection,
    limit,
    offset,
  } = options;
  const order = candidateOrder(orderMode, orderDirection);

  return sql`
    WITH candidate_cards AS MATERIALIZED (
      SELECT
        ${cards.column('id')},
        ${cards.column('oracle_id')},
        ${collectionSelectExpression(params)} AS in_collection,
        0::real AS search_rank,
        0::int AS name_match_priority,
        ${cards.column('name')},
        ${cards.column('set_code')},
        ${cards.column('collector_number')},
        ${cards.column('mana_value')},
        ${sets.column('release_date')}
      FROM ${cards.source}
      LEFT JOIN ${sets.source} ON ${sets.column('code')} = ${cards.column('set_code')}
      WHERE ${and([
        tokenPredicate(cards.alias, params),
        typePredicateForCard(cards.alias, params.type, 'a_type'),
        legalityPredicate(params.format, params.legality, cards.alias),
        notExists(select('1')
          .from(otherCards.source)
          .join(sql`
            LEFT JOIN ${otherSets.source}
              ON ${otherSets.column('code')} = ${otherCards.column('set_code')}
          `)
          .where(and([
            eq(otherCards.column('oracle_id'), cards.column('oracle_id')),
            tokenPredicate(otherCards.alias, params),
            typePredicateForCard(otherCards.alias, params.type, 'a2_type'),
            legalityPredicate(params.format, params.legality, otherCards.alias),
            sql`(
              coalesce(${otherSets.column('release_date')}, DATE '-infinity')
                > coalesce(${sets.column('release_date')}, DATE '-infinity')
              OR (
                coalesce(${otherSets.column('release_date')}, DATE '-infinity')
                  = coalesce(${sets.column('release_date')}, DATE '-infinity')
                AND ${otherCards.column('id')} > ${cards.column('id')}
              )
            )`,
          ]))),
      ])}
      ORDER BY ${order}
      LIMIT ${limit}::int
      OFFSET ${offset}::int
    )
  `;
}

function nameMatchPriority(params: CardQueryParams): SqlFragment {
  if (typeof params.exact === 'string' && params.exact.trim() !== '') {
    return exactNameMatchPriority(params.exact);
  }

  if (typeof params.name === 'string' && params.name.trim() !== '') {
    return partialNameMatchPriority(params.name);
  }

  if (typeof params.q === 'string' && params.q.trim() !== '') {
    return fuzzyNameMatchPriority(params.q);
  }

  return raw('0::int');
}

function exactNameMatchPriority(value: string): SqlFragment {
  return sql`CASE
    WHEN ${cards.column('name_normalized')} = lower(${value})
      AND ${cards.column('printed_name')} IS NULL THEN 0
    WHEN ${cards.column('name_normalized')} = lower(${value}) THEN 1
    WHEN ${cards.column('printed_name_normalized')} = lower(${value}) THEN 2
    ELSE 3
  END`;
}

function partialNameMatchPriority(value: string): SqlFragment {
  return sql`CASE
    WHEN ${cards.column('name_normalized')} LIKE '%' || lower(${value}) || '%'
      AND ${cards.column('printed_name')} IS NULL THEN 0
    WHEN ${cards.column('name_normalized')} LIKE '%' || lower(${value}) || '%' THEN 1
    WHEN ${cards.column('printed_name_normalized')} LIKE '%' || lower(${value}) || '%' THEN 2
    ELSE 3
  END`;
}

function fuzzyNameMatchPriority(value: string): SqlFragment {
  return sql`CASE
    WHEN ${cards.column('name_normalized')} = lower(${value})
      AND ${cards.column('printed_name')} IS NULL THEN 0
    WHEN ${cards.column('name_normalized')} = lower(${value}) THEN 1
    WHEN ${cards.column('printed_name_normalized')} = lower(${value}) THEN 2
    WHEN ${cards.column('name_normalized')} LIKE lower(${value}) || '%'
      AND ${cards.column('printed_name')} IS NULL THEN 3
    WHEN ${cards.column('name_normalized')} LIKE lower(${value}) || '%' THEN 4
    WHEN ${cards.column('printed_name_normalized')} LIKE lower(${value}) || '%' THEN 5
    WHEN ${cards.column('name_normalized')} % lower(${value})
      AND ${cards.column('printed_name')} IS NULL THEN 6
    WHEN ${cards.column('name_normalized')} % lower(${value}) THEN 7
    WHEN ${cards.column('printed_name_normalized')} % lower(${value}) THEN 8
    ELSE 9
  END`;
}
