# Matches API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The matches API returns round-by-round match records for imported MTGO events. Each row is from one player's side of a pairing and includes match result, game-level results when available, and joined deck/archetype fields for both players when available.

```text
GET /matches/:format?
```

The endpoint returns the match rows selected by `format`, `event_id`, `min_date`, and `max_date`. Each row is oriented around the `player` field, so `result`, `record`, and `games` are from that player's perspective.

## Filters

```text
/matches/modern
/matches/modern?event_id=12845711
/matches/pioneer?min_date=2026-06-01&max_date=2026-06-26
/matches/modern?player=Manatraders&archetype=Rakdos
```

Supported query parameters are `format`, `event_id`, `min_date`, `max_date`, `player`, `archetype`, `limit`, and `offset`.

`format` can be supplied as the path segment or as a query parameter. If both are present, the path value wins.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` select events by event date. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

`player` matches either side of the pairing. `archetype` matches either side's deck name or archetype label. Both are case-insensitive contains filters.

`offset` and `limit` page through large event windows.

Responses use the standard list envelope with `meta.limit`, `meta.offset`, `meta.has_more`, and `meta.next_offset`. For full-event exports, keep requesting the same route with `offset=meta.next_offset` until `has_more` is false.

## Response Shape

Each match row includes:

```text
id
event_id
event_name
date
format
event_type
round
player
opponent
record
result
isbye
games
player_deck_id
player_deck_name
player_archetype
player_archetype_id
opponent_deck_id
opponent_deck_name
opponent_archetype
opponent_archetype_id
```

`result` is from `player`'s perspective. `games` is an ordered array of per-game tuple strings in the form `(game_id,result)` when game-level source data is available. Bye rows and rows where a player decklist cannot be joined can have missing deck and archetype fields.

Example response, abbreviated from real API output:

```json
{
  "object": "list",
  "parameters": {
    "format": "Modern",
    "event_id": 12845711,
    "min_date": "2026-05-31T00:00:00.000Z",
    "max_date": "2026-07-01T00:00:00.000Z",
    "limit": 1
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 124,
    "row_count": 1,
    "total": null,
    "limit": 1,
    "offset": 0,
    "has_more": true,
    "next_offset": 1
  },
  "data": [
    {
      "id": 288120866,
      "event_id": 12845711,
      "round": 1,
      "player": "albertoSD",
      "opponent": "GyaraMos6812",
      "record": "0-2-0",
      "result": "loss",
      "isbye": false,
      "games": [
        "(954950666,loss)",
        "(954951628,loss)"
      ],
      "date": "2026-06-30T00:00:00.000Z",
      "format": "Modern",
      "event_name": "Modern Challenge 64",
      "event_type": "Challenge",
      "player_deck_id": null,
      "player_deck_name": null,
      "player_archetype": null,
      "player_archetype_id": null,
      "opponent_deck_id": 58586529,
      "opponent_deck_name": "Izzet Prowess",
      "opponent_archetype": "Izzet Prowess",
      "opponent_archetype_id": 18619
    }
  ]
}
```
