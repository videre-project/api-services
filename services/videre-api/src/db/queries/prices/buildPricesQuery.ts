/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  and,
  compile,
  ident,
  sql,
  type CompiledSql,
  type SqlFragment
} from '@videre/sql-builder';
import { clampListLimit, clampOffset } from '../../../queryPolicy.ts';
import { table } from '../../schema.g.ts';


export type PriceHistoryParams = {
  readonly id: number,
  readonly source?: string | null,
  readonly from?: string | Date | null,
  readonly to?: string | Date | null,
  readonly limit?: number | null,
  readonly offset?: number | null,
};

export type PriceBatchParams = {
  readonly ids: readonly number[],
  readonly source?: string | null,
  readonly date?: 'latest' | string | Date | null,
};

const defaultSource = 'goatbots';
const priceHistory = table('catalog_price_history', 'ph');
const priceDefinitions = table('catalog_price_definitions', 'pd');
const catalogItems = table('catalog_items', 'ci');
const requestedIdsAlias = 'requested_ids';

export const buildLatestPriceQuery = (params: PriceHistoryParams): CompiledSql =>
  compile(sql`
    SELECT ${priceSelectList()}
    FROM ${priceHistory.source}
    ${priceJoins()}
    WHERE ${and([
      sql`${priceHistory.column('catalog_id')} = ${params.id}`,
      sourcePredicate(params.source),
    ])}
    ORDER BY ${priceHistory.column('price_date')} DESC, ${priceHistory.column('source')}
    LIMIT 1
  `);

export const buildPriceHistoryQuery = (params: PriceHistoryParams): CompiledSql => {
  const limit = clampListLimit(params.limit);
  const offset = clampOffset(params.offset);

  return compile(sql`
    SELECT ${priceSelectList()}
    FROM ${priceHistory.source}
    ${priceJoins()}
    WHERE ${and([
      sql`${priceHistory.column('catalog_id')} = ${params.id}`,
      sourcePredicate(params.source),
      dateLowerBoundPredicate(params.from),
      dateUpperBoundPredicate(params.to),
    ])}
    ORDER BY ${priceHistory.column('price_date')} ASC, ${priceHistory.column('source')}
    LIMIT ${limit}::int
    OFFSET ${offset}::int
  `);
};

export const buildPriceHistoryCountQuery = (params: PriceHistoryParams): CompiledSql =>
  compile(sql`
    SELECT count(*)::bigint AS count
    FROM ${priceHistory.source}
    WHERE ${and([
      sql`${priceHistory.column('catalog_id')} = ${params.id}`,
      sourcePredicate(params.source),
      dateLowerBoundPredicate(params.from),
      dateUpperBoundPredicate(params.to),
    ])}
  `);

export const buildBatchPricesQuery = (params: PriceBatchParams): CompiledSql => {
  const date = params.date ?? 'latest';
  return compile(sql`
    WITH ${ident(requestedIdsAlias)} AS MATERIALIZED (
      SELECT DISTINCT value::int AS catalog_id
      FROM jsonb_array_elements_text((${JSON.stringify(params.ids)})::text::jsonb) ids(value)
    ),
    selected_prices AS MATERIALIZED (
      ${date === 'latest'
        ? latestBatchSubquery(params.source)
        : datedBatchSubquery(params.source, date)}
    )
    SELECT ${priceSelectList('sp')}
    FROM selected_prices sp
    LEFT JOIN ${priceDefinitions.source}
      ON ${priceDefinitions.column('source')} = sp.source
     AND ${priceDefinitions.column('catalog_id')} = sp.catalog_id
    LEFT JOIN ${catalogItems.source}
      ON ${catalogItems.column('catalog_id')} = sp.catalog_id
    ORDER BY sp.catalog_id
  `);
};

function latestBatchSubquery(source?: string | null): SqlFragment {
  return sql`
    SELECT
      latest_price.source,
      latest_price.price_date,
      latest_price.catalog_id,
      latest_price.sell_price
    FROM ${ident(requestedIdsAlias)}
    CROSS JOIN LATERAL (
      SELECT
        ${priceHistory.column('source')},
        ${priceHistory.column('price_date')},
        ${priceHistory.column('catalog_id')},
        ${priceHistory.column('sell_price')}
      FROM ${priceHistory.source}
      WHERE ${and([
        sourcePredicate(source),
        sql`${priceHistory.column('catalog_id')} = ${ident(requestedIdsAlias, 'catalog_id')}`,
      ])}
      ORDER BY ${priceHistory.column('price_date')} DESC, ${priceHistory.column('source')}
      LIMIT 1
    ) latest_price
  `;
}

function datedBatchSubquery(source: string | null | undefined, date: string | Date): SqlFragment {
  return sql`
    SELECT
      ${priceHistory.column('source')},
      ${priceHistory.column('price_date')},
      ${priceHistory.column('catalog_id')},
      ${priceHistory.column('sell_price')}
    FROM ${priceHistory.source}
    INNER JOIN ${ident(requestedIdsAlias)} requested_ids
      ON requested_ids.catalog_id = ${priceHistory.column('catalog_id')}
    WHERE ${and([
      sourcePredicate(source),
      sql`${priceHistory.column('price_date')} = ${date}::date`,
    ])}
  `;
}

function priceSelectList(priceAlias: string = priceHistory.alias): SqlFragment {
  return sql`
    ${ident(priceAlias, 'catalog_id')} AS id,
    ${ident(priceAlias, 'price_date')},
    ${ident(priceAlias, 'sell_price')},
    ${ident(priceAlias, 'source')},
    ${catalogItems.column('kind')} AS kind,
    ${priceDefinitions.column('source_name')} AS name,
    ${priceDefinitions.column('source_cardset')} AS cardset,
    ${priceDefinitions.column('source_rarity')} AS rarity,
    ${priceDefinitions.column('source_version')} AS version,
    ${priceDefinitions.column('source_foil')} AS foil
  `;
}

function priceJoins(): SqlFragment {
  return sql`
    LEFT JOIN ${priceDefinitions.source}
      ON ${priceDefinitions.column('source')} = ${priceHistory.column('source')}
     AND ${priceDefinitions.column('catalog_id')} = ${priceHistory.column('catalog_id')}
    LEFT JOIN ${catalogItems.source}
      ON ${catalogItems.column('catalog_id')} = ${priceHistory.column('catalog_id')}
  `;
}

function sourcePredicate(source?: string | null): SqlFragment {
  return sql`${priceHistory.column('source')} = ${source ?? defaultSource}`;
}

function dateLowerBoundPredicate(value?: string | Date | null): SqlFragment | null {
  return value === undefined || value === null
    ? null
    : sql`${priceHistory.column('price_date')} >= ${value}::date`;
}

function dateUpperBoundPredicate(value?: string | Date | null): SqlFragment | null {
  return value === undefined || value === null
    ? null
    : sql`${priceHistory.column('price_date')} <= ${value}::date`;
}
