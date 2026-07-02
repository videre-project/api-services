/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { orderBy, type SqlFragment } from '@videre/sql-builder';
import {
  normalizeCardOrderMode,
  normalizeCardUniqueMode,
  normalizeSortDirection
} from '../../searchOptions.ts';
import type { CardOrderDirection, CardOrderMode, UniqueMode } from './types.ts';

export function normalizeUniqueMode(value?: string | null): UniqueMode {
  return normalizeCardUniqueMode(value);
}

export function normalizeOrderMode(value?: string | null, search?: string | null): CardOrderMode {
  return normalizeCardOrderMode(value, search ? 'rank' : 'name');
}

export function normalizeOrderDirection(
  orderMode: CardOrderMode,
  value?: string | null
): CardOrderDirection {
  return normalizeSortDirection(value, orderMode === 'released' ? 'desc' : 'asc');
}

export function candidateOrder(
  orderMode: CardOrderMode,
  direction: CardOrderDirection
): SqlFragment {
  switch (orderMode) {
    case 'rank':
      return orderBy([
        'search_rank DESC',
        'name_match_priority',
        'name NULLS LAST',
        'set_code NULLS LAST',
        'collector_number NULLS LAST',
        'id',
      ]);
    case 'mana_value':
      return orderBy([
        `mana_value ${direction} NULLS LAST`,
        'name_match_priority',
        'name NULLS LAST',
        'set_code NULLS LAST',
        'collector_number NULLS LAST',
        'id',
      ]);
    case 'released':
      return orderBy([
        `release_date ${direction} NULLS LAST`,
        'set_code NULLS LAST',
        'collector_number NULLS LAST',
        'name_match_priority',
        'name NULLS LAST',
        'id',
      ]);
    case 'set':
      return orderBy([
        `set_code ${direction} NULLS LAST`,
        'collector_number NULLS LAST',
        'name_match_priority',
        'name NULLS LAST',
        'id',
      ]);
    default:
      return orderBy([
        'name_match_priority',
        `name ${direction} NULLS LAST`,
        'set_code NULLS LAST',
        'collector_number NULLS LAST',
        'id',
      ]);
  }
}

export function cardOrder(orderMode: CardOrderMode, direction: CardOrderDirection): SqlFragment {
  switch (orderMode) {
    case 'rank':
      return orderBy([
        'cc.search_rank DESC',
        'cc.name_match_priority',
        'cc.name NULLS LAST',
        'cc.set_code NULLS LAST',
        'cc.collector_number NULLS LAST',
        'c.id',
      ]);
    case 'mana_value':
      return orderBy([
        `cc.mana_value ${direction} NULLS LAST`,
        'cc.name_match_priority',
        'cc.name NULLS LAST',
        'cc.set_code NULLS LAST',
        'cc.collector_number NULLS LAST',
        'c.id',
      ]);
    case 'released':
      return orderBy([
        `cc.release_date ${direction} NULLS LAST`,
        'cc.set_code NULLS LAST',
        'cc.collector_number NULLS LAST',
        'cc.name_match_priority',
        'cc.name NULLS LAST',
        'c.id',
      ]);
    case 'set':
      return orderBy([
        `cc.set_code ${direction} NULLS LAST`,
        'cc.collector_number NULLS LAST',
        'cc.name_match_priority',
        'cc.name NULLS LAST',
        'c.id',
      ]);
    default:
      return orderBy([
        'cc.name_match_priority',
        `cc.name ${direction} NULLS LAST`,
        'cc.set_code NULLS LAST',
        'cc.collector_number NULLS LAST',
        'c.id',
      ]);
  }
}

export function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}
