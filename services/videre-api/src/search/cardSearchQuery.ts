/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { parseSortDirection } from '../db/searchOptions.ts';
import { normalizeCardFormatCode, normalizeCardLegality, normalizeCardRarity } from '../db/validators/index.ts';
import {
  assignIfMissing,
  stripQuotes,
  tokenizeSearchQuery as tokenize,
  type SearchParams
} from './searchQuery.ts';

const COLOR_KEYS = new Set(['c', 'color', 'colors']);
const IDENTITY_KEYS = new Set(['id', 'identity', 'color_identity']);
const MANA_COST_KEYS = new Set(['m', 'mana', 'cost', 'mana_cost']);
const DATE_COMPARISON_KEYS = new Map([
  ['date', 'released'],
  ['released', 'released'],
  ['release', 'released'],
]);
const NUMERIC_COMPARISON_KEYS = new Map([
  ['mv', 'mana_value'],
  ['cmc', 'mana_value'],
  ['manavalue', 'mana_value'],
  ['mana_value', 'mana_value'],
  ['pow', 'power'],
  ['power', 'power'],
  ['tou', 'toughness'],
  ['toughness', 'toughness'],
  ['loy', 'loyalty'],
  ['loyalty', 'loyalty'],
  ['def', 'defense'],
  ['defense', 'defense'],
  ['year', 'year'],
]);
const ORDER_KEYS = new Set([
  'rank',
  'relevance',
  'name',
  'mv',
  'cmc',
  'mana',
  'mana_value',
  'set',
  'released',
  'release'
]);
const UNIQUE_KEYS = new Set([
  'prints',
  'printings',
  'cards',
  'card',
  'oracle',
  'oracles'
]);

export const applyCardSearchQuery = (params: SearchParams): SearchParams => {
  const next = { ...params };

  if (!params.q) {
    markEmptyTypeFilter(next);
    return next;
  }

  const textTerms: string[] = [];

  for (const token of tokenize(String(params.q))) {
    if (!applyToken(next, token)) {
      textTerms.push(stripQuotes(token));
    }
  }

  next.q = textTerms.length > 0 ? textTerms.join(' ') : undefined;
  markEmptyTypeFilter(next);
  return next;
}

