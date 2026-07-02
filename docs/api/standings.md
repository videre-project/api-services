# Standings API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The standings API returns final event standings and tiebreaker data. Rows include event metadata, player rank, record, points, tiebreakers, and joined deck/archetype fields when a matching decklist exists.

```text
GET /standings/:format?
```

The endpoint returns standings rows selected by `format`, `event_id`, `min_date`, and `max_date`. Deck and archetype fields are joined from the matching decklist for the same event and player when that join is available.

## Filters

```text
/standings/modern
/standings/modern?event_id=12845711
/standings/pioneer?min_date=2026-06-01&max_date=2026-06-26
/standings/modern?player=Manatraders&archetype=Murktide
```

Supported query parameters are `format`, `event_id`, `min_date`, `max_date`, `player`, `archetype`, `limit`, and `offset`.

`format` can be supplied as the path segment or as a query parameter. If both are present, the path value wins.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` select events by event date. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

`player` is a case-insensitive contains filter on the standing player name. `archetype` is a case-insensitive contains filter on the joined deck name or archetype label.

`offset` and `limit` page through large event windows.

Responses use the standard list envelope with `meta.limit`, `meta.offset`, `meta.has_more`, and `meta.next_offset`. For full-event exports, keep requesting the same route with `offset=meta.next_offset` until `has_more` is false.

## Response Shape

Each standing row includes:

```text
event_id
event_name
date
format
event_type
rank
player
record
points
omwp
gwp
owp
deck_id
deck_name
archetype
archetype_id
```

`omwp`, `gwp`, and `owp` are numeric percentage tiebreaker values reported by the source data. Deck and archetype fields are included when the standing row can be joined back to a decklist for the same event/player.

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
    "exec_ms": 134,
    "row_count": 1,
    "total": null,
    "limit": 1,
    "offset": 0,
    "has_more": true,
    "next_offset": 1
  },
  "data": [
    {
      "event_id": 12845711,
      "rank": 1,
      "player": "rastaf",
      "record": "9-1-0",
      "points": 27,
      "omwp": 54.01,
      "gwp": 66.67,
      "owp": 51.62,
      "date": "2026-06-30T00:00:00.000Z",
      "format": "Modern",
      "archetype": "Boros Energy",
      "archetype_id": 25356,
      "event_name": "Modern Challenge 64",
      "event_type": "Challenge",
      "deck_id": 58586487,
      "deck_name": "Boros Energy"
    }
  ]
}
```
