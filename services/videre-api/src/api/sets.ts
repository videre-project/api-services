/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { Router } from 'itty-router';

import { Execute } from '@/db/helpers';
import { withPostgres } from '@/db/postgres';
import { getSetCount, getSets } from '@/db/queries';
import { buildListResponse, Error, getListPagination } from '@/responses';
import { applySetSearchQuery } from '@/search/setSearchQuery';
import {
  CardSearchQueryValidator,
  CardSortDirectionValidator,
  NumberValidator,
  StringValidator
} from '@/db/validators';
import { Optional, Required, withValidation } from '@/validation';


export const args = {
  q:      Optional(CardSearchQueryValidator),
  code:   Optional(StringValidator),
  name:   Optional(StringValidator),
  type:   Optional(StringValidator),
  order:  Optional(StringValidator),
  dir:    Optional(CardSortDirectionValidator),
  limit:  Optional(NumberValidator),
  offset: Optional(NumberValidator),
};

export const detailArgs = {
  code: Required(StringValidator),
};

export default Router({ base: '/sets' })
  .get('/',
    withValidation(args),
    withPostgres,
    async (req, { sql, params }) => {
      const searchParams = applySetSearchQuery(params);
      const start = performance.now();
      const data = normalizeSets(await getSets(sql, searchParams));
      const [{ count }] = await getSetCount(sql, searchParams);
      const total = Number(count);

      if (!data.length)
        return Error(400, 'No results found.', buildListResponse(searchParams, data, total, start));

      return buildListResponse(searchParams, data, total, start, getListPagination(searchParams, data.length, total));
    }
  )
  .get('/:code',
    withValidation(detailArgs),
    withPostgres,
    async (req, { sql, params }) => {
      const response = await Execute(getSets(sql, {
        ...params,
        limit: 1,
        offset: 0,
      }), params);

      if (response instanceof Response) {
        return response;
      }

      const output = response as any;
      output.data = normalizeSets(output.data);
      return output;
    }
  );

const normalizeSets = (sets: any[]) =>
  sets.map((set) => ({
    ...set,
    card_count: Number(set.card_count),
    token_count: Number(set.token_count),
    product_count: Number(set.product_count),
  }));
