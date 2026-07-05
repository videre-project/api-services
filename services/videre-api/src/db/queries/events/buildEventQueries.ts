/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  and,
  compile,
  optional,
  orderBy,
  selectFields,
  sql,
  tableColumnFields,
  type CompiledSql,
  type SqlFragment
} from '@videre/sql-builder';
import { table } from '../../schema.g.ts';
import {
  EVENT_FIELDS,
  type EventQueryParams,
  type IDeck,
  type IEvent,
  type IMatch
} from './types.ts';

const events = table('events', 'e');
const decks = table('decks', 'd');
const archetypes = table('archetypes', 'a');
const matches = table('matches', 'm');
const deck1 = table('decks', 'd1');
const deck2 = table('decks', 'd2');
const archetype1 = table('archetypes', 'a1');
const archetype2 = table('archetypes', 'a2');

const eventSelectFields = {
  ...tableColumnFields(events, EVENT_FIELDS),
} satisfies Record<keyof IEvent, SqlFragment>;

const deckSelectFields = {
  id: archetypes.column('deck_id'),
  name: archetypes.column('name'),
  archetype: archetypes.column('archetype'),
  archetype_id: archetypes.column('archetype_id'),
  mainboard: decks.column('mainboard'),
  sideboard: decks.column('sideboard'),
} satisfies Record<keyof IDeck, SqlFragment>;

const matchSelectFields = {
  id1: archetype1.column('archetype_id'),
  id2: archetype2.column('archetype_id'),
  deck_id: archetype1.column('deck_id'),
  date: events.column('date'),
  format: events.column('format'),
  event_id: matches.column('event_id'),
  event_type: events.column('kind'),
  archetype1: archetype1.column('archetype'),
  games: sql`ARRAY_TO_STRING(ARRAY(
    SELECT CASE
      WHEN game.result = 'win' THEN 'W'
      WHEN game.result = 'loss' THEN 'L'
      WHEN game.result = 'draw' THEN 'T'
    END
    FROM UNNEST(${matches.column('games')}) AS game
  ), '-')`,
  result: matches.column('result'),
  archetype2: archetype2.column('archetype'),
} satisfies Record<keyof IMatch, SqlFragment>;

export const buildEventsQuery = (params: EventQueryParams): CompiledSql =>
  compile(sql`
    SELECT ${selectFields(eventSelectFields)}
    FROM ${events.source}
    WHERE ${eventPredicates(params)}
    ORDER BY ${orderBy([
      sql`${events.column('date')} DESC`,
      sql`${events.column('id')} DESC`,
    ])}
  `);

export const buildDecksQuery = (params: EventQueryParams): CompiledSql =>
  compile(sql`
    SELECT ${selectFields(deckSelectFields)}
    FROM ${events.source}
    INNER JOIN ${decks.source} ON ${decks.column('event_id')} = ${events.column('id')}
    INNER JOIN ${archetypes.source} ON ${archetypes.column('deck_id')} = ${decks.column('id')}
    WHERE ${and([
      eventPredicates(params),
      sql`${events.column('kind')} <> 'League'::EventType`,
      sql`${archetypes.column('archetype_id')} IS NOT NULL`,
    ])}
  `);

export const buildMatchesQuery = (params: EventQueryParams): CompiledSql =>
  compile(sql`
    SELECT ${selectFields(matchSelectFields)}
    FROM ${events.source}
    INNER JOIN ${matches.source} ON ${matches.column('event_id')} = ${events.column('id')}
    INNER JOIN ${deck1.source} ON ${deck1.column('event_id')} = ${matches.column('event_id')}
                             AND ${deck1.column('player')} = ${matches.column('player')}
    INNER JOIN ${deck2.source} ON ${deck2.column('event_id')} = ${matches.column('event_id')}
                             AND ${deck2.column('player')} = ${matches.column('opponent')}
    INNER JOIN ${archetype1.source} ON ${archetype1.column('deck_id')} = ${deck1.column('id')}
    INNER JOIN ${archetype2.source} ON ${archetype2.column('deck_id')} = ${deck2.column('id')}
    WHERE ${and([
      eventPredicates(params),
      sql`${events.column('kind')} <> 'League'::EventType`,
    ])}
  `);

function eventPredicates(params: EventQueryParams): SqlFragment {
  if (params.event_id !== undefined && params.event_id !== null) {
    return sql`${events.column('id')} = ${params.event_id}::int`;
  }

  return and([
    optional(
      params.format,
      sql`${events.column('format')} = ${params.format ?? null}::FormatType`
    ),
    optional(params.min_date, sql`${events.column('date')} >= ${params.min_date ?? null}::date`),
    optional(params.max_date, sql`${events.column('date')} <= ${params.max_date ?? null}::date`),
  ]);
}
