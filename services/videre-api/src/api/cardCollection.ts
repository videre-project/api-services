/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import type { IRequest } from 'itty-router';

import type {
  CardCollectionFilter,
  CardCollectionMatchMode,
  CardCollectionMode
} from '@/db/queries/cards/types';
import { MAX_INLINE_COLLECTION_IDS } from '@/queryPolicy';
import { Error } from '@/responses';

export async function readCardCollection(
  req: IRequest
): Promise<CardCollectionFilter | Response | null> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return Error(400, 'Could not read request body.');
  }

  if (text.trim() === '') {
    return null;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Error(400, 'Request body must be valid JSON.');
  }

  if (!isRecord(body) || body.collection === undefined || body.collection === null) {
    return null;
  }

  if (!isRecord(body.collection)) {
    return Error(400, 'collection must be an object.');
  }

  return parseCollection(body.collection);
}

function parseCollection(collection: Record<string, unknown>): CardCollectionFilter | Response {
  if (!Array.isArray(collection.ids)) {
    return Error(400, 'collection.ids must be an array of MTGO catalog IDs.');
  }

  if (collection.ids.length > MAX_INLINE_COLLECTION_IDS) {
    return Error(400, `collection.ids cannot contain more than ${MAX_INLINE_COLLECTION_IDS} IDs.`);
  }

  const ids = normalizeIds(collection.ids);
  if (ids instanceof Response) {
    return ids;
  }

  const mode = parseMode(collection.mode);
  if (mode instanceof Response) {
    return mode;
  }

  const match = parseMatch(collection.match);
  if (match instanceof Response) {
    return match;
  }

  return {
    ids,
    mode,
    match,
  };
}

function normalizeIds(ids: readonly unknown[]): readonly number[] | Response {
  const normalized = new Set<number>();

  for (const id of ids) {
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      return Error(400, 'collection.ids must contain positive integer MTGO catalog IDs.');
    }

    normalized.add(id);
  }

  return [...normalized];
}

function parseMode(value: unknown): CardCollectionMode | Response {
  if (value === undefined || value === null || value === '') {
    return 'only';
  }

  if (value === 'only' || value === 'exclude' || value === 'rank') {
    return value;
  }

  return Error(400, 'collection.mode must be one of only, exclude, or rank.');
}

function parseMatch(value: unknown): CardCollectionMatchMode | Response {
  if (value === undefined || value === null || value === '') {
    return 'prints';
  }

  if (value === 'prints' || value === 'oracle') {
    return value;
  }

  return Error(400, 'collection.match must be one of prints or oracle.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
