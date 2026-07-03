import assert from 'node:assert/strict';
import test from 'node:test';

import postgres from 'postgres';

import { buildCardCountQuery } from '../src/db/queries/cards/buildCardCountQuery.ts';
import { buildCardFacesQuery } from '../src/db/queries/cards/buildCardFacesQuery.ts';
import { buildCardNameAutocompleteQuery } from '../src/db/queries/cards/buildCardNameAutocompleteQuery.ts';
import { buildCardsQuery } from '../src/db/queries/cards/buildCardsQuery.ts';
import { buildProductsQuery } from '../src/db/queries/products/buildProductsQuery.ts';

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

const defaults = {
  q: null,
  id: null,
  name: null,
  exact: null,
  set: null,
  colors: null,
  colorsOperator: null,
  colorIdentity: null,
  colorIdentityOperator: null,
  manaValue: null,
  manaValueOperator: null,
  manaCost: null,
  type: null,
  text: null,
  rarity: null,
  rarityOperator: null,
  format: null,
  legality: null,
  isToken: null,
  includeTokens: null,
  order: null,
  dir: null,
  limit: 25,
  offset: 0,
  unique: 'cards',
  power: null,
  powerOperator: null,
  toughness: null,
  toughnessOperator: null,
  loyalty: null,
  loyaltyOperator: null,
  defense: null,
  defenseOperator: null,
  artist: null,
  flavor: null,
  collectorNumber: null,
  artId: null,
  frameStyle: null,
  promoLabel: null,
  released: null,
  releasedOperator: null,
  year: null,
  yearOperator: null,
  isPromo: null,
  isMultiface: null,
  isSplit: null,
  collection: null,
};

const params = (overrides = {}) => ({ ...defaults, ...overrides });
const apiBaseUrl = process.env.VIDERE_API_BASE_URL;

const apiCards = (overrides = {}) => {
  const query = buildCardsQuery(toCardQueryParams(params(overrides)));
  return sql.unsafe(query.text, [...query.values]);
};

const apiCardCount = async (overrides = {}) => {
  const query = buildCardCountQuery(toCardQueryParams(params(overrides)));
  const [row] = await sql.unsafe(query.text, [...query.values]);

  return Number(row.count);
};

const toCardQueryParams = (p) => ({
  q: p.q,
  id: p.id,
  name: p.name,
  exact: p.exact,
  set: p.set,
  colors: p.colors,
  colors_operator: p.colorsOperator,
  color_identity: p.colorIdentity,
  color_identity_operator: p.colorIdentityOperator,
  mana_value: p.manaValue,
  mana_value_operator: p.manaValueOperator,
  mana_cost: p.manaCost,
  type: p.type,
  text: p.text,
  rarity: p.rarity,
  rarity_operator: p.rarityOperator,
  format: p.format,
  legality: p.legality,
  is_token: p.isToken,
  include_tokens: p.includeTokens,
  order: p.order,
  dir: p.dir,
  limit: p.limit,
  offset: p.offset,
  unique: p.unique,
  power: p.power,
  power_operator: p.powerOperator,
  toughness: p.toughness,
  toughness_operator: p.toughnessOperator,
  loyalty: p.loyalty,
  loyalty_operator: p.loyaltyOperator,
  defense: p.defense,
  defense_operator: p.defenseOperator,
  artist: p.artist,
  flavor: p.flavor,
  collector_number: p.collectorNumber,
  art_id: p.artId,
  frame_style: p.frameStyle,
  promo_label: p.promoLabel,
  released: p.released,
  released_operator: p.releasedOperator,
  year: p.year,
  year_operator: p.yearOperator,
  is_promo: p.isPromo,
  is_multiface: p.isMultiface,
  is_split: p.isSplit,
  collection: p.collection,
});

const apiCardNameAutocomplete = (overrides = {}) => {
  const p = {
    q: null,
    includeTokens: false,
    limit: 20,
    ...overrides,
  };
  const query = buildCardNameAutocompleteQuery({
    q: p.q,
    include_tokens: p.includeTokens,
    limit: p.limit,
  });

  return sql.unsafe(query.text, [...query.values]);
};

