/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { fromCompiledQuery } from '../compiledQuery.ts';

import { buildProductCountQuery, buildProductsQuery } from './buildProductsQuery.ts';

export interface IProduct {
  id: number,
  set_code: string | null,
  set_name: string | null,
  name: string | null,
  object_type: string | null,
  texture_number: number | null,
  is_tradable: boolean | null,
  image_url: string,
  in_collection?: boolean
};

export interface IProductCount {
  count: number
};

export const getProducts = fromCompiledQuery<IProduct>(buildProductsQuery);

export const getProductCount = fromCompiledQuery<IProductCount>(buildProductCountQuery);
