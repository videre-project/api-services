/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import type {
  CardQuantityPair,
  EventType,
  FormatType,
  GameResult,
  RecordType,
  ResultType
} from '@/db/types';
import type { CI, Percentage } from '@/db/statistics';
import type { TableColumn } from '../../schema.g.ts';

const field = <T>() => undefined as unknown as T;

export type EventQueryParams = {
  readonly format?: string | null,
  readonly event_id?: number | null,
  readonly min_date?: string | null,
  readonly max_date?: string | null,
};

const eventShape = {
  id: field<number>(),
  name: field<string>(),
  date: field<Date>(),
  format: field<FormatType>(),
  kind: field<EventType>(),
  rounds: field<number>(),
  players: field<number>(),
} satisfies Partial<Record<TableColumn<'events'>, unknown>>;

export type IEvent = typeof eventShape;

export type EventField = Extract<keyof IEvent, TableColumn<'events'>>;

export const EVENT_FIELDS = Object.keys(eventShape) as readonly EventField[];

const deckSummaryArchetypeShape = {
  name: field<string>(),
  archetype: field<string>(),
  archetype_id: field<number>(),
} satisfies Partial<Record<TableColumn<'archetypes'>, unknown>>;

export type DeckSummaryArchetypeField = Extract<
  keyof typeof deckSummaryArchetypeShape,
  TableColumn<'archetypes'>
>;

export const DECK_SUMMARY_ARCHETYPE_FIELDS = Object.keys(
  deckSummaryArchetypeShape
) as readonly DeckSummaryArchetypeField[];

const deckSummaryDeckShape = {
  mainboard: field<CardQuantityPair[]>(),
  sideboard: field<CardQuantityPair[]>(),
} satisfies Partial<Record<TableColumn<'decks'>, unknown>>;

export type DeckSummaryDeckField = Extract<
  keyof typeof deckSummaryDeckShape,
  TableColumn<'decks'>
>;

export const DECK_SUMMARY_DECK_FIELDS = Object.keys(
  deckSummaryDeckShape
) as readonly DeckSummaryDeckField[];

const deckSummaryJoinedShape = {
  id: field<number>(),
};

export type IDeck = typeof deckSummaryJoinedShape
  & typeof deckSummaryArchetypeShape
  & typeof deckSummaryDeckShape;

export type IMatch = {
  id1: number,
  id2: number,
  deck_id: number,
  date: Date,
  format: FormatType,
  event_id: number,
  event_type: EventType,
  archetype1: string,
  games: string,
  result: ResultType,
  archetype2: string
};


export type EventDataQueryParams = EventQueryParams & {
  readonly player?: string | null,
  readonly archetype?: string | null,
  readonly limit?: number | null,
  readonly offset?: number | null,
};

const eventDateFormatShape = {
  date: field<Date>(),
  format: field<FormatType>(),
} satisfies Partial<Record<TableColumn<'events'>, unknown>>;

export type EventDateFormatField = Extract<
  keyof typeof eventDateFormatShape,
  TableColumn<'events'>
>;

export const EVENT_DATE_FORMAT_FIELDS = Object.keys(
  eventDateFormatShape
) as readonly EventDateFormatField[];

const eventDeckDeckShape = {
  id: field<number>(),
  event_id: field<number>(),
  player: field<string>(),
  mainboard: field<CardQuantityPair[]>(),
  sideboard: field<CardQuantityPair[]>(),
} satisfies Partial<Record<TableColumn<'decks'>, unknown>>;

export type EventDeckDeckField = Extract<
  keyof typeof eventDeckDeckShape,
  TableColumn<'decks'>
>;

export const EVENT_DECK_DECK_FIELDS = Object.keys(
  eventDeckDeckShape
) as readonly EventDeckDeckField[];

const eventArchetypeShape = {
  archetype: field<string | null>(),
  archetype_id: field<number | null>(),
} satisfies Partial<Record<TableColumn<'archetypes'>, unknown>>;

export type EventArchetypeField = Extract<
  keyof typeof eventArchetypeShape,
  TableColumn<'archetypes'>
>;

export const EVENT_ARCHETYPE_FIELDS = Object.keys(
  eventArchetypeShape
) as readonly EventArchetypeField[];

