/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { Router } from 'itty-router';

import { Execute } from '@/db/helpers';
import { withPostgres } from '@/db/postgres';
import { getProductCount, getProducts } from '@/db/queries';
import { buildListResponse, Error, getListPagination } from '@/responses';
import { applyProductSearchQuery } from '@/search/productSearchQuery';
import {
  BooleanValidator,
  CardSearchQueryValidator,
  CardSortDirectionValidator,
  NumberValidator,
  StringValidator
} from '@/db/validators';
import { Optional, Required, withValidation } from '@/validation';



export const args = {
  id:          Optional(NumberValidator),
  q:           Optional(CardSearchQueryValidator),
  name:        Optional(StringValidator),
  exact:       Optional(StringValidator),
  set:         Optional(StringValidator),
  type:        Optional(StringValidator),
  is_tradable: Optional(BooleanValidator),
  order:       Optional(StringValidator),
  dir:         Optional(CardSortDirectionValidator),
  limit:       Optional(NumberValidator),
  offset:      Optional(NumberValidator),
};

export const detailArgs = {
  id: Required(NumberValidator),
};

export default Router({ base: '/products' })
  .get('/',
    withValidation(args),
    withPostgres,
    async (req, { sql, params }) => {
      const searchParams = applyProductSearchQuery(params);
      const start = performance.now();
      const data = await getProducts(sql, searchParams);
      const [{ count }] = await getProductCount(sql, searchParams);
      const total = Number(count);

      if (!data.length)
        return Error(400, 'No results found.', buildListResponse(searchParams, data, total, start));

      return buildListResponse(searchParams, data, total, start, getListPagination(searchParams, data.length, total));
    }
  )
  .get('/:id',
    withValidation(detailArgs),
    withPostgres,
    async (req, { sql, params }) => {
      return await Execute(getProducts(sql, {
        ...params,
        limit: 1,
        offset: 0,
      }), params);
    }
  );
