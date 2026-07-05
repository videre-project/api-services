/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import type { PendingSql, Sql } from '../../postgres.ts';

import {
  DECK_SUMMARY_ARCHETYPE_FIELDS,
  DECK_SUMMARY_DECK_FIELDS,
  EVENT_DATE_FORMAT_FIELDS,
  EVENT_FIELDS,
  type EventQueryParams,
  type IDeck,
  type IEvent,
  type IMatch,
} from './types.ts';
export type { EventQueryParams, IDeck, IEvent, IMatch } from './types.ts';

export const getEvents = (
  sql: Sql,
  params: EventQueryParams
): PendingSql<IEvent[]> => {
  return sql`
    SELECT ${eventSelectFields(sql)}
    FROM Events e
    WHERE ${eventPredicates(sql, params)}
    ORDER BY
      e.date DESC,
      e.id DESC
  `;
}

export const getDecks = (
  sql: Sql,
  params: EventQueryParams
): PendingSql<IDeck[]> => {
  const eventEntries = getEvents(sql, params);

  return sql`
    WITH
      event_entries AS (${eventEntries})
    SELECT
      a.deck_id AS id,
      ${tableFields(sql, 'a', DECK_SUMMARY_ARCHETYPE_FIELDS)},
      ${tableFields(sql, 'd', DECK_SUMMARY_DECK_FIELDS)}
    FROM Archetypes a
    INNER JOIN Decks d ON d.id = a.deck_id
    INNER JOIN event_entries e ON e.id = d.event_id
    WHERE
      e.kind <> 'League'::EventType
      AND a.archetype_id IS NOT NULL
    ORDER BY
      a.id DESC
  `;
}

export const getMatches = (
  sql: Sql,
  params: EventQueryParams
): PendingSql<IMatch[]> => {
  const eventEntries = getEvents(sql, params);

  return sql`
    WITH
      event_entries AS (${eventEntries})
    SELECT
      a1.archetype_id AS id1,
      a2.archetype_id AS id2,
      a1.deck_id,
      ${tableFields(sql, 'e', EVENT_DATE_FORMAT_FIELDS)},
      m.event_id,
      e.kind AS event_type,
      a1.archetype AS archetype1,
      ARRAY_TO_STRING(ARRAY(
        SELECT CASE
          WHEN game.result = 'win' THEN 'W'
          WHEN game.result = 'loss' THEN 'L'
          WHEN game.result = 'draw' THEN 'T'
        END
        FROM UNNEST(m.games) AS game
      ), '-') AS games,
      m.result,
      a2.archetype AS archetype2
    FROM Matches m
    INNER JOIN Decks d1 ON d1.event_id = m.event_id
                        AND d1.player = m.player
    INNER JOIN Decks d2 ON d2.event_id = m.event_id
                        AND d2.player = m.opponent
    INNER JOIN Archetypes a1 ON a1.deck_id = d1.id
    INNER JOIN Archetypes a2 ON a2.deck_id = d2.id
    INNER JOIN event_entries e ON e.id = m.event_id
    WHERE
      e.kind <> 'League'::EventType
    ORDER BY
      m.event_id,
      m.round,
      m.player
  `;
}

function eventPredicates(sql: Sql, params: EventQueryParams): PendingSql<unknown[]> {
  if (params.event_id !== undefined && params.event_id !== null) {
    return sql`e.id = ${params.event_id}`;
  }

  return sql`
    (${params.format ?? null}::FormatType IS NULL OR e.format = ${params.format ?? null}::FormatType)
    AND (${params.min_date ?? null}::date IS NULL OR e.date >= ${params.min_date ?? null}::date)
    AND (${params.max_date ?? null}::date IS NULL OR e.date <= ${params.max_date ?? null}::date)
  `;
}

function eventSelectFields(sql: Sql): PendingSql<unknown[]> {
  return tableFields(sql, 'e', EVENT_FIELDS);
}

function tableFields(
  sql: Sql,
  alias: string,
  fields: readonly string[]
): PendingSql<unknown[]> {
  return sql.unsafe(fields.map((field) => `${alias}.${field}`).join(', '));
}
