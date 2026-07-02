# Metagame API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The metagame API returns archetype presence and non-mirror win rates for a format over the selected event window. Rows contain share of field, match win rate, and game win rate.

```text
GET /metagame/:format?
```

The endpoint starts from imported match and deck data, applies the event filters, groups decks by Videre's current archetype label, then calculates non-mirror match and game win rates. The response is a summary table over the selected event window.

Related routes expose other views of the same `format`, `event_id`, `min_date`, and `max_date` selection. `/decks` returns individual decklists, and `/archetypes` groups those decklists to report card adoption inside each archetype.

Rows use the direct query envelope documented in [API Overview](index.md). The response is an array in `data`; list pagination fields such as `has_more` and `next_offset` are absent from this envelope.

## Filters

```text
/metagame/modern
/metagame?format=pioneer
/metagame/modern?min_date=2026-06-01&max_date=2026-06-26&limit=25
/metagame/modern?event_id=12845711
```

Supported query parameters are `format`, `event_id`, `min_date`, `max_date`, and `limit`.

`format` is required. It can be supplied as the path segment or as a query parameter. If both are present, the path value wins.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` select events by event date. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

The response is sorted by archetype presence in the filtered event window. `event_id` selects a single-event metagame snapshot. Date filters select a rolling metagame window.

## Response Shape

Each metagame row includes:

```text
id
archetype
count
percentage
match_count
match_winrate
match_ci
game_count
game_winrate
game_ci
```

`id` is the Videre archetype ID for the current label. `archetype` is the current label. `count` is the number of matching decklists for that archetype, and `percentage` is that count as a share of all matching decklists in the selected event window.

`match_count` and `game_count` are non-mirror sample sizes. `match_winrate` and `game_winrate` are percentages from the perspective of the row archetype. `match_ci` and `game_ci` are confidence intervals for those percentages. Mirror matches are excluded from win-rate fields because mirror results are symmetric for archetype comparison.

## Example

This response is abbreviated from real API output:

```text
/metagame/modern?min_date=2026-05-31&max_date=2026-07-01&limit=2
```

```json
{
  "parameters": {
    "format": "Modern",
    "min_date": "2026-05-31T00:00:00.000Z",
    "max_date": "2026-07-01T00:00:00.000Z",
    "limit": 2
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 166,
    "row_count": 2
  },
  "data": [
    {
      "id": 25356,
      "archetype": "Boros Energy",
      "count": 132,
      "percentage": "11.52%",
      "match_count": 547,
      "match_winrate": "51.92%",
      "match_ci": "±4.19%",
      "game_count": 1381,
      "game_winrate": "50.76%",
      "game_ci": "±2.64%"
    },
    {
      "id": 13572,
      "archetype": "Affinity",
      "count": 88,
      "percentage": "7.68%",
      "match_count": 365,
      "match_winrate": "50.41%",
      "match_ci": "±5.13%",
      "game_count": 914,
      "game_winrate": "51.14%",
      "game_ci": "±3.24%"
    }
  ]
}
```

In this response, Boros Energy has 132 matching decklists, which is 11.52% of the selected Modern event window. Its win-rate fields are calculated from 547 non-mirror matches and 1,381 non-mirror games.
