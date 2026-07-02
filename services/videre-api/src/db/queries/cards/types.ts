/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import type { TableColumn } from '../../schema.g.ts';
import type {
  CardOrderDirection,
  CardOrderMode,
  CardUniqueMode
} from '../../searchOptions.ts';

const field = <T>() => undefined as unknown as T;

export type CardQueryParams = {
  readonly q?: string | null,
  readonly id?: number | null,
  readonly name?: string | null,
  readonly exact?: string | null,
  readonly set?: string | null,
  readonly colors?: string | null,
  readonly colors_operator?: string | null,
  readonly color_identity?: string | null,
  readonly color_identity_operator?: string | null,
  readonly mana_value?: number | null,
  readonly mana_value_operator?: string | null,
  readonly mana_cost?: string | null,
  readonly power?: number | null,
  readonly power_operator?: string | null,
  readonly toughness?: number | null,
  readonly toughness_operator?: string | null,
  readonly loyalty?: number | null,
  readonly loyalty_operator?: string | null,
  readonly defense?: number | null,
  readonly defense_operator?: string | null,
  readonly type?: string | null,
  readonly text?: string | null,
  readonly rarity?: string | null,
  readonly rarity_operator?: string | null,
  readonly format?: string | null,
  readonly legality?: string | null,
  readonly artist?: string | null,
  readonly flavor?: string | null,
  readonly collector_number?: string | null,
  readonly art_id?: number | null,
  readonly frame_style?: number | null,
  readonly promo_label?: string | null,
  readonly released?: string | null,
  readonly released_operator?: string | null,
  readonly year?: number | null,
  readonly year_operator?: string | null,
  readonly is_promo?: boolean | null,
  readonly is_multiface?: boolean | null,
  readonly is_split?: boolean | null,
  readonly is_token?: boolean | null,
  readonly include_tokens?: boolean | null,
  readonly unique?: string | null,
  readonly order?: string | null,
  readonly dir?: string | null,
  readonly limit?: number | null,
  readonly offset?: number | null,
  readonly collection?: CardCollectionFilter | null,
};

export type CardCollectionMode = 'only' | 'exclude' | 'rank';

export type CardCollectionMatchMode = 'prints' | 'oracle';

export type CardCollectionFilter = {
  readonly ids: readonly number[],
  readonly mode: CardCollectionMode,
  readonly match: CardCollectionMatchMode,
};

export type UniqueMode = CardUniqueMode;
export type { CardOrderDirection, CardOrderMode };

const cardColumnShape = {
  id: field<number>(),
  oracle_id: field<string>(),
  set_code: field<string | null>(),
  collector_number: field<string | null>(),
  name: field<string | null>(),
  printed_name: field<string | null>(),
  artist: field<string | null>(),
  art_id: field<number | null>(),
  mana_cost: field<string | null>(),
  mana_value: field<number | null>(),
  type_line: field<string | null>(),
  oracle_text: field<string | null>(),
  flavor_text: field<string | null>(),
  colors: field<string[]>(),
  color_identity: field<string[]>(),
  power: field<string | null>(),
  toughness: field<string | null>(),
  loyalty: field<string | null>(),
  defense: field<string | null>(),
  rarity: field<string | null>(),
  frame_style: field<number | null>(),
  promo_label: field<string | null>(),
  is_token: field<boolean | null>(),
} satisfies Partial<Record<TableColumn<'cards'>, unknown>>;

const cardComputedShape = {
  canonical_name: field<string | null>(),
  display_name: field<string | null>(),
  set_name: field<string | null>(),
  is_promo: field<boolean>(),
  is_multiface: field<boolean>(),
  is_split: field<boolean>(),
  set_release_date: field<string | null>(),
  set_type: field<string | null>(),
  legalities: field<Record<string, string>>(),
  image_url: field<string>(),
};

export type ICard = typeof cardColumnShape & typeof cardComputedShape;

export type CardColumnField = Extract<keyof typeof cardColumnShape, TableColumn<'cards'>>;

export const CARD_COLUMN_FIELDS = Object.keys(cardColumnShape) as readonly CardColumnField[];

const cardFaceShape = {
  card_id: field<number>(),
  face_index: field<number>(),
  source_catalog_id: field<number | null>(),
  name: field<string | null>(),
  printed_name: field<string | null>(),
  mana_cost: field<string | null>(),
  mana_value: field<number | null>(),
  type_line: field<string | null>(),
  oracle_text: field<string | null>(),
  flavor_text: field<string | null>(),
  colors: field<string[]>(),
  power: field<string | null>(),
  toughness: field<string | null>(),
  loyalty: field<string | null>(),
  defense: field<string | null>(),
  artist: field<string | null>(),
  art_id: field<number | null>(),
} satisfies Partial<Record<TableColumn<'card_faces'>, unknown>>;

export type ICardFace = typeof cardFaceShape;

export type CardFaceField = Extract<keyof ICardFace, TableColumn<'card_faces'>>;

export const CARD_FACE_FIELDS = Object.keys(cardFaceShape) as readonly CardFaceField[];

export type ICardDetail = ICard & {
  faces: ICardFace[]
};

export interface ICardCount {
  count: number
};

export interface ICardNameAutocomplete {
  name: string
};
