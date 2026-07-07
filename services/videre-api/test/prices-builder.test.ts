import assert from 'node:assert/strict';
import test from 'node:test';

import postgres from 'postgres';

import {
  buildBatchPricesQuery,
  buildLatestPriceQuery,
  buildPriceHistoryQuery
} from '../src/db/queries/prices/buildPricesQuery.ts';

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
const apiBaseUrl = process.env.VIDERE_API_BASE_URL;

test.after(async () => {
  await sql.end({ timeout: 5 });
});

test('price batch SQL keeps catalog IDs parameterized', () => {
  const query = buildBatchPricesQuery({
    ids: [1, 605, 1195],
    date: 'latest',
  });

  assert.match(query.text, /jsonb_array_elements_text\(\(\$\d+\)::text::jsonb\)/);
  assert.doesNotMatch(query.text, /1195/);
  assert.ok(query.values.includes('[1,605,1195]'));
});

test('price date SQL casts API date strings to date values', () => {
  const history = buildPriceHistoryQuery({
    id: 605,
    from: '2026-07-01',
    to: '2026-07-06',
  });
  const batch = buildBatchPricesQuery({
    ids: [605],
    date: '2026-07-06',
  });

  assert.match(history.text, /"ph"."price_date" >= \$\d+::date/);
  assert.match(history.text, /"ph"."price_date" <= \$\d+::date/);
  assert.match(batch.text, /"ph"."price_date" = \$\d+::date/);
});

test('builder-backed price SQL handles latest, history, and batch shapes when prices exist', async () => {
  const [candidate] = await sql`
    SELECT catalog_id, max(price_date)::text AS price_date
    FROM catalog_price_history
    GROUP BY catalog_id
    ORDER BY max(price_date) DESC, catalog_id
    LIMIT 1
  `;

  if (!candidate) {
    return;
  }

  const latest = buildLatestPriceQuery({ id: candidate.catalog_id });
  const latestRows = await sql.unsafe(latest.text, [...latest.values]);
  assert.equal(latestRows.length, 1);
  assert.equal(latestRows[0].id, candidate.catalog_id);

  const history = buildPriceHistoryQuery({
    id: candidate.catalog_id,
    from: candidate.price_date,
    to: candidate.price_date,
    limit: 10,
    offset: 0,
  });
  const historyRows = await sql.unsafe(history.text, [...history.values]);
  assert.ok(historyRows.length > 0);
  assert.ok(historyRows.every((row) => row.id === candidate.catalog_id));

  const batch = buildBatchPricesQuery({
    ids: [candidate.catalog_id, 1],
    date: 'latest',
  });
  const batchRows = await sql.unsafe(batch.text, [...batch.values]);
  assert.ok(batchRows.some((row) => row.id === candidate.catalog_id));
});

test('HTTP /prices/:id returns latest price metadata', { skip: !apiBaseUrl }, async () => {
  const body = await fetchPriceRoute('/prices/11');

  assert.equal(body.object, 'list');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 11);
  assert.equal(body.data[0].price_date, '2026-07-06');
  assert.equal(body.data[0].source, 'goatbots');
  assert.equal(body.data[0].url, 'https://www.goatbots.com/');
  assert.equal(body.data[0].kind, 'product');
});

test('HTTP /prices/:id/history supports exact date ranges', { skip: !apiBaseUrl }, async () => {
  const body = await fetchPriceRoute('/prices/11/history?from=2026-07-06&to=2026-07-06&limit=5');

  assert.equal(body.object, 'list');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 11);
  assert.equal(body.data[0].price_date, '2026-07-06');
});

test('HTTP POST /prices/search reports missing IDs', { skip: !apiBaseUrl }, async () => {
  const body = await postPriceRoute('/prices/search', {
    ids: [1, 11],
    date: 'latest',
  });

  assert.equal(body.object, 'list');
  assert.deepEqual(body.data.map((row) => row.id), [11]);
  assert.deepEqual(body.meta.missing_ids, [1]);
});

test('HTTP POST /prices/search validates empty ID lists', { skip: !apiBaseUrl }, async () => {
  const body = await postPriceRouteStatus('/prices/search', { ids: [] }, 400);

  assert.equal(body.object, 'error');
  assert.match(body.message, /ids cannot be empty/);
});

async function fetchPriceRoute(path: string) {
  const response = await fetch(new URL(path, apiBaseUrl ?? 'http://localhost'));
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

async function postPriceRoute(path: string, payload: unknown) {
  const response = await fetch(new URL(path, apiBaseUrl ?? 'http://localhost'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

async function postPriceRouteStatus(path: string, payload: unknown, status: number) {
  const response = await fetch(new URL(path, apiBaseUrl ?? 'http://localhost'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();

  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}
