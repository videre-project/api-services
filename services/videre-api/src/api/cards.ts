/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { Router } from 'itty-router';

import { Execute } from '@/db/helpers';
import { withPostgres, type Sql } from '@/db/postgres';
import { getCard, getCardCount, getCardNameAutocomplete, getCards } from '@/db/queries';
import {
  asJSON,
  buildListResponse,
  Error,
  getListLimit,
  getListPagination,
  getProbePagination
} from '@/responses';
import { applyCardSearchQuery } from '@/search/cardSearchQuery';
import {
  BooleanValidator,
  CardFormatValidator,
  CardLegalityValidator,
  CardRarityValidator,
  CardSearchQueryValidator,
  CardSortDirectionValidator,
  CardSortOrderValidator,
  CardUniqueModeValidator,
  DateValidator,
  NumberValidator,
  StringValidator
} from '@/db/validators';
import { Optional, Required, withValidation } from '@/validation';
import { readCardCollection } from './cardCollection';


export const args = {
  id:             Optional(NumberValidator),
  q:              Optional(CardSearchQueryValidator),
  name:           Optional(StringValidator),
  exact:          Optional(StringValidator),
  set:            Optional(StringValidator),
  colors:         Optional(StringValidator),
  color_identity: Optional(StringValidator),
  mana_cost:      Optional(StringValidator),
  mana_value:     Optional(NumberValidator),
  power:          Optional(NumberValidator),
  toughness:      Optional(NumberValidator),
  loyalty:        Optional(NumberValidator),
  defense:        Optional(NumberValidator),
  artist:         Optional(StringValidator),
  flavor:         Optional(StringValidator),
  collector_number: Optional(StringValidator),
  art_id:         Optional(NumberValidator),
  frame_style:    Optional(NumberValidator),
  promo_label:    Optional(StringValidator),
  released:       Optional(DateValidator),
  year:           Optional(NumberValidator),
  type:           Optional(StringValidator),
  text:           Optional(StringValidator),
  rarity:         Optional(CardRarityValidator),
  format:         Optional(CardFormatValidator),
  legality:       Optional(CardLegalityValidator),
  is_token:       Optional(BooleanValidator),
  is_promo:       Optional(BooleanValidator),
  is_multiface:   Optional(BooleanValidator),
  is_split:       Optional(BooleanValidator),
  include_tokens: Optional(BooleanValidator),
  include_total:  Optional(BooleanValidator),
  unique:         Optional(CardUniqueModeValidator),
  order:          Optional(CardSortOrderValidator),
  dir:            Optional(CardSortDirectionValidator),
  limit:          Optional(NumberValidator),
  offset:         Optional(NumberValidator),
};

export const detailArgs = {
  id: Required(NumberValidator),
};

export const namedArgs = {
  exact:          Optional(StringValidator),
  fuzzy:          Optional(StringValidator),
  set:            Optional(StringValidator),
  include_tokens: Optional(BooleanValidator),
  unique:         Optional(CardUniqueModeValidator),
};

export const autocompleteArgs = {
  q:              Required(StringValidator),
  include_tokens: Optional(BooleanValidator),
  limit:          Optional(NumberValidator),
};