const autocompleteRankScores = (q, names) => sql`
  WITH raw_search AS (
    SELECT lower(btrim(coalesce(${q}::text, ''))) AS value
  ),
  search AS (
    SELECT
      value,
      split_part(value, ' ', 1) AS first_term,
      terms,
      cardinality(terms) AS term_count,
      CASE
        WHEN cardinality(terms) > 1 THEN
          '(^|[^[:alnum:]])'
          || array_to_string(terms, '[[:alnum:]]*.*(^|[^[:alnum:]])')
          || '[[:alnum:]]*'
        ELSE NULL
      END AS ordered_terms_pattern
    FROM (
      SELECT
        value,
        array_remove(
          regexp_split_to_array(
            btrim(regexp_replace(value, '[^[:alnum:]]+', ' ', 'g')),
            ' '
          ),
          ''
        ) AS terms
      FROM raw_search
    ) tokenized_search
  ),
  input_names AS (
    SELECT
      name,
      ord::int AS ordinal,
      lower(name) AS normalized_name
    FROM unnest(${names}::text[]) WITH ORDINALITY AS input(name, ord)
  )
  SELECT
    input_names.name,
    input_names.ordinal,
    input_names.normalized_name LIKE search.value || '%' AS is_prefix,
    CASE
      WHEN search.term_count > 2 THEN
        input_names.normalized_name ~ search.ordered_terms_pattern
      ELSE FALSE
    END AS ordered_terms_strong_match,
    input_names.normalized_name LIKE search.first_term || '%' AS starts_with_first_term,
    CASE
      WHEN search.term_count > 1 THEN
        input_names.normalized_name ~ search.ordered_terms_pattern
      ELSE FALSE
    END AS ordered_terms_match,
    CASE
      WHEN search.term_count > 1 THEN (
        SELECT count(*)::int
        FROM unnest(search.terms) AS term
        WHERE input_names.normalized_name ~ (
          '(^|[^[:alnum:]])' || term || '[[:alnum:]]*'
        )
      )
      ELSE 0
    END AS token_prefix_matches,
    word_similarity(search.value, input_names.normalized_name)::float8 AS ordered_rank,
    similarity(input_names.normalized_name, search.value)::float8 AS rank
  FROM input_names
  CROSS JOIN search
  ORDER BY input_names.ordinal
`;

const compareAutocompleteRankScores = (left, right) => {
  const rankKeys = [
    'is_prefix',
    'ordered_terms_strong_match',
    'starts_with_first_term',
    'ordered_terms_match',
    'token_prefix_matches',
    'ordered_rank',
    'rank',
  ];

  for (const key of rankKeys) {
    const leftValue = Number(left[key]);
    const rightValue = Number(right[key]);

    if (Math.abs(leftValue - rightValue) > 1e-9) {
      return leftValue - rightValue;
    }
  }

  return 0;
};

test('name search finds Lightning Bolt cards and emits card image URLs', async () => {
  const rows = await apiCards({ q: 'lightning bolt', limit: 10 });

  assert.ok(rows.length > 0);
  assert.ok(rows.some((row) => row.name === 'Lightning Bolt'));
  assert.ok('artist' in rows[0]);
  assert.ok('set_release_date' in rows[0]);
  assert.match(rows[0].image_url, /^https:\/\/r2\.videreproject\.com\/cards\/\d+-300px\.png$/);
});

test('card name autocomplete returns ranked unique names', async () => {
  const rows = await apiCardNameAutocomplete({ q: 'lightn', limit: 10 });

  assert.ok(rows.length > 0);
  assert.ok(rows.some((row) => row.name === 'Lightning Bolt'));
  assert.equal(new Set(rows.map((row) => row.name)).size, rows.length);
});

test('card name autocomplete orders results by rank tuple', async () => {
  for (const q of ['Lightning Bo', 'Lightning Security Ser', 'Lightning Army One']) {
    const rows = await apiCardNameAutocomplete({ q, limit: 20 });
    const names = rows.map((row) => row.name);
    const scores = await autocompleteRankScores(q, names);

    assert.equal(scores.length, names.length);

    for (let i = 0; i < scores.length - 1; i++) {
      assert.ok(
        compareAutocompleteRankScores(scores[i], scores[i + 1]) >= 0,
        `${q}: ${scores[i].name} should not rank before ${scores[i + 1].name}`
      );
    }
  }
});

test('Lightning Bolt legality comes from Modern-era core printings, not Pioneer reprints', async () => {
  const [row] = await apiCards({ id: 605, unique: 'prints', limit: 1 });

  assert.ok(row);
  assert.equal(row.name, 'Lightning Bolt');
  assert.equal(row.legalities.modern, 'legal');
  assert.equal(row.legalities.pioneer, 'not_legal');
});

