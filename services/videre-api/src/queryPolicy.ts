/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { clampInteger } from '@videre/sql-builder';

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_INLINE_COLLECTION_IDS = 10_000;
export const MAX_LIST_LIMIT = 500;

export const DEFAULT_AUTOCOMPLETE_LIMIT = 20;
export const MAX_AUTOCOMPLETE_LIMIT = 100;

export const clampListLimit = (value: unknown): number =>
  clampInteger(value, {
    defaultValue: DEFAULT_LIST_LIMIT,
    min: 0,
    max: MAX_LIST_LIMIT,
  });

export const clampAutocompleteLimit = (value: unknown): number =>
  clampInteger(value, {
    defaultValue: DEFAULT_AUTOCOMPLETE_LIMIT,
    min: 0,
    max: MAX_AUTOCOMPLETE_LIMIT,
  });

export const clampOffset = (value: unknown): number =>
  clampInteger(value, {
    defaultValue: 0,
    min: 0,
  });