export default Router({ base: '/cards' })
  .get('/',
    withValidation(args),
    withPostgres,
    async (req, { sql, params }) => {
      return searchCards(sql, params);
    }
  )
  .post('/search',
    withValidation(args),
    async (req, { params }) => {
      const collection = await readCardCollection(req);
      if (collection instanceof Response) {
        collection.headers.set('Cache-Control', 'private, no-store');
        return collection;
      }

      if (collection !== null) {
        params.collection = collection;
      }
    },
    withPostgres,
    async (req, { sql, params }) => {
      const response = await searchCards(sql, params);
      if (response instanceof Response) {
        // Avoid caching search results for POST requests since request bodies
        // are user-defined and not unique to the request URL.
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
      }

      return asJSON(response, { headers: { 'Cache-Control': 'private, no-store' } });
    }
  )
  .get('/named',
    withValidation(namedArgs),
    withPostgres,
    async (req, { sql, params }) => {
      const hasExact = typeof params.exact === 'string' && params.exact.trim() !== '';
      const hasFuzzy = typeof params.fuzzy === 'string' && params.fuzzy.trim() !== '';

      if (hasExact === hasFuzzy) {
        return Error(400, 'Provide exactly one of exact or fuzzy.');
      }

      const [card] = await getCards(sql, {
        ...params,
        exact: hasExact ? params.exact : undefined,
        q: hasFuzzy ? params.fuzzy : undefined,
        order: hasFuzzy ? 'rank' : 'name',
        limit: 1,
        offset: 0,
        unique: params.unique ?? 'cards',
      });

      if (!card) {
        return Error(400, 'No results found.');
      }

      const response = await Execute(getCard(sql, {
        id: card.id,
        limit: 1,
        offset: 0,
        unique: 'prints',
      }), { ...params, id: card.id });

      return 'data' in response
        ? { ...response, data: normalizeCards(response.data) }
        : response;
    }
  )
  .get('/autocomplete',
    withValidation(autocompleteArgs),
    withPostgres,
    async (req, { sql, params }) => {
      const start = performance.now();
      const rows = await getCardNameAutocomplete(sql, params);
      const data = rows.map((row: { name: string }) => row.name);

      return buildListResponse(params, data, data.length, start);
    }
  )
  .get('/random',
    withValidation(args),
    withPostgres,
    async (req, { sql, params }) => {
      const searchParams = applyCardSearchQuery(params);
      if (searchParams.format && !searchParams.legality) {
        searchParams.legality = 'legal';
      }

      if (searchParams.__empty) {
        return Error(400, 'No results found.');
      }

      const [{ count }] = await getCardCount(sql, searchParams);
      const total = Number(count);
      if (total <= 0) {
        return Error(400, 'No results found.');
      }

      const [card] = await getCards(sql, {
        ...searchParams,
        limit: 1,
        offset: Math.floor(Math.random() * total),
      });

      if (!card) {
        return Error(400, 'No results found.');
      }

      const response = await Execute(getCard(sql, {
        id: card.id,
        limit: 1,
        offset: 0,
        unique: 'prints',
      }), { ...params, id: card.id });

      return 'data' in response
        ? { ...response, data: normalizeCards(response.data) }
        : response;
    }
  )
  .get('/:id',
    withValidation(detailArgs),
    withPostgres,
    async (req, { sql, params }) => {
      const response = await Execute(getCard(sql, {
        ...params,
        limit: 1,
        offset: 0,
        unique: 'prints',
      }), params);

      return 'data' in response
        ? { ...response, data: normalizeCards(response.data) }
        : response;
    }
  );

const searchCards = async (sql: Sql, params: any) => {
  const searchParams = applyCardSearchQuery(params);
  if (params.collection) {
    searchParams.collection = params.collection;
  }

  if (searchParams.format && !searchParams.legality) {
    searchParams.legality = 'legal';
  }
  const start = performance.now();
  const responseParams = cardSearchResponseParams(searchParams);
  if (searchParams.__empty) {
    return Error(400, 'No results found.', buildListResponse(responseParams, [], 0, start));
  }

  const limit = getListLimit(searchParams);
  const includeTotal = searchParams.include_total === true || limit >= 500;
  const cardParams = includeTotal
    ? searchParams
    : { ...searchParams, limit: limit + 1 };
  const [fetchedData, countRows] = await Promise.all([
    getCards(sql, cardParams).then(normalizeCards),
    includeTotal ? getCardCount(sql, searchParams) : Promise.resolve([{ count: null }]),
  ]);
  const data = includeTotal ? fetchedData : fetchedData.slice(0, limit);
  const exactTotal = includeTotal ? Number(countRows[0].count) : null;

  if (!data.length)
    return Error(400, 'No results found.', buildListResponse(responseParams, data, exactTotal, start));

  return buildListResponse(
    responseParams,
    data,
    exactTotal,
    start,
    exactTotal !== null
      ? getListPagination(searchParams, data.length, exactTotal)
      : getProbePagination(searchParams, fetchedData.length)
  );
};

const cardSearchResponseParams = (params: any) => {
  if (!params.collection) {
    return params;
  }

  const { collection, ...responseParams } = params;
  return {
    ...responseParams,
    collection: {
      mode: collection.mode,
      match: collection.match,
      size: Array.isArray(collection.ids) ? collection.ids.length : 0,
    },
  };
};

const normalizeCards = (cards: any[]) =>
  cards.map((card) => ({
    ...card,
    mana_value: card.mana_value === null ? null : Number(card.mana_value),
    faces: Array.isArray(card.faces)
      ? card.faces.map((face: any) => ({
          ...face,
          mana_value: face.mana_value === null ? null : Number(face.mana_value),
        }))
      : card.faces,
  }));