test('oracle-collapsed unique mode never returns more rows than print mode', async () => {
  const cards = await apiCardCount({ exact: 'Lightning Bolt', unique: 'cards' });
  const prints = await apiCardCount({ exact: 'Lightning Bolt', unique: 'prints' });

  assert.ok(cards > 0);
  assert.ok(prints >= cards);
});

test('foil clone catalog IDs are variants, not card search rows', async () => {
  const cloneRows = await apiCards({ id: 606, unique: 'prints', limit: 1 });
  const [variant] = await sql`
    SELECT catalog_id, card_id, variant_type, is_foil
    FROM card_catalog_variants
    WHERE catalog_id = ${606}::int
  `;

  assert.equal(cloneRows.length, 0);
  if (variant) {
    assert.deepEqual(variant, {
      catalog_id: 606,
      card_id: 605,
      variant_type: 'foil_clone',
      is_foil: true,
    });
  }
});

test('type filters can require and exclude card types together', async () => {
  const rows = await apiCards({ type: 'artifact,!creature', limit: 25 });

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.match(row.type_line.toLowerCase(), /\bartifact\b/);
    assert.doesNotMatch(row.type_line.toLowerCase(), /\bcreature\b/);
  }
});

test('color subset filters include mono-blue and colorless cards only', async () => {
  const rows = await apiCards({ colors: 'U', colorsOperator: '<=', limit: 25 });

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.colors.every((color) => color === 'U' || color === 'C'), `${row.name} has colors ${row.colors.join('')}`);
  }
});

test('numeric filters compose with type exclusions', async () => {
  const rows = await apiCards({
    manaValue: 1,
    manaValueOperator: '<=',
    type: '!land',
    limit: 25,
  });

  assert.ok(rows.length > 0);
  for (const row of rows) {
    const typeLine = row.type_line?.toLowerCase() ?? '';
    assert.ok(Number(row.mana_value) <= 1, `${row.name} has mana value ${row.mana_value}`);
    assert.doesNotMatch(typeLine, /\bland\b/);
  }
});

test('mana cost filters match exact printed mana costs', async () => {
  const rows = await apiCards({
    manaCost: '{R}',
    type: 'instant',
    unique: 'prints',
    limit: 25,
  });

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.mana_cost, '{R}');
    assert.match(row.type_line.toLowerCase(), /\binstant\b/);
  }
});

test('rarity comparisons use the normal rarity ladder', async () => {
  const rows = await apiCards({
    rarity: 'rare',
    rarityOperator: '>=',
    unique: 'prints',
    limit: 25,
  });

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(['rare', 'mythic'].includes(row.rarity), `${row.name} has rarity ${row.rarity}`);
  }
});

test('artist and art ID filters include face-level matches', async () => {
  const [candidate] = await sql`
    SELECT f.card_id AS id, f.artist, f.art_id
    FROM card_faces f
    WHERE f.artist IS NOT NULL
      AND f.art_id IS NOT NULL
    ORDER BY f.card_id, f.face_index
    LIMIT 1
  `;

  assert.ok(candidate);

  const artistRows = await apiCards({
    id: candidate.id,
    artist: candidate.artist,
    unique: 'prints',
    limit: 1,
  });
  assert.equal(artistRows.length, 1);

  const artRows = await apiCards({
    id: candidate.id,
    artId: candidate.art_id,
    unique: 'prints',
    limit: 1,
  });
  assert.equal(artRows.length, 1);
});

test('collector number and release-year filters compose with set filters', async () => {
  const [candidate] = await sql`
    SELECT c.id, c.set_code, c.collector_number, EXTRACT(YEAR FROM s.release_date)::int AS year
    FROM cards c
    JOIN sets s ON s.code = c.set_code
    WHERE c.collector_number IS NOT NULL
      AND s.release_date IS NOT NULL
    ORDER BY s.release_date DESC, c.id
    LIMIT 1
  `;

  assert.ok(candidate);

  const rows = await apiCards({
    set: candidate.set_code,
    collectorNumber: candidate.collector_number,
    year: candidate.year,
    unique: 'prints',
    limit: 10,
  });

  assert.ok(rows.some((row) => row.id === candidate.id));
  assert.ok(rows.every((row) => row.set_code === candidate.set_code));
});

