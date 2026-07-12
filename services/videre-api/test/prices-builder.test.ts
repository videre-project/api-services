import assert from 'node:assert/strict';
import test from 'node:test';

import postgres from 'postgres';

import {
  buildBatchPricesQuery,
  buildLatestPriceQuery,
  buildPriceHistoryQuery
} from '../src/db/queries/prices/buildPricesQuery.ts';

type PriceRouteBody = {
  object: 'list' | 'error';
  data: Array<{
    id: number;
    price_date: string;
    source: string;
    url: string | null;
    kind: string | null;
  }>;
  meta: { missing_ids: number[] };
  parameters: { ids: { size: number } };
  message: string;
};

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
  assert.match(query.text, /CROSS JOIN LATERAL/);
  assert.doesNotMatch(query.text, /DISTINCT ON/);
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
  const latestDate = await latestGoatBotsPriceDate();
  if (!latestDate) {
    return;
  }

  const candidateId = await knownPricedCatalogId(latestDate);
  if (!candidateId) {
    return;
  }

  const candidate = {
    catalog_id: candidateId,
    price_date: latestDate,
  };

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

test('high-volume price batch lookups run against deterministic 2K and 10K pools', {
  timeout: 60_000,
}, async () => {
  const latestDate = await latestGoatBotsPriceDate();
  if (!latestDate) {
    return;
  }

  const knownId = await knownPricedCatalogId(latestDate);
  if (!knownId) {
    return;
  }

  const pool2k = await deterministicPricedCatalogPool(2_000, 0, latestDate);
  const pool10k = await deterministicPricedCatalogPool(10_000, 7_919, latestDate);
  const cases = [
    {
      name: 'latest',
      date: 'latest',
    },
    {
      name: 'dated latest',
      date: latestDate,
    },
  ];

  for (const [label, ids] of [
    ['2k', withKnownCatalogId(pool2k, knownId)],
    ['10k', withKnownCatalogId(pool10k, knownId)],
  ] as const) {
    for (const testCase of cases) {
      const start = performance.now();
      const rows = await apiBatchPrices({
        ids,
        date: testCase.date,
      });
      const elapsed = Number((performance.now() - start).toFixed(3));
      const returnedIds = new Set(rows.map((row) => Number(row.id)));

      console.log(`prices ${label} ${testCase.name}: ${elapsed}ms`);
      assert.equal(rows.length, ids.length, JSON.stringify({ label, case: testCase.name }));
      assert.ok(ids.every((id) => returnedIds.has(id)), JSON.stringify({ label, case: testCase.name }));
    }
  }
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

test('HTTP POST /prices reports missing IDs', { skip: !apiBaseUrl }, async () => {
  const body = await postPriceRoute('/prices', {
    ids: [1, 11],
    date: 'latest',
  });

  assert.equal(body.object, 'list');
  assert.deepEqual(body.data.map((row) => row.id), [11]);
  assert.deepEqual(body.meta.missing_ids, [1]);
});

test('HTTP POST /prices accepts collection ID bodies', { skip: !apiBaseUrl }, async () => {
  const body = await postPriceRoute('/prices', {
    collection: {
      ids: [1, 11],
    },
  });

  assert.equal(body.object, 'list');
  assert.deepEqual(body.data.map((row) => row.id), [11]);
  assert.deepEqual(body.parameters.ids, { size: 2 });
  assert.deepEqual(body.meta.missing_ids, [1]);
});

test('HTTP POST /prices validates empty ID lists', { skip: !apiBaseUrl }, async () => {
  const body = await postPriceRouteStatus('/prices', { ids: [] }, 400);

  assert.equal(body.object, 'error');
  assert.match(body.message, /ids cannot be empty/);
});

async function apiBatchPrices(params: Parameters<typeof buildBatchPricesQuery>[0]) {
  const query = buildBatchPricesQuery(params);

  return sql.unsafe(query.text, [...query.values]);
}

async function latestGoatBotsPriceDate(): Promise<string | null> {
  const [row] = await sql`
    SELECT max(price_date)::text AS price_date
    FROM catalog_price_history
    WHERE source = 'goatbots'
  `;

  return row?.price_date ?? null;
}

async function deterministicPricedCatalogPool(limit: number, salt: number, priceDate: string): Promise<number[]> {
  const rows = await sql`
    SELECT catalog_id
    FROM catalog_price_history
    WHERE source = 'goatbots'
      AND price_date = ${priceDate}::date
    ORDER BY md5((catalog_id + ${salt}::int)::text)
    LIMIT ${limit}::int
  `;

  return rows.map((row) => Number(row.catalog_id));
}

async function knownPricedCatalogId(priceDate: string): Promise<number | null> {
  const [row] = await sql`
    SELECT catalog_id
    FROM catalog_price_history
    WHERE source = 'goatbots'
      AND price_date = ${priceDate}::date
    ORDER BY catalog_id
    LIMIT 1
  `;

  return row ? Number(row.catalog_id) : null;
}

function withKnownCatalogId(ids: readonly number[], id: number): number[] {
  return [id, ...ids.filter((value) => value !== id)].slice(0, ids.length);
}

async function fetchPriceRoute(path: string) {
  const response = await fetch(new URL(path, apiBaseUrl ?? 'http://localhost'));
  const body = await response.json() as PriceRouteBody;

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
  const body = await response.json() as PriceRouteBody;

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
  const body = await response.json() as PriceRouteBody;

  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}
