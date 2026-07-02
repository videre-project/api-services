/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  compile,
  ident,
  sql,
  type CompiledSql
} from '@videre/sql-builder';
import { clampAutocompleteLimit } from '../../../queryPolicy.ts';
import { table } from '../../schema.g.ts';

const cards = table('cards', 'c');
const cardFaces = table('card_faces', 'cf');

export type CardNameAutocompleteQueryParams = {
  readonly q?: string | null,
  readonly include_tokens?: boolean | null,
  readonly limit?: number | null,
};

export const buildCardNameAutocompleteQuery = (
  params: CardNameAutocompleteQueryParams
): CompiledSql => {
  const limit = clampAutocompleteLimit(params.limit);

  return compile(sql`
    WITH search AS (
      SELECT lower(btrim(coalesce(${params.q ?? null}::text, ''))) AS value
    ),
    candidate_names AS (
      SELECT
        ${cards.column('name')},
        0 AS source_priority,
        ${cards.column('name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        similarity(${cards.column('name_normalized')}, ${searchValue()}) AS rank
      FROM ${cards.source}
      CROSS JOIN search
      WHERE
        ${searchValue()} <> ''
        AND ${cards.column('name')} IS NOT NULL
        AND (
          coalesce(${params.include_tokens ?? null}::boolean, FALSE)
          OR coalesce(${cards.column('is_token')}, FALSE) = FALSE
        )
        AND (
          ${cards.column('name_normalized')} LIKE ${searchValue()} || '%'
          OR ${cards.column('name_normalized')} % ${searchValue()}
        )

      UNION ALL

      SELECT
        ${cards.column('printed_name')} AS name,
        1 AS source_priority,
        ${cards.column('printed_name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        similarity(${cards.column('printed_name_normalized')}, ${searchValue()}) AS rank
      FROM ${cards.source}
      CROSS JOIN search
      WHERE
        ${searchValue()} <> ''
        AND ${cards.column('printed_name')} IS NOT NULL
        AND (
          coalesce(${params.include_tokens ?? null}::boolean, FALSE)
          OR coalesce(${cards.column('is_token')}, FALSE) = FALSE
        )
        AND (
          ${cards.column('printed_name_normalized')} LIKE ${searchValue()} || '%'
          OR ${cards.column('printed_name_normalized')} % ${searchValue()}
        )

      UNION ALL

      SELECT
        ${cardFaces.column('name')},
        0 AS source_priority,
        ${cardFaces.column('name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        similarity(${cardFaces.column('name_normalized')}, ${searchValue()}) AS rank
      FROM ${cardFaces.source}
      INNER JOIN ${cards.source} ON ${cards.column('id')} = ${cardFaces.column('card_id')}
      CROSS JOIN search
      WHERE
        ${searchValue()} <> ''
        AND ${cardFaces.column('name')} IS NOT NULL
        AND (
          coalesce(${params.include_tokens ?? null}::boolean, FALSE)
          OR coalesce(${cards.column('is_token')}, FALSE) = FALSE
        )
        AND (
          ${cardFaces.column('name_normalized')} LIKE ${searchValue()} || '%'
          OR ${cardFaces.column('name_normalized')} % ${searchValue()}
        )

      UNION ALL

      SELECT
        ${cardFaces.column('printed_name')} AS name,
        1 AS source_priority,
        ${cardFaces.column('printed_name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        similarity(${cardFaces.column('printed_name_normalized')}, ${searchValue()}) AS rank
      FROM ${cardFaces.source}
      INNER JOIN ${cards.source} ON ${cards.column('id')} = ${cardFaces.column('card_id')}
      CROSS JOIN search
      WHERE
        ${searchValue()} <> ''
        AND ${cardFaces.column('printed_name')} IS NOT NULL
        AND (
          coalesce(${params.include_tokens ?? null}::boolean, FALSE)
          OR coalesce(${cards.column('is_token')}, FALSE) = FALSE
        )
        AND (
          ${cardFaces.column('printed_name_normalized')} LIKE ${searchValue()} || '%'
          OR ${cardFaces.column('printed_name_normalized')} % ${searchValue()}
        )
    ),
    ranked_names AS (
      SELECT
        name,
        min(source_priority) AS source_priority,
        bool_or(is_prefix) AS is_prefix,
        max(rank) AS rank
      FROM candidate_names
      GROUP BY name
    )
    SELECT name
    FROM ranked_names
    ORDER BY is_prefix DESC, rank DESC, source_priority, name
    LIMIT ${limit}::int
  `);
};

function searchValue() {
  return ident('search', 'value');
}
