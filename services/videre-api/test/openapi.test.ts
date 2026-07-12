import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_RARITIES, FORMATS } from '../src/db/schema.g.ts';
import { OPENAPI_DOCUMENT, openApiResponse } from '../src/openapi.ts';

test('serves the canonical OpenAPI document with the OpenAPI media type', async () => {
  const response = openApiResponse();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.oai.openapi+json;version=3.0');
  assert.deepEqual(await response.json(), OPENAPI_DOCUMENT);
});

test('documents client generation schemas and public catalog operations', () => {
  assert.equal(OPENAPI_DOCUMENT.openapi, '3.0.3');
  assert.ok(OPENAPI_DOCUMENT.paths['/cards']);
  assert.ok(OPENAPI_DOCUMENT.paths['/cards/search']);
  assert.ok(OPENAPI_DOCUMENT.paths['/products']);
  assert.ok(OPENAPI_DOCUMENT.paths['/prices']);
  assert.ok(OPENAPI_DOCUMENT.components.schemas.Card);
  assert.ok(OPENAPI_DOCUMENT.components.schemas.Product);
  assert.ok(OPENAPI_DOCUMENT.components.schemas.Price);
});

test('derives card rarity and format enums from generated database constants', () => {
  assert.deepEqual(
    OPENAPI_DOCUMENT.components.schemas.Card.properties.rarity.enum,
    [...CARD_RARITIES],
  );

  const cards = OPENAPI_DOCUMENT.paths['/cards'].get;
  const format = cards.parameters.find((parameter) => parameter.name === 'format');
  assert.deepEqual(format?.schema.enum, FORMATS.map((value) => value.toLowerCase()));
});
