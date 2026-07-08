import assert from 'node:assert/strict';
import test from 'node:test';

import postgres from 'postgres';

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

const apiProducts = ({
  q = null,
  id = null,
  name = null,
  exact = null,
  set = null,
  type = null,
  isTradable = null,
  order = null,
  dir = null,
  limit = 25,
  offset = 0,
} = {}) => {
  const query = buildProductsQuery({
    q,
    id,
    name,
    exact,
    set,
    type,
    is_tradable: isTradable,
    order,
    dir,
    limit,
    offset,
  });

  return sql.unsafe(query.text, [...query.values]);
};

test('product lookup returns product CDN URLs', async () => {
  const [ticket] = await apiProducts({ id: 1, limit: 1 });

  assert.ok(ticket);
  assert.equal(ticket.id, 1);
  assert.equal(
    ticket.description,
    'Most events require one or more Event Tickets to enter. You can purchase Event Tickets from the Magic Online Store. Additional products may also be required to enter an event.'
  );
  assert.equal(ticket.image_url, 'https://r2.videreproject.com/products/1-300px.png');
});

test('product search includes hydrated descriptions', async () => {
  const rows = await apiProducts({ q: 'special Phantom tournaments', limit: 10 });

  assert.ok(rows.some((row) => row.id === 45196));
  assert.ok(rows.every((row) => 'description' in row));
});

test('product search can filter by MTGO product type', async () => {
  const [candidate] = await sql`
    SELECT object_type
    FROM products
    WHERE object_type IS NOT NULL
    GROUP BY object_type
    ORDER BY count(*) DESC
    LIMIT 1
  `;

  assert.ok(candidate);

  const rows = await apiProducts({ type: candidate.object_type, limit: 25 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.object_type === candidate.object_type));
});

test('product search can filter by tradability', async () => {
  const [candidate] = await sql`
    SELECT is_tradable
    FROM products
    WHERE is_tradable IS NOT NULL
    GROUP BY is_tradable
    ORDER BY count(*) DESC
    LIMIT 1
  `;

  assert.ok(candidate);

  const rows = await apiProducts({ isTradable: candidate.is_tradable, limit: 25 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.is_tradable === candidate.is_tradable));
});

test('products exclude token catalog objects', async () => {
  const rows = await apiProducts({ type: 'TOKN', limit: 5 });

  assert.equal(rows.length, 0);
});
