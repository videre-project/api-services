/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { CARD_COLORS, CARD_RARITIES, FORMATS } from './db/schema.g.ts';
import { MAX_INLINE_COLLECTION_IDS } from './queryPolicy.ts';

const nullable = <Schema extends Record<string, unknown>>(schema: Schema): Schema & { nullable: true } => ({
  ...schema,
  nullable: true,
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (items: Record<string, unknown>) => ({ type: 'array', items });

const stringParameter = (name: string, schema: Record<string, unknown> = { type: 'string' }) => ({
  name,
  in: 'query',
  schema,
});

const paginationParameters = [
  stringParameter('limit', { type: 'integer', minimum: 0, maximum: 500, default: 100 }),
  stringParameter('offset', { type: 'integer', minimum: 0, default: 0 }),
];

const cardSearchParameters = [
  ...['q', 'name', 'exact', 'set', 'colors', 'color_identity', 'mana_cost', 'artist', 'flavor',
    'collector_number', 'type', 'text', 'promo_label'].map((name) => stringParameter(name)),
  ...['id', 'mana_value', 'power', 'toughness', 'loyalty', 'defense', 'art_id', 'frame_style', 'year']
    .map((name) => stringParameter(name, { type: 'number' })),
  stringParameter('released', { type: 'string', format: 'date' }),
  stringParameter('rarity', { type: 'string', enum: [...CARD_RARITIES] }),
  stringParameter('format', { type: 'string', enum: FORMATS.map((value) => value.toLowerCase()) }),
  stringParameter('legality', {
    type: 'string',
    enum: ['legal', 'not_legal', 'banned', 'restricted', 'suspended'],
  }),
  ...['is_token', 'is_promo', 'is_multiface', 'is_split', 'is_product', 'include_tokens', 'include_total']
    .map((name) => stringParameter(name, { type: 'boolean' })),
  stringParameter('unique', { type: 'string', enum: ['cards', 'prints'] }),
  stringParameter('order', { type: 'string', enum: ['rank', 'name', 'mana_value', 'set', 'released'] }),
  stringParameter('dir', { type: 'string', enum: ['asc', 'desc'] }),
  ...paginationParameters,
];

const jsonContent = (schema: Record<string, unknown>) => ({
  'application/json': { schema },
});

const response = (schema: Record<string, unknown>, description = 'Successful response') => ({
  '200': { description, content: jsonContent(schema) },
  '400': { $ref: '#/components/responses/BadRequest' },
});

const listResponse = (itemSchema: Record<string, unknown>) => ({
  allOf: [
    ref('ListResponse'),
    { type: 'object', properties: { data: arrayOf(itemSchema) } },
  ],
});

export const OPENAPI_DOCUMENT = {
  openapi: '3.0.3',
  info: {
    title: 'Videre API',
    version: '1.0.0',
    description: 'Public, unauthenticated API for Magic Online catalog and tournament data.',
  },
  servers: [{ url: 'https://api.videreproject.com' }],
  paths: {
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiDocument',
        tags: ['Meta'],
        summary: 'Get the canonical OpenAPI document',
        responses: { '200': { description: 'The OpenAPI document' } },
      },
    },
    '/cards': {
      get: {
        operationId: 'searchCards', tags: ['Cards'], summary: 'Search cards',
        parameters: cardSearchParameters,
        responses: response(listResponse(ref('Card'))),
      },
    },
    '/cards/search': {
      post: {
        operationId: 'searchCardsWithCollection', tags: ['Cards'], summary: 'Search cards using a collection',
        parameters: cardSearchParameters,
        requestBody: { required: false, content: jsonContent(ref('CardSearchRequest')) },
        responses: response(listResponse({ oneOf: [ref('Card'), ref('Product')] })),
      },
    },
    '/cards/named': {
      get: {
        operationId: 'getCardNamed', tags: ['Cards'], summary: 'Find a card by exact or fuzzy name',
        parameters: [stringParameter('exact'), stringParameter('fuzzy'),
          stringParameter('set'), stringParameter('include_tokens', { type: 'boolean' }),
          stringParameter('unique', { type: 'string', enum: ['cards', 'prints'] })],
        responses: response(listResponse(ref('Card'))),
      },
    },
    '/cards/autocomplete': {
      get: {
        operationId: 'autocompleteCardNames', tags: ['Cards'], summary: 'Autocomplete card names',
        parameters: [
          { ...stringParameter('q'), required: true },
          stringParameter('include_tokens', { type: 'boolean' }),
          stringParameter('limit', { type: 'integer', minimum: 0, maximum: 100, default: 20 }),
        ],
        responses: response(listResponse({ type: 'string' })),
      },
    },
    '/cards/random': {
      get: {
        operationId: 'getRandomCard', tags: ['Cards'], summary: 'Get a random matching card',
        parameters: cardSearchParameters,
        responses: response(listResponse(ref('Card'))),
      },
    },
    '/cards/{id}': {
      get: {
        operationId: 'getCard', tags: ['Cards'], summary: 'Get a card by MTGO catalog ID',
        parameters: [{ $ref: '#/components/parameters/CatalogId' }],
        responses: response(listResponse(ref('Card'))),
      },
    },
    '/products': {
      get: {
        operationId: 'searchProducts', tags: ['Products'], summary: 'Search products',
        parameters: [
          ...['q', 'name', 'exact', 'set', 'type'].map((name) => stringParameter(name)),
          stringParameter('id', { type: 'integer' }),
          stringParameter('is_tradable', { type: 'boolean' }),
          stringParameter('order', { type: 'string', enum: ['rank', 'name', 'set', 'type'] }),
          stringParameter('dir', { type: 'string', enum: ['asc', 'desc'] }),
          ...paginationParameters,
        ],
        responses: response(listResponse(ref('Product'))),
      },
    },
    '/products/{id}': {
      get: {
        operationId: 'getProduct', tags: ['Products'], summary: 'Get a product by MTGO catalog ID',
        parameters: [{ $ref: '#/components/parameters/CatalogId' }],
        responses: response(listResponse(ref('Product'))),
      },
    },
    '/prices': {
      post: {
        operationId: 'getPrices', tags: ['Prices'], summary: 'Get prices for MTGO catalog IDs',
        requestBody: { required: true, content: jsonContent(ref('PriceRequest')) },
        responses: response({ allOf: [listResponse(ref('Price')), {
          type: 'object', properties: { meta: { allOf: [ref('ListMeta'), {
            type: 'object', properties: { missing_ids: arrayOf({ type: 'integer' }) },
          }] } },
        }] }),
      },
    },
    '/prices/{id}': {
      get: {
        operationId: 'getLatestPrice', tags: ['Prices'], summary: 'Get the latest price for a catalog ID',
        parameters: [{ $ref: '#/components/parameters/CatalogId' }],
        responses: response(listResponse(ref('Price'))),
      },
    },
    '/prices/{id}/history': {
      get: {
        operationId: 'getPriceHistory', tags: ['Prices'], summary: 'Get price history for a catalog ID',
        parameters: [{ $ref: '#/components/parameters/CatalogId' },
          stringParameter('from', { type: 'string', format: 'date' }),
          stringParameter('to', { type: 'string', format: 'date' }), ...paginationParameters],
        responses: response(listResponse(ref('Price'))),
      },
    },
  },
  components: {
    parameters: {
      CatalogId: { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
    },
    responses: {
      BadRequest: { description: 'Invalid request or no matching results', content: jsonContent(ref('Error')) },
    },
    schemas: {
      Error: {
        type: 'object', required: ['object', 'status', 'reason', 'message'],
        properties: {
          object: { type: 'string', enum: ['error'] }, status: { type: 'integer' },
          reason: { type: 'string' }, message: { type: 'string' }, body: {},
        },
      },
      ListMeta: {
        type: 'object',
        required: ['database', 'backend', 'exec_ms', 'row_count', 'total', 'limit', 'offset', 'has_more', 'next_offset'],
        properties: {
          database: { type: 'string' }, backend: { type: 'string' }, exec_ms: { type: 'number' },
          row_count: { type: 'integer' }, total: nullable({ type: 'integer' }),
          limit: { type: 'integer' }, offset: { type: 'integer' }, has_more: { type: 'boolean' },
          next_offset: nullable({ type: 'integer' }),
        },
      },
      ListResponse: {
        type: 'object', required: ['object', 'parameters', 'meta', 'data'],
        properties: {
          object: { type: 'string', enum: ['list'] }, parameters: { type: 'object', additionalProperties: true },
          meta: ref('ListMeta'), data: { type: 'array', items: {} },
        },
      },
      CardCollection: {
        type: 'object', required: ['ids'],
        properties: {
          ids: { type: 'array', maxItems: MAX_INLINE_COLLECTION_IDS, uniqueItems: true,
            items: { type: 'integer', minimum: 1 } },
          mode: { type: 'string', enum: ['only', 'exclude', 'rank'], default: 'only' },
          match: { type: 'string', enum: ['prints', 'oracle'], default: 'prints' },
        },
      },
      CardSearchRequest: { type: 'object', properties: { collection: ref('CardCollection') } },
      PriceRequest: {
        type: 'object',
        properties: {
          ids: { type: 'array', maxItems: MAX_INLINE_COLLECTION_IDS, items: { type: 'integer', minimum: 1 } },
          collection: { type: 'object', required: ['ids'], properties: {
            ids: { type: 'array', maxItems: MAX_INLINE_COLLECTION_IDS, items: { type: 'integer', minimum: 1 } },
          } },
          date: { oneOf: [{ type: 'string', enum: ['latest'] }, { type: 'string', format: 'date' }], default: 'latest' },
        },
      },
      CardFace: {
        type: 'object',
        properties: {
          name: { type: 'string' }, printed_name: nullable({ type: 'string' }), mana_cost: nullable({ type: 'string' }),
          mana_value: nullable({ type: 'number' }), type_line: nullable({ type: 'string' }),
          oracle_text: nullable({ type: 'string' }), flavor_text: nullable({ type: 'string' }),
          colors: arrayOf({ type: 'string', enum: CARD_COLORS.map(({ symbol }) => symbol) }),
          power: nullable({ type: 'string' }), toughness: nullable({ type: 'string' }),
          loyalty: nullable({ type: 'string' }), defense: nullable({ type: 'string' }),
          artist: nullable({ type: 'string' }), art_id: nullable({ type: 'integer' }),
        },
      },
      Card: {
        type: 'object', required: ['id', 'name'],
        properties: {
          id: { type: 'integer' }, oracle_id: nullable({ type: 'string', format: 'uuid' }),
          set_code: nullable({ type: 'string' }), set_name: nullable({ type: 'string' }),
          set_release_date: nullable({ type: 'string', format: 'date-time' }), set_type: nullable({ type: 'string' }),
          collector_number: nullable({ type: 'string' }), name: { type: 'string' },
          canonical_name: { type: 'string' }, printed_name: nullable({ type: 'string' }), display_name: { type: 'string' },
          artist: nullable({ type: 'string' }), art_id: nullable({ type: 'integer' }),
          mana_cost: nullable({ type: 'string' }), mana_value: nullable({ type: 'number' }),
          type_line: nullable({ type: 'string' }), oracle_text: nullable({ type: 'string' }),
          flavor_text: nullable({ type: 'string' }),
          colors: arrayOf({ type: 'string', enum: CARD_COLORS.map(({ symbol }) => symbol) }),
          color_identity: arrayOf({ type: 'string', enum: CARD_COLORS.map(({ symbol }) => symbol) }),
          power: nullable({ type: 'string' }), toughness: nullable({ type: 'string' }), loyalty: nullable({ type: 'string' }),
          defense: nullable({ type: 'string' }), rarity: nullable({ type: 'string', enum: [...CARD_RARITIES] }),
          frame_style: nullable({ type: 'integer' }), promo_label: nullable({ type: 'string' }),
          is_token: nullable({ type: 'boolean' }), is_promo: nullable({ type: 'boolean' }),
          is_multiface: nullable({ type: 'boolean' }), is_split: nullable({ type: 'boolean' }),
          legalities: { type: 'object', additionalProperties: { type: 'string',
            enum: ['legal', 'not_legal', 'banned', 'restricted', 'suspended'] } },
          image_url: { type: 'string', format: 'uri' }, in_collection: { type: 'boolean' },
          faces: arrayOf(ref('CardFace')),
        },
      },
      Product: {
        type: 'object', required: ['id'],
        properties: {
          id: { type: 'integer' }, set_code: nullable({ type: 'string' }), set_name: nullable({ type: 'string' }),
          name: nullable({ type: 'string' }), description: nullable({ type: 'string' }),
          object_type: nullable({ type: 'string' }), texture_number: nullable({ type: 'integer' }),
          is_tradable: nullable({ type: 'boolean' }), image_url: { type: 'string', format: 'uri' },
          in_collection: { type: 'boolean' },
        },
      },
      Price: {
        type: 'object', required: ['id', 'price_date', 'sell_price', 'source'],
        properties: {
          id: { type: 'integer' }, price_date: { type: 'string', format: 'date' }, sell_price: { type: 'number' },
          source: { type: 'string' }, url: nullable({ type: 'string', format: 'uri' }), kind: nullable({ type: 'string' }),
          name: nullable({ type: 'string' }), cardset: nullable({ type: 'string' }), rarity: nullable({ type: 'string' }),
          version: nullable({ type: 'string' }), foil: nullable({ type: 'boolean' }),
        },
      },
    },
  },
} as const;

export const openApiResponse = (): Response => new Response(JSON.stringify(OPENAPI_DOCUMENT), {
  headers: {
    'Content-Type': 'application/vnd.oai.openapi+json;version=3.0',
  },
});
