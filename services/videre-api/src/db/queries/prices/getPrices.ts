/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { fromCompiledQuery } from '../compiledQuery.ts';

import {
  buildBatchPricesQuery,
  buildLatestPriceQuery,
  buildPriceHistoryCountQuery,
  buildPriceHistoryQuery,
  type PriceBatchParams,
  type PriceHistoryParams
} from './buildPricesQuery.ts';


export interface ICatalogPrice {
  id: number,
  price_date: string | Date,
  sell_price: string,
  source: string,
  kind: 'card' | 'card_variant' | 'product' | null,
  name: string | null,
  cardset: string | null,
  rarity: string | null,
  version: string | null,
  foil: boolean | null,
};

export interface IPriceCount {
  count: number
};

export const getLatestPrice = fromCompiledQuery<ICatalogPrice, PriceHistoryParams>(buildLatestPriceQuery);

export const getPriceHistory = fromCompiledQuery<ICatalogPrice, PriceHistoryParams>(buildPriceHistoryQuery);

export const getPriceHistoryCount = fromCompiledQuery<IPriceCount, PriceHistoryParams>(buildPriceHistoryCountQuery);

export const getBatchPrices = fromCompiledQuery<ICatalogPrice, PriceBatchParams>(buildBatchPricesQuery);
