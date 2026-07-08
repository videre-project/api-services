/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  and,
  compile,
  defineFilters,
  eq,
  ident,
  lowerContains,
  orderBy,
  paramFilter,
  raw,
  sql,
  type CompiledSql,
  type SqlFragment
} from '@videre/sql-builder';
import { clampListLimit, clampOffset } from '../../../queryPolicy.ts';
import { normalizeSortDirection } from '../../searchOptions.ts';
import { table } from '../../schema.g.ts';

export type ProductQueryParams = {
  readonly q?: string | null,
  readonly id?: number | null,
  readonly name?: string | null,
  readonly exact?: string | null,
  readonly set?: string | null,
  readonly type?: string | null,
  readonly is_tradable?: boolean | null,
  readonly order?: string | null,
  readonly dir?: string | null,
  readonly limit?: number | null,
  readonly offset?: number | null,
  readonly collection?: ProductCollectionFilter | null,
};

export type ProductCollectionFilter = {
  readonly ids: readonly number[],
  readonly mode: 'only' | 'exclude' | 'rank',
  readonly match?: 'prints' | 'oracle',
};

const products = table('products', 'p');
const sets = table('sets', 's');
const collectionProductsAlias = 'collection_products';

const productFilters = defineFilters<ProductQueryParams>([
  paramFilter('id', (value) => eq(products.column('id'), value)),
  paramFilter('name', (value) => lowerContains(products.column('name_normalized'), value)),
  paramFilter('exact', (value) => sql`${products.column('name_normalized')} = lower(${value})`),
  paramFilter('set', (value) => sql`${products.column('set_code')} = upper(${value})`),
  paramFilter('type', (value) => sql`${products.column('object_type')} = upper(${value})`),
  paramFilter('is_tradable', (value) => eq(products.column('is_tradable'), value)),
  paramFilter('q', (value) => sql`(
    ${products.column('search_vector')} @@ websearch_to_tsquery('english'::regconfig, ${value})
    OR ${products.column('name_normalized')} % lower(${value})
  )`),
]);

export const buildProductsQuery = (params: ProductQueryParams): CompiledSql => {
  const orderMode = normalizeProductOrderMode(params.order, params.q);
  const orderDirection = normalizeSortDirection(params.dir);
  const limit = clampListLimit(params.limit);
  const offset = clampOffset(params.offset);

  return compile(sql`
    ${productCollectionCtes(params)}
    SELECT
      ${products.column('id')},
      ${products.column('set_code')},
      ${sets.column('name')} AS set_name,
      ${products.column('name')},
      ${products.column('description')},
      ${products.column('object_type')},
      ${products.column('texture_number')},
      ${products.column('is_tradable')},
      cdn_product_image_base_url() || ${products.column('id')} || '-300px.png' AS image_url
      ${productCollectionSelectField(params)}
    FROM ${products.source}
    LEFT JOIN ${sets.source} ON ${sets.column('code')} = ${products.column('set_code')}
    WHERE ${and([
      productPredicates(params),
      productCollectionPredicate(params),
    ])}
    ORDER BY ${productCollectionOrder(
      params,
      productOrder(orderMode, orderDirection, params.q)
    )}
    LIMIT ${limit}::int
    OFFSET ${offset}::int
  `);
};

export const buildProductCountQuery = (params: ProductQueryParams): CompiledSql =>
  compile(sql`
    ${productCollectionCtes(params)}
    SELECT count(*)::bigint AS count
    FROM ${products.source}
    WHERE ${and([
      productPredicates(params),
      productCollectionPredicate(params),
    ])}
  `);

function productPredicates(params: ProductQueryParams): SqlFragment {
  return productFilters.where(params);
}

function hasProductCollection(params: ProductQueryParams): boolean {
  return params.collection !== undefined && params.collection !== null;
}

function productCollectionCtes(params: ProductQueryParams): SqlFragment {
  if (!hasProductCollection(params)) {
    return raw('');
  }

  const collection = params.collection as ProductCollectionFilter;
  return sql`
    WITH ${ident(collectionProductsAlias)} AS MATERIALIZED (
      SELECT DISTINCT value::int AS product_id
      FROM jsonb_array_elements_text((${JSON.stringify(collection.ids)})::text::jsonb) ids(value)
    )
  `;
}

function productCollectionPredicate(params: ProductQueryParams): SqlFragment | null {
  if (!hasProductCollection(params) || params.collection?.mode === 'rank') {
    return null;
  }

  const matched = productCollectionMatchExpression(products.alias);
  return params.collection?.mode === 'exclude'
    ? sql`NOT ${matched}`
    : matched;
}

function productCollectionSelectField(params: ProductQueryParams): SqlFragment {
  return hasProductCollection(params)
    ? sql`, ${productCollectionMatchExpression(products.alias)} AS in_collection`
    : raw('');
}

function productCollectionOrder(params: ProductQueryParams, order: SqlFragment): SqlFragment {
  return params.collection?.mode === 'rank'
    ? sql`in_collection DESC, ${order}`
    : order;
}

function productCollectionMatchExpression(productAlias: string): SqlFragment {
  return sql`EXISTS (
    SELECT 1
    FROM ${ident(collectionProductsAlias)} collection_products
    WHERE collection_products.product_id = ${ident(productAlias, 'id')}
  )`;
}

function productOrder(
  orderMode: ReturnType<typeof normalizeProductOrderMode>,
  direction: ReturnType<typeof normalizeSortDirection>,
  search?: string | null
): SqlFragment {
  switch (orderMode) {
    case 'rank':
      return orderBy([
        sql`similarity(
          ${products.column('name_normalized')},
          lower(${search ?? null})
        ) DESC`,
        sql`${products.column('name')} NULLS LAST`,
        sql`${products.column('set_code')} NULLS LAST`,
        sql`${products.column('object_type')} NULLS LAST`,
        products.column('id'),
      ]);
    case 'set':
      return orderBy([
        sql`${products.column('set_code')} ${raw(direction)} NULLS LAST`,
        sql`${products.column('name')} NULLS LAST`,
        sql`${products.column('object_type')} NULLS LAST`,
        products.column('id'),
      ]);
    case 'type':
      return orderBy([
        sql`${products.column('object_type')} ${raw(direction)} NULLS LAST`,
        sql`${products.column('name')} NULLS LAST`,
        sql`${products.column('set_code')} NULLS LAST`,
        products.column('id'),
      ]);
    default:
      return orderBy([
        sql`${products.column('name')} ${raw(direction)} NULLS LAST`,
        sql`${products.column('set_code')} NULLS LAST`,
        sql`${products.column('object_type')} NULLS LAST`,
        products.column('id'),
      ]);
  }
}

function normalizeProductOrderMode(
  value?: string | null,
  search?: string | null
): 'rank' | 'name' | 'set' | 'type' {
  switch (String(value ?? (search ? 'rank' : 'name')).toLowerCase()) {
    case 'rank':
    case 'relevance':
      return 'rank';
    case 'set':
      return 'set';
    case 'type':
    case 'object_type':
      return 'type';
    default:
      return search ? 'rank' : 'name';
  }
}
