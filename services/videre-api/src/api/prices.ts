/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { Router } from 'itty-router';
import type { IRequest } from 'itty-router';

import { withPostgres } from '@/db/postgres';
import {
  getBatchPrices,
  getLatestPrice,
  getPriceHistory,
  getPriceHistoryCount,
  type ICatalogPrice,
  type PriceBatchParams,
  type PriceHistoryParams
} from '@/db/queries';
import {
  NumberValidator,
  StringValidator
} from '@/db/validators';
import { asJSON, buildListResponse, Error, getListPagination } from '@/responses';
import { Optional, Required, withValidation } from '@/validation';


const MAX_BATCH_PRICE_IDS = 10_000;
const GOATBOTS_SOURCE_URL = 'https://www.goatbots.com/';

type PriceResponseRow = ReturnType<typeof normalizePrice>;

export const detailArgs = {
  id: Required(NumberValidator),
};

export const historyArgs = {
  id:     Required(NumberValidator),
  from:   Optional(StringValidator),
  to:     Optional(StringValidator),
  limit:  Optional(NumberValidator),
  offset: Optional(NumberValidator),
};

export default Router({ base: '/prices' })
  .get('/:id/history',
    withValidation(historyArgs),
    withPostgres,
    async (req, { sql, params }) => {
      const from = normalizeDateParam(params.from, 'from');
      if (from instanceof Response) return from;
      const to = normalizeDateParam(params.to, 'to');
      if (to instanceof Response) return to;

      const queryParams: PriceHistoryParams = {
        id: params.id,
        limit: params.limit,
        offset: params.offset,
        from,
        to,
      };
      const responseParams = {
        ...params,
        from,
        to,
      };
      const start = performance.now();
      const data = normalizePrices(await getPriceHistory(sql, queryParams));
      const [{ count }] = await getPriceHistoryCount(sql, queryParams);
      const total = Number(count);

      if (!data.length)
        return Error(400, 'No results found.', buildListResponse(responseParams, data, total, start));

      return buildListResponse(
        responseParams,
        data,
        total,
        start,
        getListPagination(responseParams, data.length, total)
      );
    }
  )
  .post('/search',
    async (req, { params }) => {
      const body = await readPriceSearchBody(req);
      if (body instanceof Response) {
        body.headers.set('Cache-Control', 'private, no-store');
        return body;
      }

      params.ids = body.ids;
      params.date = body.date;
    },
    withPostgres,
    async (req, { sql, params }) => {
      const queryParams: PriceBatchParams = {
        ids: params.ids as readonly number[],
        date: params.date as 'latest' | string,
      };
      const start = performance.now();
      const data = normalizePrices(await getBatchPrices(sql, queryParams));
      const returnedIds = new Set(data.map((row) => row.id));
      const missingIds = queryParams.ids.filter((id) => !returnedIds.has(id));
      const response = buildListResponse(
        { ...params, date: queryParams.date, ids: { size: queryParams.ids.length } },
        data,
        data.length,
        start
      );
      (response.meta as Record<string, unknown>).missing_ids = missingIds;

      return asJSON(response, { headers: { 'Cache-Control': 'private, no-store' } });
    }
  )
  .get('/:id',
    withValidation(detailArgs),
    withPostgres,
    async (req, { sql, params }) => {
      const queryParams: PriceHistoryParams = {
        id: params.id,
      };
      const start = performance.now();
      const data = normalizePrices(await getLatestPrice(sql, queryParams));

      if (!data.length)
        return Error(400, 'No results found.', buildListResponse(params, data, 0, start));

      return buildListResponse(params, data, data.length, start);
    }
  );

function normalizePrices(rows: readonly ICatalogPrice[]): PriceResponseRow[] {
  return rows.map(normalizePrice);
}

function normalizePrice(row: ICatalogPrice) {
  return {
    ...row,
    price_date: normalizeOutputDate(row.price_date),
    sell_price: Number(row.sell_price),
    url: row.source === 'goatbots' ? GOATBOTS_SOURCE_URL : null,
  };
}

function normalizeOutputDate(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

async function readPriceSearchBody(req: IRequest): Promise<{ ids: readonly number[], date: 'latest' | string } | Response> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return Error(400, 'Could not read request body.');
  }

  if (text.trim() === '') {
    return Error(400, 'Request body must be valid JSON.');
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Error(400, 'Request body must be valid JSON.');
  }

  if (!isRecord(body)) {
    return Error(400, 'Request body must be an object.');
  }

  if (!Array.isArray(body.ids)) {
    return Error(400, 'ids must be an array of MTGO catalog IDs.');
  }

  if (body.ids.length === 0) {
    return Error(400, 'ids cannot be empty.');
  }

  if (body.ids.length > MAX_BATCH_PRICE_IDS) {
    return Error(400, `ids cannot contain more than ${MAX_BATCH_PRICE_IDS} IDs.`);
  }

  const ids = normalizeIds(body.ids);
  if (ids instanceof Response) {
    return ids;
  }

  const date = normalizeBodyDate(body.date);
  if (date instanceof Response) {
    return date;
  }

  return {
    ids,
    date,
  };
}

function normalizeIds(ids: readonly unknown[]): readonly number[] | Response {
  const normalized = new Set<number>();

  for (const id of ids) {
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      return Error(400, 'ids must contain positive integer MTGO catalog IDs.');
    }

    normalized.add(id);
  }

  return [...normalized];
}

function normalizeDateParam(value: unknown, key: string): string | null | Response {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return isIsoDate(String(value))
    ? String(value)
    : Error(400, `${key} must be in YYYY-MM-DD format.`);
}

function normalizeBodyDate(value: unknown): 'latest' | string | Response {
  if (value === undefined || value === null || value === '') {
    return 'latest';
  }

  if (value === 'latest') {
    return 'latest';
  }

  return typeof value === 'string' && isIsoDate(value)
    ? value
    : Error(400, 'date must be latest or YYYY-MM-DD.');
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
