# Events API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The events API lists imported MTGO event records. Each row identifies the event by ID, name, date, format, kind, round count, and player count.

```text
GET /events/:format?
```

The endpoint is the event index for tournament-backed data. Each returned `id` is accepted as `event_id` on `/decks`, `/matches`, `/standings`, `/metagame`, `/archetypes`, and `/matchups`, so those routes can be scoped to the same imported event.

## Filters

```text
/events/modern
/events?format=pioneer&limit=25
/events/modern?min_date=2026-06-01&max_date=2026-06-26
/events?event_id=12845711
```

Supported query parameters are `format`, `event_id`, `min_date`, `max_date`, `limit`, and `offset`.

`format` can be supplied as the path segment or as a query parameter. If both are present, the path value wins because it is parsed as the route parameter.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` use calendar dates in `YYYY-MM-DD` form. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

`limit` controls how many event rows are returned after sorting by newest event first. `offset` and `limit` page through event history.

Responses use the standard list envelope with `meta.limit`, `meta.offset`, `meta.has_more`, and `meta.next_offset`.

## Response Shape

Each event includes:

```text
id
name
date
format
kind
rounds
players
```

`kind` is the MTGO event family, such as a League, Preliminary, Challenge, Showcase, or Qualifier. `rounds` and `players` are source event metadata.

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
    "exec_ms": 119,
    "row_count": 1,
    "total": null,
    "limit": 1,
    "offset": 0,
    "has_more": false,
    "next_offset": null
  },
  "data": [
    {
      "id": 12845711,
      "name": "Modern Challenge 64",
      "date": "2026-06-30T00:00:00.000Z",
      "format": "Modern",
      "kind": "Challenge",
      "rounds": 7,
      "players": 76
    }
  ]
}
```
