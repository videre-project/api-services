/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  and,
  eq,
  join,
  ident,
  raw,
  select,
  sql,
  type SqlFragment
} from '@videre/sql-builder';
import { table, type TableColumn } from '../../schema.g.ts';

export type CardSearchAttributeColumn = TableColumn<'cards'> & TableColumn<'card_faces'>;

const cards = table('cards', 'c');
const cardFaces = table('card_faces', 'cf');

const cardSearchAttributeColumns = [
  'name_normalized',
  'printed_name_normalized',
  'search_vector',
  'type_line',
  'oracle_text',
  'artist',
  'flavor_text',
  'mana_cost',
  'art_id',
  'power',
  'toughness',
  'loyalty',
  'defense',
  'card_types',
  'supertypes',
  'subtypes',
  'card_type_mask',
] as const satisfies readonly CardSearchAttributeColumn[];

export function attributeSearch(
  cardAlias: string,
  attributeAlias: string,
  predicateFor: (alias: string) => SqlFragment
): ReturnType<typeof select> {
  return select('1')
    .from(cardSearchAttributesRelation(), attributeAlias)
    .where(and([
      eq(ident(attributeAlias, 'card_id'), ident(cardAlias, 'id')),
      predicateFor(attributeAlias),
    ]));
}

export function attributeColumn(alias: string, column: CardSearchAttributeColumn): SqlFragment {
  return ident(alias, column);
}

export function cardSearchAttributesRelation(): SqlFragment {
  return sql`(
    SELECT
      ${cards.column('id')} AS card_id,
      FALSE AS is_face,
      0 AS face_index,
      ${join(searchAttributeSelections(cards.alias), raw(',\n      '))}
    FROM ${cards.source}
    UNION ALL
    SELECT
      ${cardFaces.column('card_id')},
      TRUE AS is_face,
      ${cardFaces.column('face_index')},
      ${join(searchAttributeSelections(cardFaces.alias), raw(',\n      '))}
    FROM ${cardFaces.source}
  )`;
}

function searchAttributeSelections(alias: 'c' | 'cf'): readonly SqlFragment[] {
  return cardSearchAttributeColumns.map((column) => ident(alias, column));
}