const applyToken = (params: SearchParams, token: string): boolean => {
  if (token.startsWith('!"') && token.endsWith('"')) {
    assignIfMissing(params, 'exact', stripQuotes(token.slice(1)));
    return true;
  }

  const negated = token.startsWith('-');
  const raw = negated ? token.slice(1) : token;

  const comparison = raw.match(/^([A-Za-z_]+)(<=|>=|<|>|=)(.+)$/);
  if (comparison) {
    const [, key, operator, value] = comparison;
    return applyComparison(params, key, operator, stripQuotes(value));
  }

  const tagged = raw.match(/^([A-Za-z_]+):(.+)$/);
  if (!tagged) {
    return false;
  }

  const [, rawKey, rawValue] = tagged;
  const key = rawKey.toLowerCase();
  const value = stripQuotes(rawValue);

  if (key === 'set' || key === 'e' || key === 'edition') {
    assignIfMissing(params, 'set', value);
    return true;
  }

  if (key === 'name' || key === 'n') {
    assignIfMissing(params, 'name', value);
    return true;
  }

  if (key === 'exact') {
    assignIfMissing(params, 'exact', value);
    return true;
  }

  if (key === 'type' || key === 't') {
    appendFilterValue(params, 'type', negated ? `!${value}` : value);
    return true;
  }

  if (MANA_COST_KEYS.has(key)) {
    return applyManaCostFilter(params, value.startsWith('=') ? value.slice(1) : value);
  }

  if (key === 'oracle' || key === 'o') {
    assignIfMissing(params, 'text', value);
    return true;
  }

  if (key === 'artist' || key === 'a' || key === 'illustrator') {
    assignIfMissing(params, 'artist', value);
    return true;
  }

  if (key === 'flavor' || key === 'ft') {
    assignIfMissing(params, 'flavor', value);
    return true;
  }

  if (key === 'number' || key === 'collector' || key === 'cn') {
    assignIfMissing(params, 'collector_number', value);
    return true;
  }

  if (key === 'art' || key === 'artid' || key === 'art_id') {
    const artId = Number(value);
    if (Number.isInteger(artId)) {
      assignIfMissing(params, 'art_id', artId);
      return true;
    }
  }

  if (key === 'frame' || key === 'frame_style') {
    const frameStyle = Number(value);
    if (Number.isInteger(frameStyle)) {
      assignIfMissing(params, 'frame_style', frameStyle);
      return true;
    }
  }

  if (key === 'promo' || key === 'promo_label') {
    assignIfMissing(params, 'promo_label', value);
    return true;
  }

  if (key === 'year') {
    return assignNumericComparison(params, 'year', '=', value);
  }

  if (key === 'rarity' || key === 'r') {
    const normalizedRarity = normalizeCardRarity(value);
    if (normalizedRarity) {
      assignIfMissing(params, 'rarity', normalizedRarity);
      return true;
    }
  }

  if (key === 'format' || key === 'f') {
    const normalizedFormat = normalizeCardFormatCode(value);
    if (!normalizedFormat) {
      return false;
    }

    assignIfMissing(params, 'format', normalizedFormat);
    assignIfMissing(params, 'legality', 'legal');
    return true;
  }

  if (key === 'order' || key === 'sort') {
    const normalizedOrder = normalizeOrder(value);
    if (normalizedOrder) {
      assignIfMissing(params, 'order', normalizedOrder);
      return true;
    }
  }

  if (key === 'dir' || key === 'direction') {
    const normalizedDirection = normalizeDirection(value);
    if (normalizedDirection) {
      assignIfMissing(params, 'dir', normalizedDirection);
      return true;
    }
  }

  if (key === 'unique') {
    const normalizedUnique = normalizeUnique(value);
    if (normalizedUnique) {
      assignIfMissing(params, 'unique', normalizedUnique);
      return true;
    }
  }

  const normalizedLegalityKey = normalizeCardLegality(key);
  if (normalizedLegalityKey) {
    const normalizedFormat = normalizeCardFormatCode(value);
    if (!normalizedFormat) {
      return false;
    }

    assignIfMissing(params, 'format', normalizedFormat);
    assignIfMissing(params, 'legality', normalizedLegalityKey);
    return true;
  }

  if (key === 'legality') {
    return assignLegality(params, value);
  }

  if (key === 'is') {
    const isValue = value.toLowerCase();
    if (isValue === 'token') {
      if (negated) {
        assignIfMissing(params, 'include_tokens', false);
      } else {
        assignIfMissing(params, 'is_token', true);
      }
      return true;
    }

    if (isValue === 'product') {
      assignIfMissing(params, 'is_product', !negated);
      return true;
    }

    if (isValue === 'promo') {
      assignIfMissing(params, 'is_promo', !negated);
      return true;
    }

    if (isValue === 'multiface' || isValue === 'multi-face' || isValue === 'dfc') {
      assignIfMissing(params, 'is_multiface', !negated);
      return true;
    }

    if (isValue === 'split' || isValue === 'subcard') {
      assignIfMissing(params, 'is_split', !negated);
      return true;
    }
  }

  if (key === 'catalog' || key === 'cid' || key === 'mtgoid') {
    const catalogId = Number(value);
    if (Number.isInteger(catalogId)) {
      assignIfMissing(params, 'id', catalogId);
      return true;
    }
  }

  if (COLOR_KEYS.has(key)) {
    const comparison = value.match(/^(<=|>=|=)(.+)$/);
    if (comparison) {
      return applyComparison(params, key, comparison[1], comparison[2]);
    }
    return applyComparison(params, key, '>=', value);
  }

  if (IDENTITY_KEYS.has(key)) {
    const comparison = value.match(/^(<=|>=|=)(.+)$/);
    if (comparison) {
      return applyComparison(params, key, comparison[1], comparison[2]);
    }
    return applyComparison(params, key, '<=', value);
  }

  const numericComparisonKey = NUMERIC_COMPARISON_KEYS.get(key);
  if (numericComparisonKey) {
    const comparison = value.match(/^(<=|>=|<|>|=)(.+)$/);
    if (comparison) {
      return assignNumericComparison(params, numericComparisonKey, comparison[1], comparison[2]);
    }
    return assignNumericComparison(params, numericComparisonKey, '=', value);
  }

  const dateComparisonKey = DATE_COMPARISON_KEYS.get(key);
  if (dateComparisonKey) {
    const comparison = value.match(/^(<=|>=|<|>|=)(.+)$/);
    if (comparison) {
      return assignDateComparison(params, dateComparisonKey, comparison[1], comparison[2]);
    }
    return assignDateComparison(params, dateComparisonKey, '=', value);
  }

  return false;
}

