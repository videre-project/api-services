/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  compile,
  ident,
  selectFields,
  sql,
  tableColumnFields,
  type CompiledSql,
  type SqlFragment
} from '@videre/sql-builder';
import { clampListLimit, clampOffset } from '../../../queryPolicy.ts';
import { table } from '../../schema.g.ts';
import { buildCardCandidatesQuery } from './buildCardCandidatesQuery.ts';
import {
  collectionCardOrder,
  hasCollection
} from './collection.ts';
import {
  cardOrder,
  normalizeOrderDirection,
  normalizeOrderMode,
  normalizeUniqueMode
} from './modes.ts';
import { CARD_COLUMN_FIELDS } from './types.ts';
import type { ICard, CardQueryParams } from './types.ts';

export type { CardQueryParams } from './types.ts';

const cards = table('cards', 'c');
const cardLegalities = table('card_legalities', 'cl');
const sets = table('sets', 's');
const multiFaces = table('card_faces', 'cf_multi');

export const buildCardsQuery = (params: CardQueryParams): CompiledSql => {
  const uniqueMode = normalizeUniqueMode(params.unique);
  const orderMode = normalizeOrderMode(params.order, params.q);
  const orderDirection = normalizeOrderDirection(orderMode, params.dir);
  const limit = clampListLimit(params.limit);
  const offset = clampOffset(params.offset);
  const candidateQuery = buildCardCandidatesQuery({
    params,
    uniqueMode,
    orderMode,
    orderDirection,
    limit,
    offset,
  });

  const query = sql`
    ${candidateQuery}
    SELECT ${selectFields(cardSelectFields(params))}
    FROM candidate_cards cc
    INNER JOIN ${cards.source} ON ${cards.column('id')} = ${candidateColumn('id')}
    LEFT JOIN ${sets.source} ON ${sets.column('code')} = ${cards.column('set_code')}
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(
        ${cardLegalities.column('format_code')},
        ${cardLegalities.column('status')}
        ORDER BY ${cardLegalities.column('format_code')}
      ) AS legalities
      FROM ${cardLegalities.source}
      WHERE ${cardLegalities.column('oracle_id')} = ${cards.column('oracle_id')}
    ) l ON TRUE
    ORDER BY ${collectionCardOrder(params, cardOrder(orderMode, orderDirection))}
  `;

  return compile(query);
};

const baseCardSelectFields = {
  ...tableColumnFields(cards, CARD_COLUMN_FIELDS),
  canonical_name: cards.column('name'),
  display_name: sql`coalesce(${cards.column('printed_name')}, ${cards.column('name')})`,
  set_name: sets.column('name'),
  is_promo: sql`(coalesce(NULLIF(btrim(${cards.column('promo_label')}), ''), '') <> '')`,
  is_multiface: sql`EXISTS (
    SELECT 1
    FROM ${multiFaces.source}
    WHERE ${multiFaces.column('card_id')} = ${cards.column('id')}
      AND ${multiFaces.column('face_index')} > 0
  )`,
  is_split: sql`(
    coalesce(jsonb_array_length(${cards.column('split_card_ids')}), 0) > 0
    OR ${cards.column('split_parent_card_id')} IS NOT NULL
    OR ${cards.column('split_other_card_id')} IS NOT NULL
  )`,
  set_release_date: sets.column('release_date'),
  set_type: sets.column('set_type'),
  legalities: sql`coalesce(${ident('l', 'legalities')}, '{}'::jsonb)`,
  image_url: sql`cdn_card_image_base_url() || ${cards.column('id')} || '-300px.png'`,
} satisfies Record<keyof ICard, SqlFragment>;

function cardSelectFields(params: CardQueryParams): Record<string, SqlFragment> {
  return hasCollection(params)
    ? {
      ...baseCardSelectFields,
      in_collection: candidateColumn('in_collection'),
    }
    : baseCardSelectFields;
}

function candidateColumn(column: 'id' | 'in_collection'): SqlFragment {
  return ident('cc', column);
}