test('promo and multiface predicates map to real catalog attributes', async () => {
  const promoRows = await apiCards({ isPromo: true, unique: 'prints', limit: 25 });
  assert.ok(promoRows.length > 0);
  assert.ok(promoRows.every((row) => row.is_promo === true));

  const multifaceRows = await apiCards({ isMultiface: true, unique: 'prints', limit: 25 });
  assert.ok(multifaceRows.length > 0);
  assert.ok(multifaceRows.every((row) => row.is_multiface === true));
});

test('format filters default to legal-card use cases', async () => {
  const rows = await apiCards({
    format: 'modern',
    legality: 'legal',
    limit: 25,
  });

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.legalities.modern, 'legal', `${row.name} is not modern legal`);
  }
});

test('token searches return token catalog rows explicitly', async () => {
  const rows = await apiCards({
    isToken: true,
    unique: 'prints',
    limit: 25,
  });

  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.is_token === true));
});

test('collection-only search limits results to owned print IDs', async () => {
  const rows = await apiCards({
    exact: 'Lightning Bolt',
    unique: 'prints',
    limit: 10,
    collection: {
      ids: [605],
      mode: 'only',
      match: 'prints',
    },
  });

  assert.deepEqual(rows.map((row) => row.id), [605]);
  assert.ok(rows.every((row) => row.in_collection === true));
});

test('collection-exclude search removes owned print IDs', async () => {
  const rows = await apiCards({
    exact: 'Lightning Bolt',
    unique: 'prints',
    limit: 10,
    collection: {
      ids: [605],
      mode: 'exclude',
      match: 'prints',
    },
  });

  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.id !== 605));
  assert.ok(rows.every((row) => row.in_collection === false));
});

test('collection-rank search orders owned print IDs first', async () => {
  const rows = await apiCards({
    exact: 'Lightning Bolt',
    unique: 'prints',
    order: 'name',
    limit: 5,
    collection: {
      ids: [1195],
      mode: 'rank',
      match: 'prints',
    },
  });

  assert.ok(rows.length > 1);
  assert.equal(rows[0].id, 1195);
  assert.equal(rows[0].in_collection, true);
  assert.ok(rows.slice(1).some((row) => row.in_collection === false));
});

test('collection oracle matching includes alternate printings', async () => {
  const rows = await apiCards({
    exact: 'Lightning Bolt',
    unique: 'prints',
    limit: 10,
    collection: {
      ids: [605],
      mode: 'only',
      match: 'oracle',
    },
  });

  assert.ok(rows.length > 1);
  assert.ok(rows.every((row) => row.name === 'Lightning Bolt'));
  assert.ok(rows.every((row) => row.in_collection === true));
});

test('collection counts use the filtered search universe', async () => {
  const count = await apiCardCount({
    exact: 'Lightning Bolt',
    unique: 'prints',
    collection: {
      ids: [605, 1195],
      mode: 'only',
      match: 'prints',
    },
  });

  assert.equal(count, 2);
});

test('high-volume collection searches run against deterministic 2K and 10K pools', {
  timeout: 60_000,
}, async () => {
  const pool2k = await deterministicCardPool(2_000, 0);
  const pool10k = await deterministicCardPool(10_000, 7_919);
  const cases = [
    {
      name: 'exact prints',
      params: {
        exact: 'Lightning Bolt',
        unique: 'prints',
        limit: 10,
      },
    },
    {
      name: 'ranked name search',
      params: {
        q: 'dragon',
        unique: 'cards',
        order: 'rank',
        limit: 10,
      },
    },
    {
      name: 'broad type search',
      params: {
        type: 'creature',
        unique: 'prints',
        limit: 10,
      },
    },
    {
      name: 'legality search',
      params: {
        format: 'modern',
        legality: 'legal',
        unique: 'cards',
        limit: 10,
      },
    },
  ];

  for (const [label, ids] of [
    ['2k', withKnownCard(pool2k, 605)],
    ['10k', withKnownCard(pool10k, 605)],
  ]) {
    for (const mode of ['only', 'exclude', 'rank']) {
      for (const testCase of cases) {
        const start = performance.now();
        const params = {
          ...testCase.params,
          collection: {
            ids,
            mode,
            match: 'prints',
          },
        };
        const rows = await apiCards(params);
        const count = await apiCardCount(params);
        const elapsed = Number((performance.now() - start).toFixed(3));

        console.log(`collection ${label} ${mode} ${testCase.name}: ${elapsed}ms`);
        assert.ok(count >= rows.length, JSON.stringify({ label, mode, case: testCase.name }));
      }
    }
  }
});

