/* @file
 * Copyright (c) 2026, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  compile,
  jsonBuildObjectFromColumns,
  sql as sqlFragment,
  type CompiledSql
} from '@videre/sql-builder';

import type { PendingSql, Sql } from '@/db/postgres';

import { buildCardFacesQuery } from './buildCardFacesQuery.ts';
import { buildCardsQuery } from './buildCardsQuery.ts';
import { CARD_FACE_FIELDS, type ICardDetail } from './types.ts';

const cardFaceJsonObject = compile(jsonBuildObjectFromColumns('f', CARD_FACE_FIELDS));


export const buildCardQuery = (
  params: { [key: string]: any }
): CompiledSql => {
  const card = buildCardsQuery(params);
  const faces = buildCardFacesQuery(params);

  return compile(sqlFragment`
    SELECT
      c.*,
      COALESCE((
        SELECT json_agg(
          ${cardFaceJsonObject}
          ORDER BY f.face_index
        )
        FROM (${faces}) f
      ), '[]'::json) AS faces
    FROM (${card}) c
  `);
};

export const getCard = (
  sql: Sql,
  params: { [key: string]: any }
): PendingSql<ICardDetail[]> => {
  const query = buildCardQuery(params);

  return sql.unsafe(query.text, [...query.values]);
};

export default getCard;
