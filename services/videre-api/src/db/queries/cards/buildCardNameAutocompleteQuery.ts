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
    WITH raw_search AS (
      SELECT lower(btrim(coalesce(${params.q ?? null}::text, ''))) AS value
    ),
    search AS (
      SELECT
        value,
        split_part(value, ' ', 1) AS first_term,
        terms,
        cardinality(terms) AS term_count,
        CASE
          WHEN cardinality(terms) > 1 THEN
            '(^|[^[:alnum:]])'
            || array_to_string(terms, '[[:alnum:]]*.*(^|[^[:alnum:]])')
            || '[[:alnum:]]*'
          ELSE NULL
        END AS ordered_terms_pattern
      FROM (
        SELECT
          value,
          array_remove(
            regexp_split_to_array(
              btrim(regexp_replace(value, '[^[:alnum:]]+', ' ', 'g')),
              ' '
            ),
            ''
          ) AS terms
        FROM raw_search
      ) tokenized_search
    ),
    candidate_names AS (
      SELECT
        ${cards.column('name')},
        ${cards.column('name_normalized')} AS normalized_name,
        0 AS source_priority,
        ${cards.column('name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        ${cards.column('name_normalized')} LIKE ${firstSearchTerm()} || '%' AS starts_with_first_term,
        word_similarity(${searchValue()}, ${cards.column('name_normalized')}) AS ordered_rank,
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
        ${cards.column('printed_name_normalized')} AS normalized_name,
        1 AS source_priority,
        ${cards.column('printed_name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        ${cards.column('printed_name_normalized')} LIKE ${firstSearchTerm()} || '%' AS starts_with_first_term,
        word_similarity(${searchValue()}, ${cards.column('printed_name_normalized')}) AS ordered_rank,
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
        ${cardFaces.column('name_normalized')} AS normalized_name,
        0 AS source_priority,
        ${cardFaces.column('name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        ${cardFaces.column('name_normalized')} LIKE ${firstSearchTerm()} || '%' AS starts_with_first_term,
        word_similarity(${searchValue()}, ${cardFaces.column('name_normalized')}) AS ordered_rank,
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
        ${cardFaces.column('printed_name_normalized')} AS normalized_name,
        1 AS source_priority,
        ${cardFaces.column('printed_name_normalized')} LIKE ${searchValue()} || '%' AS is_prefix,
        ${cardFaces.column('printed_name_normalized')} LIKE ${firstSearchTerm()} || '%' AS starts_with_first_term,
        word_similarity(${searchValue()}, ${cardFaces.column('printed_name_normalized')}) AS ordered_rank,
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
        min(normalized_name) AS normalized_name,
        min(source_priority) AS source_priority,
        bool_or(is_prefix) AS is_prefix,
        bool_or(starts_with_first_term) AS starts_with_first_term,
        max(ordered_rank) AS ordered_rank,
        max(rank) AS rank
      FROM candidate_names
      GROUP BY name
    ),
    scored_names AS (
      SELECT
        ranked_names.*,
        CASE
          WHEN ${searchTermCount()} > 1 THEN
            ranked_names.normalized_name ~ ${orderedTermsPattern()}
          ELSE FALSE
        END AS ordered_terms_match,
        CASE
          WHEN ${searchTermCount()} > 2 THEN
            ranked_names.normalized_name ~ ${orderedTermsPattern()}
          ELSE FALSE
        END AS ordered_terms_strong_match,
        CASE
          WHEN ${searchTermCount()} > 1 THEN (
            SELECT count(*)::int
            FROM unnest(${searchTerms()}) AS term
            WHERE ranked_names.normalized_name ~ (
              '(^|[^[:alnum:]])' || term || '[[:alnum:]]*'
            )
          )
          ELSE 0
        END AS token_prefix_matches
      FROM ranked_names
      CROSS JOIN search
    )
    SELECT name
    FROM scored_names
    ORDER BY
      is_prefix DESC,
      ordered_terms_strong_match DESC,
      starts_with_first_term DESC,
      ordered_terms_match DESC,
      token_prefix_matches DESC,
      ordered_rank DESC,
      rank DESC,
      source_priority,
      name
    LIMIT ${limit}::int
  `);
};

function searchValue() {
  return ident('search', 'value');
}

function firstSearchTerm() {
  return ident('search', 'first_term');
}

function searchTerms() {
  return ident('search', 'terms');
}

function searchTermCount() {
  return ident('search', 'term_count');
}

function orderedTermsPattern() {
  return ident('search', 'ordered_terms_pattern');
}