test('normal card searches exclude tokens unless explicitly included', async () => {
  const defaultRows = await apiCards({
    q: 'token',
    unique: 'prints',
    limit: 25,
  });
  const includedRows = await apiCards({
    q: 'token',
    includeTokens: true,
    unique: 'prints',
    limit: 50,
  });

  assert.ok(defaultRows.length > 0);
  assert.ok(defaultRows.every((row) => row.is_token !== true));
  assert.ok(includedRows.some((row) => row.is_token === true));
});

test('cards and products use separate CDN path families', async () => {
  const [card] = await apiCards({ limit: 1 });
  const productQuery = buildProductsQuery({ id: 1, limit: 1, offset: 0 });
  const [product] = await sql.unsafe(productQuery.text, [...productQuery.values]);

  assert.match(card.image_url, /^https:\/\/r2\.videreproject\.com\/cards\/\d+-300px\.png$/);
  assert.equal(product.id, 1);
  assert.equal(product.image_url, 'https://r2.videreproject.com/products/1-300px.png');
});

test('multi-face cards expose ordered face rows', async () => {
  const [candidate] = await sql`
    SELECT card_id AS id
    FROM card_faces
    GROUP BY card_id
    HAVING count(*) > 1
    ORDER BY card_id
    LIMIT 1
  `;

  assert.ok(candidate);

  const facesQuery = buildCardFacesQuery({ id: candidate.id });
  const faces = await sql.unsafe(facesQuery.text, [...facesQuery.values]);

  assert.ok(faces.length > 1);
  assert.deepEqual(
    faces.map((face) => face.face_index),
    [...faces.keys()]
  );
});

async function deterministicCardPool(limit, salt) {
  const rows = await sql`
    SELECT id
    FROM cards
    WHERE coalesce(is_token, FALSE) = FALSE
    ORDER BY md5((id + ${salt}::int)::text)
    LIMIT ${limit}::int
  `;

  return rows.map((row) => Number(row.id));
}

function withKnownCard(ids, id) {
  return [id, ...ids.filter((value) => value !== id)].slice(0, ids.length);
}

const fetchCardRoute = async (path) => {
  const response = await fetch(new URL(path, apiBaseUrl));
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
};

const postCardRoute = async (path, payload) => {
  const response = await fetch(new URL(path, apiBaseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
};

const postCardRouteStatus = async (path, payload, status) => {
  const response = await fetch(new URL(path, apiBaseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();

  assert.equal(response.status, status, JSON.stringify(body));
  return body;
};

const fetchCardRouteStatus = async (path, status) => {
  const response = await fetch(new URL(path, apiBaseUrl));
  const body = await response.json();

  assert.equal(response.status, status, JSON.stringify(body));
  return body;
};

test('HTTP /cards q parser applies catalog ID, artist, and art ID terms together', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards?q=${encodeURIComponent('cid:605 artist:"Christopher Rush" artid:147')}&unique=prints&limit=5`);

  assert.equal(body.object, 'list');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 605);
  assert.equal(body.data[0].name, 'Lightning Bolt');
  assert.equal(body.data[0].artist, 'Christopher Rush');
  assert.equal(body.data[0].art_id, 147);
});

test('HTTP POST /cards/search supports collection-only searches', { skip: !apiBaseUrl }, async () => {
  const body = await postCardRoute(
    `/cards/search?exact=${encodeURIComponent('Lightning Bolt')}&unique=prints&limit=5`,
    {
      collection: {
        ids: [605],
        mode: 'only',
        match: 'prints',
      },
    }
  );

  assert.equal(body.object, 'list');
  assert.deepEqual(body.data.map((card) => card.id), [605]);
  assert.equal(body.data[0].in_collection, true);
  assert.deepEqual(body.parameters.collection, {
    mode: 'only',
    match: 'prints',
    size: 1,
  });
});

test('HTTP POST /cards/search rejects invalid collection IDs', { skip: !apiBaseUrl }, async () => {
  const body = await postCardRouteStatus('/cards/search', {
    collection: {
      ids: [605, -1],
    },
  }, 400);

  assert.equal(body.message, 'collection.ids must contain positive integer MTGO catalog IDs.');
});

test('HTTP /cards q parser applies type inclusion and exclusion', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards?q=${encodeURIComponent('t:artifact -t:creature')}&limit=10`);

  assert.ok(body.data.length > 0);
  for (const card of body.data) {
    assert.match(card.type_line.toLowerCase(), /\bartifact\b/);
    assert.doesNotMatch(card.type_line.toLowerCase(), /\bcreature\b/);
  }
});

test('HTTP /cards omits exact totals unless requested', { skip: !apiBaseUrl }, async () => {
  const fast = await fetchCardRoute(`/cards?q=${encodeURIComponent('t:artifact -t:creature')}&limit=10`);
  const exact = await fetchCardRoute(`/cards?q=${encodeURIComponent('t:artifact -t:creature')}&limit=10&include_total=true`);

  assert.equal(fast.meta.total, null);
  assert.equal(typeof fast.meta.has_more, 'boolean');
  assert.equal(fast.meta.next_offset, fast.meta.has_more ? 10 : null);
  assert.equal(typeof exact.meta.total, 'number');
  assert.ok(exact.meta.total >= exact.data.length);
});

test('HTTP /cards q parser applies release-year comparisons', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards?q=${encodeURIComponent('!"Lightning Bolt" year<1994')}&unique=prints&limit=10`);

  assert.ok(body.data.length > 0);
  for (const card of body.data) {
    assert.equal(card.name, 'Lightning Bolt');
    assert.ok(new Date(card.set_release_date).getUTCFullYear() < 1994);
  }
});

test('HTTP /cards q parser applies mana-cost terms', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards?q=${encodeURIComponent('!"Lightning Bolt" m:{R}')}&unique=prints&limit=10`);

  assert.ok(body.data.length > 0);
  for (const card of body.data) {
    assert.equal(card.name, 'Lightning Bolt');
    assert.equal(card.mana_cost, '{R}');
  }
});

