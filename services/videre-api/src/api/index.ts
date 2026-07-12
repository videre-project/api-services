/* @file
 * Copyright (c) 2024, The Videre Project Authors. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
*/

import { Router, cors } from 'itty-router';

import { useCache } from '@/cache';
import { withParams } from '@/parameters';
import { Error, asJSON } from '@/responses';
import { openApiResponse } from '@/openapi';

import archetypes from './archetypes';
import cards from './cards';
import decks from './decks';
import events from './events';
import matchups from './matchups';
import matches from './matches';
import metagame from './metagame';
import mtgo from './mtgo';
import prices from './prices';
import products from './products';
import sets from './sets';
import standings from './standings';


const { preflight, corsify } = cors();

export default Router({ before: [preflight], finally: [asJSON, corsify] })
  .get('*', useCache)
  .all('*', withParams)
  .get('/openapi.json', openApiResponse)
  .all('/archetypes', archetypes.fetch)
  .all('/archetypes/*', archetypes.fetch)
  .all('/cards', cards.fetch)
  .all('/cards/*', cards.fetch)
  .all('/decks', decks.fetch)
  .all('/decks/*', decks.fetch)
  .all('/events', events.fetch)
  .all('/events/*', events.fetch)
  .all('/matchups', matchups.fetch)
  .all('/matchups/*', matchups.fetch)
  .all('/matches', matches.fetch)
  .all('/matches/*', matches.fetch)
  .all('/metagame', metagame.fetch)
  .all('/metagame/*', metagame.fetch)
  .all('/mtgo', mtgo.fetch)
  .all('/mtgo/*', mtgo.fetch)
  .all('/prices', prices.fetch)
  .all('/prices/*', prices.fetch)
  .all('/products', products.fetch)
  .all('/products/*', products.fetch)
  .all('/sets', sets.fetch)
  .all('/sets/*', sets.fetch)
  .all('/standings', standings.fetch)
  .all('/standings/*', standings.fetch)
  .all('*', () => Error(404, 'Could not find the requested resource.'));