const applyComparison = (
  params: SearchParams,
  rawKey: string,
  rawOperator: string,
  value: string
): boolean => {
  const key = rawKey.toLowerCase();
  const operator = rawOperator === ':' ? undefined : rawOperator;

  if (COLOR_KEYS.has(key)) {
    assignIfMissing(params, 'colors', value);
    if (operator) assignIfMissing(params, 'colors_operator', operator);
    return true;
  }

  if (IDENTITY_KEYS.has(key)) {
    assignIfMissing(params, 'color_identity', value);
    if (operator) assignIfMissing(params, 'color_identity_operator', operator);
    return true;
  }

  if (MANA_COST_KEYS.has(key) && (!operator || operator === '=')) {
    return applyManaCostFilter(params, value);
  }

  if (key === 'rarity' || key === 'r') {
    const normalizedRarity = normalizeCardRarity(value);
    if (!normalizedRarity) {
      return false;
    }

    assignIfMissing(params, 'rarity', normalizedRarity);
    if (operator) assignIfMissing(params, 'rarity_operator', operator);
    return true;
  }

  const numericComparisonKey = NUMERIC_COMPARISON_KEYS.get(key);
  if (numericComparisonKey) {
    return assignNumericComparison(params, numericComparisonKey, operator, value);
  }

  const dateComparisonKey = DATE_COMPARISON_KEYS.get(key);
  if (dateComparisonKey) {
    return assignDateComparison(params, dateComparisonKey, operator, value);
  }

  return false;
}

const applyManaCostFilter = (params: SearchParams, value: string): boolean => {
  const manaCost = value.trim();
  if (!manaCost) {
    return false;
  }

  assignIfMissing(params, 'mana_cost', manaCost);
  return true;
}

const assignDateComparison = (
  params: SearchParams,
  key: string,
  operator: string | undefined,
  value: string
): boolean => {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return false;
  }

  assignIfMissing(params, key, value);
  if (operator) assignIfMissing(params, `${key}_operator`, operator);
  return true;
}

const assignNumericComparison = (
  params: SearchParams,
  key: string,
  operator: string | undefined,
  value: string
): boolean => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return false;
  }

  assignIfMissing(params, key, number);
  if (operator) assignIfMissing(params, `${key}_operator`, operator);
  return true;
}

const assignLegality = (params: SearchParams, value: string): boolean => {
  const [format, status, extra] = value.toLowerCase().split(':');
  if (extra !== undefined) {
    return false;
  }

  if (status === undefined) {
    const normalizedLegality = normalizeCardLegality(format);
    if (!normalizedLegality) {
      return false;
    }

    assignIfMissing(params, 'legality', normalizedLegality);
    return true;
  }

  const normalizedLegality = normalizeCardLegality(status);
  const normalizedFormat = normalizeCardFormatCode(format);
  if (!normalizedFormat || !normalizedLegality) {
    return false;
  }

  assignIfMissing(params, 'format', normalizedFormat);
  assignIfMissing(params, 'legality', normalizedLegality);
  return true;
}

const appendFilterValue = (params: SearchParams, key: string, value: string): void => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return;
  }

  if (params[key] === undefined || params[key] === null || params[key] === '') {
    params[key] = normalizedValue;
    return;
  }

  const values = String(params[key])
    .split(',')
    .map((existingValue) => existingValue.trim())
    .filter(Boolean);

  if (!values.some((existingValue) => existingValue.toLowerCase() === normalizedValue.toLowerCase())) {
    values.push(normalizedValue);
  }

  params[key] = values.join(',');
}

const markEmptyTypeFilter = (params: SearchParams): void => {
  if (!params.type) {
    return;
  }

  const included = new Set<string>();
  const excluded = new Set<string>();

  for (const rawValue of String(params.type).split(',')) {
    const value = rawValue.trim().toLowerCase();
    if (!value) {
      continue;
    }

    if (value.startsWith('!')) {
      excluded.add(value.slice(1).trim());
    } else {
      included.add(value);
    }
  }

  for (const value of included) {
    if (excluded.has(value)) {
      params.__empty = true;
      return;
    }
  }
}

const normalizeOrder = (value: string): string | undefined => {
  const key = value.toLowerCase();
  if (!ORDER_KEYS.has(key)) {
    return undefined;
  }

  if (key === 'cmc' || key === 'mv' || key === 'mana') {
    return 'mana_value';
  }

  if (key === 'release') {
    return 'released';
  }

  if (key === 'relevance') {
    return 'rank';
  }

  return key;
}

const normalizeDirection = (value: string): string | undefined => {
  return parseSortDirection(value);
}

const normalizeUnique = (value: string): string | undefined => {
  const key = value.toLowerCase();
  if (!UNIQUE_KEYS.has(key)) {
    return undefined;
  }

  return key === 'prints' || key === 'printings' ? 'prints' : 'cards';
}
