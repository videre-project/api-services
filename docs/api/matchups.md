# Matchups API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The matchups API returns archetype-versus-archetype win rates for a format over the selected event window. Each row contains one archetype and an array of opposing archetype summaries, with win rates calculated from the row archetype's perspective.

```text
GET /matchups/:format?
```

The endpoint starts from imported match rows, applies the event filters, excludes mirror matches, then groups the remaining rows by row archetype and opposing archetype.

Rows use the direct query envelope documented in [API Overview](index.md). The response is an array in `data`; list pagination fields such as `has_more` and `next_offset` are absent from this envelope.

## Filters

```text
/matchups/modern
/matchups/modern?archetype=Izzet%20Murktide
/matchups/pioneer?min_date=2026-06-01&max_date=2026-06-26
/matchups/modern?event_id=12845711
```

Supported query parameters are `format`, `archetype`, `event_id`, `min_date`, `max_date`, and `limit`.

`format` is required. It can be supplied as the path segment or as a query parameter. If both are present, the path value wins.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` select events by event date. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

Without `archetype`, the endpoint returns the top archetype rows for the filtered event window. `archetype` filters to one current Videre archetype label and sets `limit` to `1`. The value must match the current archetype label, such as `Boros Energy` or `Izzet Murktide`.

## Response Shape

Each matrix row includes:

```text
id
archetype
matchups
```

The row `id` is the Videre archetype ID for the current label. The nested opposing archetype `id` can be `null` when the source label lacks a current archetype ID.

`matchups` is an array of opposing-archetype summaries:

```text
id
archetype
match_count
match_winrate
match_ci
game_count
game_winrate
game_ci
```

`match_count` and `game_count` are the sample sizes for the pairing. `match_winrate` and `game_winrate` are percentages from the perspective of the row archetype. `match_ci` and `game_ci` are confidence intervals for those percentages. Mirror matches are excluded before these fields are calculated. The nested `matchups` array is sorted by match count, then match win rate, then game count, then game win rate.

## Example

This response is abbreviated from real API output. `// ...` marks omitted array entries.

```text
/matchups/modern?min_date=2026-05-31&max_date=2026-07-01&archetype=Boros%20Energy
```

```jsonc
{
  "parameters": {
    "format": "Modern",
    "min_date": "2026-05-31T00:00:00.000Z",
    "max_date": "2026-07-01T00:00:00.000Z",
    "limit": 1,
    "archetype": "Boros Energy"
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 135,
    "row_count": 1
  },
  "data": [
    {
      "id": 25356,
      "archetype": "Boros Energy",
      "matchups": [
        {
          "id": 13572,
          "archetype": "Affinity",
          "match_count": 50,
          "match_winrate": "60.00%",
          "match_ci": "±13.58%",
          "game_count": 125,
          "game_winrate": "55.33%",
          "game_ci": "±8.72%"
        },
        {
          "id": 23599,
          "archetype": "Grixis Reanimator",
          "match_count": 42,
          "match_winrate": "33.33%",
          "match_ci": "±14.26%",
          "game_count": 107,
          "game_winrate": "42.06%",
          "game_ci": "±9.35%"
        },
        {
          "id": null,
          "archetype": "WR",
          "match_count": 38,
          "match_winrate": "60.53%",
          "match_ci": "±15.54%",
          "game_count": 95,
          "game_winrate": "61.40%",
          "game_ci": "±9.90%"
        }
        // ... additional matchup rows omitted
      ]
    }
  ]
}
```

In this response, Boros Energy is 60.00% in 50 non-mirror matches against Affinity. The game win rate for the same pairing is 55.33% across 125 games.