const eventDeckJoinedShape = {
  event_name: field<string>(),
  event_type: field<EventType>(),
  deck_name: field<string | null>(),
};

export type IEventDeck = typeof eventDeckDeckShape
  & typeof eventDateFormatShape
  & typeof eventArchetypeShape
  & typeof eventDeckJoinedShape;

const eventMatchMatchShape = {
  id: field<number>(),
  event_id: field<number>(),
  round: field<number>(),
  player: field<string>(),
  opponent: field<string>(),
  record: field<RecordType>(),
  result: field<ResultType>(),
  isbye: field<boolean>(),
  games: field<GameResult[]>(),
} satisfies Partial<Record<TableColumn<'matches'>, unknown>>;

export type EventMatchMatchField = Extract<
  keyof typeof eventMatchMatchShape,
  TableColumn<'matches'>
>;

export const EVENT_MATCH_MATCH_FIELDS = Object.keys(
  eventMatchMatchShape
) as readonly EventMatchMatchField[];

const eventMatchJoinedShape = {
  event_name: field<string>(),
  event_type: field<EventType>(),
  player_deck_id: field<number | null>(),
  player_deck_name: field<string | null>(),
  player_archetype: field<string | null>(),
  player_archetype_id: field<number | null>(),
  opponent_deck_id: field<number | null>(),
  opponent_deck_name: field<string | null>(),
  opponent_archetype: field<string | null>(),
  opponent_archetype_id: field<number | null>(),
};

export type IEventMatch = typeof eventMatchMatchShape
  & typeof eventDateFormatShape
  & typeof eventMatchJoinedShape;

const eventStandingStandingShape = {
  event_id: field<number>(),
  rank: field<number>(),
  player: field<string>(),
  record: field<RecordType>(),
  points: field<number>(),
  omwp: field<number | null>(),
  gwp: field<number | null>(),
  owp: field<number | null>(),
} satisfies Partial<Record<TableColumn<'standings'>, unknown>>;

export type EventStandingStandingField = Extract<
  keyof typeof eventStandingStandingShape,
  TableColumn<'standings'>
>;

export const EVENT_STANDING_STANDING_FIELDS = Object.keys(
  eventStandingStandingShape
) as readonly EventStandingStandingField[];

const eventStandingJoinedShape = {
  event_name: field<string>(),
  event_type: field<EventType>(),
  deck_id: field<number | null>(),
  deck_name: field<string | null>(),
};

export type IEventStanding = typeof eventStandingStandingShape
  & typeof eventDateFormatShape
  & typeof eventArchetypeShape
  & typeof eventStandingJoinedShape;

export type ICardStatistics = {
  card: string,
  count: number,
  percentage: Percentage,
  total: number,
  average: number
};

export type IDeckStatistics = {
  id: number,
  archetype: string,
  count: number,
  mainboard: ICardStatistics[],
  sideboard: ICardStatistics[]
};

export type IMetagame = {
  id: number,
  archetype: string,
  count: number,
  percentage: Percentage,
  match_count: number,
  match_winrate: Percentage,
  match_ci: CI,
  game_count: number,
  game_winrate: Percentage,
  game_ci: CI
};

export type IMatchup = {
  id1: string,
  id2: string,
  archetype1: string,
  archetype2: string,
  match_count: number,
  match_winrate: Percentage,
  match_ci: CI,
  game_count: number,
  game_winrate: Percentage,
  game_ci: CI
};

const matchupSummaryShape = {
  id: field<string>(),
  archetype: field<string>(),
  match_count: field<number>(),
  match_winrate: field<Percentage>(),
  match_ci: field<CI>(),
  game_count: field<number>(),
  game_winrate: field<Percentage>(),
  game_ci: field<CI>(),
};

export type IMatchupSummary = typeof matchupSummaryShape;

export type MatchupSummaryField = keyof IMatchupSummary;

export const MATCHUP_SUMMARY_FIELDS = Object.keys(
  matchupSummaryShape
) as readonly MatchupSummaryField[];

export type IMatchupMatrix = {
  id: string,
  archetype: string,
  matchups: IMatchupSummary[]
};