test('HTTP /cards q parser applies rarity comparisons', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards?q=${encodeURIComponent('r>=rare')}&unique=prints&limit=10`);

  assert.ok(body.data.length > 0);
  for (const card of body.data) {
    assert.ok(['rare', 'mythic'].includes(card.rarity), `${card.name} has rarity ${card.rarity}`);
  }
});

test('HTTP /cards q parser applies split-card predicates', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards?q=${encodeURIComponent('is:split')}&limit=5`);

  assert.ok(body.data.length > 0);
  assert.ok(body.data.every((card) => card.is_split === true));
});

test('HTTP /cards/named exact lookup returns one exact-name card', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards/named?exact=${encodeURIComponent('Lightning Bolt')}`);

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].name, 'Lightning Bolt');
  assert.equal(body.data[0].printed_name, null);
  assert.equal(body.data[0].display_name, 'Lightning Bolt');
});

test('HTTP /cards/named exact lookup returns printed-name cards by printed title', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards/named?exact=${encodeURIComponent('Thrum of the Vestige')}`);

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 139943);
  assert.equal(body.data[0].name, 'Lightning Bolt');
  assert.equal(body.data[0].printed_name, 'Thrum of the Vestige');
  assert.equal(body.data[0].display_name, 'Thrum of the Vestige');
});

test('HTTP /cards/named fuzzy lookup returns one ranked card', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards/named?fuzzy=${encodeURIComponent('lightnng bolt')}`);

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].name, 'Lightning Bolt');
});

test('HTTP /cards/named requires exactly one lookup mode', { skip: !apiBaseUrl }, async () => {
  const missing = await fetchCardRouteStatus('/cards/named', 400);
  assert.equal(missing.message, 'Provide exactly one of exact or fuzzy.');

  const both = await fetchCardRouteStatus(`/cards/named?exact=${encodeURIComponent('Lightning Bolt')}&fuzzy=${encodeURIComponent('lightnng bolt')}`, 400);
  assert.equal(both.message, 'Provide exactly one of exact or fuzzy.');
});

test('HTTP /cards/autocomplete returns matching card names', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards/autocomplete?q=${encodeURIComponent('lightn')}&limit=10`);

  assert.ok(body.data.includes('Lightning Bolt'));
  assert.equal(new Set(body.data).size, body.data.length);
});

test('HTTP /cards/random returns one filtered card detail', { skip: !apiBaseUrl }, async () => {
  const body = await fetchCardRoute(`/cards/random?exact=${encodeURIComponent('Lightning Bolt')}&unique=prints`);

  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].name, 'Lightning Bolt');
  assert.ok(Array.isArray(body.data[0].faces));
});
