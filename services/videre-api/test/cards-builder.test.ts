import assert from 'node:assert/strict';
import test from 'node:test';

import postgres from 'postgres';

import { buildCardCountQuery } from '../src/db/queries/cards/buildCardCountQuery.ts';
import { buildCardNameAutocompleteQuery } from '../src/db/queries/cards/buildCardNameAutocompleteQuery.ts';
import { buildCardQuery } from '../src/db/queries/cards/getCard.ts';
import {
  buildCardsQuery,
  type CardQueryParams
} from '../src/db/queries/cards/buildCardsQuery.ts';

const sql = postgres({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 6432),
  database: process.env.PGDATABASE ?? 'mtgo',
  username: process.env.PGUSER ?? 'public_api',
  password: process.env.PGPASSWORD || undefined,
  ssl: process.env.PGSSL === 'true' ? 'require' : false,
  transform: {
    undefined: null,
  },
});

test.after(async () => {
  await sql.end({ timeout: 5 });
});

test('builder-backed card SQL handles representative search shapes', async () => {
  const cases: readonly CardQueryParams[] = [
    {
      q: 'lightning bolt',
      unique: 'cards',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      exact: 'Dizzying Swoop',
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      type: 'artifact,!creature',
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      set: 'ELD',
      name: 'tactician',
      unique: 'prints',
      order: 'set',
      limit: 10,
      offset: 0,
    },
    {
      q: 'dragon',
      type: 'creature',
      include_tokens: false,
      unique: 'cards',
      order: 'rank',
      limit: 10,
      offset: 0,
    },
    {
      colors: 'R',
      colors_operator: '<=',
      type: 'instant',
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      exact: 'Lightning Bolt',
      mana_value: 1,
      mana_value_operator: '=',
      mana_cost: '{R}',
      format: 'modern',
      legality: 'legal',
      unique: 'prints',
      order: 'released',
      dir: 'desc',
      limit: 10,
      offset: 0,
    },
    {
      rarity: 'rare',
      rarity_operator: '>=',
      type: 'creature,!token',
      unique: 'prints',
      order: 'set',
      limit: 10,
      offset: 0,
    },
    {
      artist: 'Kev Walker',
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      collector_number: '1',
      year: 2020,
      year_operator: '>=',
      unique: 'prints',
      order: 'released',
      limit: 10,
      offset: 0,
    },
    {
      is_promo: true,
      is_multiface: false,
      include_tokens: false,
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      is_split: true,
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
    {
      is_token: true,
      include_tokens: true,
      unique: 'prints',
      order: 'name',
      limit: 10,
      offset: 0,
    },
  ];

  for (const params of cases) {
    const rows = await builderCards(params);
    const count = await builderCardCount(params);

    assert.ok(rows.length > 0, JSON.stringify(params));
    assert.ok(count >= rows.length, JSON.stringify(params));
    assert.ok(rows.length <= (params.limit ?? 100), JSON.stringify(params));
  }
});

test('builder-backed count SQL handles representative search shapes', async () => {
  const cases: readonly CardQueryParams[] = [
    {
      unique: 'prints',
    },
    {
      unique: 'cards',
    },
    {
      exact: 'Lightning Bolt',
      unique: 'prints',
    },
    {
      exact: 'Lightning Bolt',
      unique: 'cards',
    },
    {
      type: 'artifact,!creature',
      unique: 'prints',
    },
    {
      colors: 'U',
      colors_operator: '<=',
      unique: 'prints',
    },
    {
      mana_value: 1,
      mana_value_operator: '<=',
      type: '!land',
      unique: 'prints',
    },
    {
      rarity: 'rare',
      rarity_operator: '>=',
      unique: 'prints',
    },
    {
      artist: 'Kev Walker',
      unique: 'prints',
    },
    {
      format: 'modern',
      legality: 'legal',
      unique: 'cards',
    },
    {
      year: 2020,
      year_operator: '>=',
      unique: 'prints',
    },
    {
      is_token: true,
      include_tokens: true,
      unique: 'prints',
    },
  ];

  for (const params of cases) {
    const actual = await builderCardCount(params);

    assert.ok(actual > 0, JSON.stringify(params));
  }
});

test('builder-backed card SQL ranks canonical and printed-name matches', async () => {
  const canonicalPrints = await builderCards({
    exact: 'Lightning Bolt',
    unique: 'prints',
    order: 'name',
    limit: 5,
    offset: 0,
  });

  assert.ok(canonicalPrints.length > 0);
  assert.equal(canonicalPrints[0].name, 'Lightning Bolt');
  assert.equal(canonicalPrints[0].printed_name, null);

  const canonicalCards = await builderCards({
    exact: 'Lightning Bolt',
    unique: 'cards',
    order: 'name',
    limit: 1,
    offset: 0,
  });

  assert.equal(canonicalCards.length, 1);
  assert.equal(canonicalCards[0].name, 'Lightning Bolt');
  assert.equal(canonicalCards[0].printed_name, null);

  const printedNameMatches = await builderCards({
    exact: 'Thrum of the Vestige',
    unique: 'prints',
    order: 'name',
    limit: 1,
    offset: 0,
  });

  assert.equal(printedNameMatches.length, 1);
  assert.equal(printedNameMatches[0].id, 139943);
  assert.equal(printedNameMatches[0].name, 'Lightning Bolt');
  assert.equal(printedNameMatches[0].printed_name, 'Thrum of the Vestige');
  assert.equal(printedNameMatches[0].display_name, 'Thrum of the Vestige');
});

test('builder SQL stays parameterized', () => {
  const query = buildCardsQuery({
    exact: "Dizzying Swoop' OR TRUE --",
    type: "artifact,!creature",
    limit: 5,
  });

  assert.match(query.text, /\$\d+/);
  assert.doesNotMatch(query.text, /Dizzying Swoop/);
  assert.ok(query.values.includes("Dizzying Swoop' OR TRUE --"));
});

test('builder SQL keeps collection IDs parameterized', () => {
  const query = buildCardsQuery({
    exact: 'Lightning Bolt',
    unique: 'prints',
    collection: {
      ids: [605, 1195],
      mode: 'only',
      match: 'prints',
    },
  });

  assert.match(query.text, /jsonb_array_elements_text\(\(\$\d+\)::text::jsonb\)/);
  assert.doesNotMatch(query.text, /1195/);
  assert.ok(query.values.includes('[605,1195]'));
});

test('builder count SQL stays parameterized', () => {
  const query = buildCardCountQuery({
    exact: "Dizzying Swoop' OR TRUE --",
    rarity: 'rare',
    rarity_operator: '>=',
  });

  assert.match(query.text, /\$\d+/);
  assert.doesNotMatch(query.text, /Dizzying Swoop/);
  assert.ok(query.values.includes("Dizzying Swoop' OR TRUE --"));
});

test('builder count SQL keeps collection IDs parameterized', () => {
  const query = buildCardCountQuery({
    exact: 'Lightning Bolt',
    unique: 'prints',
    collection: {
      ids: [605, 1195],
      mode: 'only',
      match: 'prints',
    },
  });

  assert.match(query.text, /jsonb_array_elements_text\(\(\$\d+\)::text::jsonb\)/);
  assert.doesNotMatch(query.text, /1195/);
  assert.ok(query.values.includes('[605,1195]'));
});

test('card detail SQL keeps nested placeholders and values together', () => {
  const query = buildCardQuery({
    id: 605,
    unique: 'prints',
    limit: 1,
    offset: 0,
  });

  const placeholders = Array.from(query.text.matchAll(/\$(\d+)/g), (match) => Number(match[1]));

  assert.ok(placeholders.length > 0);
  assert.equal(Math.max(...placeholders), query.values.length);
  assert.deepEqual(query.values, [605, null, null, null, 605, 1, 0]);
});

test('builder SQL searches canonical and printed names', () => {
  const query = buildCardsQuery({
    exact: 'Thrum of the Vestige',
    unique: 'prints',
    limit: 5,
  });

  assert.match(query.text, /printed_name_normalized/);
  assert.ok(query.values.includes('Thrum of the Vestige'));
});

test('builder SQL ranks canonical exact matches before printed-name aliases', () => {
  const query = buildCardsQuery({
    exact: 'Lightning Bolt',
    unique: 'prints',
    limit: 5,
  });

  assert.match(query.text, /name_match_priority/);
  assert.match(query.text, /"c"\."printed_name" IS NULL THEN 0/);
  assert.match(query.text, /WHEN "c"\."printed_name_normalized" = lower\(\$\d+\) THEN 2/);
  assert.match(query.text, /ORDER BY name_match_priority, name asc NULLS LAST/);
});

test('autocomplete SQL includes printed name candidates', () => {
  const query = buildCardNameAutocompleteQuery({
    q: 'thrum',
    limit: 5,
  });

  assert.match(query.text, /"c"."printed_name"/);
  assert.match(query.text, /"cf"."printed_name"/);
  assert.match(query.text, /source_priority/);
  assert.match(query.text, /starts_with_first_term/);
  assert.match(query.text, /ordered_terms_match/);
  assert.match(query.text, /ordered_terms_strong_match/);
  assert.match(query.text, /token_prefix_matches/);
  assert.match(query.text, /word_similarity/);
  assert.match(query.text, /ORDER BY\s+is_prefix DESC,\s+ordered_terms_strong_match DESC,\s+starts_with_first_term DESC,\s+ordered_terms_match DESC,\s+token_prefix_matches DESC,/);
  assert.ok(query.values.includes('thrum'));
});

async function builderCards(params: CardQueryParams): Promise<Record<string, unknown>[]> {
  const query = buildCardsQuery(params);
  const rows = await sql.unsafe(query.text, [...query.values]);

  return [...rows];
}

async function builderCardCount(params: CardQueryParams): Promise<number> {
  const query = buildCardCountQuery(params);
  const [row] = await sql.unsafe(query.text, [...query.values]);

  return Number(row.count);
}
