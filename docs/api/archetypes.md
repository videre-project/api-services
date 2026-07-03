# Archetypes API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The archetypes API returns card adoption statistics inside Videre archetype labels for a format and event window. Each row contains the archetype sample size plus mainboard and sideboard card statistics. For the same `format`, `event_id`, `min_date`, and `max_date` selection, `/metagame` returns field-share and win-rate summaries.

```text
GET /archetypes/:format?
```

The endpoint starts from imported event decklists, applies the event filters, groups the matching decklists by Videre's current archetype label, then counts which cards appear in those decklists. That makes `/archetypes` the aggregate card-adoption view over the selected decklists.

Related routes expose other views of the same filtered decklists. `/decks` returns the individual decklists, and `/metagame` summarizes field share and win rates for the same `format`, `event_id`, `min_date`, and `max_date` selection.

Rows use the direct query envelope documented in [API Overview](index.md). The response is an array in `data`; list pagination fields such as `has_more` and `next_offset` are absent from this envelope.

## Filters

```text
/archetypes/modern
/archetypes/modern?archetype=Izzet%20Murktide
/archetypes/pioneer?min_date=2026-06-01&max_date=2026-06-26
/archetypes/modern?event_id=12845711
```

Supported query parameters are `format`, `archetype`, `event_id`, `min_date`, `max_date`, and `limit`.

`format` is required. It can be supplied as the path segment or as a query parameter. If both are present, the path value wins.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` select events by event date. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

`archetype` filters to one current Videre archetype label and sets `limit` to `1`. The value must match the current archetype label, such as `Boros Energy` or `Izzet Murktide`.

`limit` caps the number of archetype rows returned. Without `archetype`, rows are sorted by archetype sample size in descending order.

## Response Shape

Each archetype row includes:

```text
id
archetype
count
mainboard
sideboard
```

`id` is the Videre archetype ID for the current label. `archetype` is the current label. `count` is the number of matching decklists for that archetype in the selected event window.

`mainboard` and `sideboard` are arrays of card statistics:

```text
card
count
percentage
total
average
```

Inside `mainboard` and `sideboard`:

- `card` is the card name from the imported decklists.
- `count` is the number of archetype decklists containing the card.
- `percentage` is `count` divided by the archetype row's `count`.
- `total` is the total number of copies across matching archetype decklists.
- `average` is `total` divided by the number of decklists containing the card.

Card-stat arrays are sorted by adoption count, then total copies, then average copies, then card name. Cards below 1% adoption in the selected archetype are omitted from these arrays.

Archetype labels are derived classification data. The `id` and `archetype` fields describe Videre's current classification for the selected decklists; the source deck IDs are returned by `/decks`.

## Examples

The examples below are abbreviated from real API output. `// ...` marks omitted array entries.

Request:

```text
/archetypes/modern?min_date=2026-05-31&max_date=2026-07-01&limit=1
```

Abbreviated response:

```jsonc
{
  "parameters": {
    "format": "Modern",
    "min_date": "2026-05-31T00:00:00.000Z",
    "max_date": "2026-07-01T00:00:00.000Z",
    "limit": 1
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 221,
    "row_count": 1
  },
  "data": [
    {
      "id": 25356,
      "archetype": "Boros Energy",
      "count": 132,
      "mainboard": [
        {
          "card": "Ajani, Nacatl Pariah",
          "count": 132,
          "percentage": "100.00%",
          "total": 528,
          "average": 4
        },
        {
          "card": "Arid Mesa",
          "count": 132,
          "percentage": "100.00%",
          "total": 528,
          "average": 4
        },
        {
          "card": "Guide of Souls",
          "count": 132,
          "percentage": "100.00%",
          "total": 528,
          "average": 4
        },
        {
          "card": "Ocelot Pride",
          "count": 132,
          "percentage": "100.00%",
          "total": 528,
          "average": 4
        },
        {
          "card": "Galvanic Discharge",
          "count": 132,
          "percentage": "100.00%",
          "total": 527,
          "average": 3.99
        }
        // ... additional mainboard entries omitted
      ],
      "sideboard": [
        {
          "card": "Wear // Tear",
          "count": 129,
          "percentage": "97.73%",
          "total": 221,
          "average": 1.71
        },
        {
          "card": "Vexing Bauble",
          "count": 124,
          "percentage": "93.94%",
          "total": 212,
          "average": 1.71
        },
        {
          "card": "High Noon",
          "count": 120,
          "percentage": "90.91%",
          "total": 217,
          "average": 1.81
        }
        // ... additional sideboard entries omitted
      ]
    }
  ]
}
```

In this response, Boros Energy has 132 matching decklists in the selected window. `Ajani, Nacatl Pariah` appears in all 132 of them, with 528 total copies, so its average is 4 copies among the decklists where it appears. `Wear // Tear` appears in 129 of the 132 sideboards, with 221 total copies.

Requesting a specific archetype returns the same row shape:

```text
/archetypes/modern?min_date=2026-05-31&max_date=2026-07-01&archetype=Boros%20Energy
```

The response contains one row because `archetype` sets `limit` to `1`:

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
    "exec_ms": 161,
    "row_count": 1
  },
  "data": [
    {
      "id": 25356,
      "archetype": "Boros Energy",
      "count": 132,
      "mainboard": [
        {
          "card": "Ajani, Nacatl Pariah",
          "count": 132,
          "percentage": "100.00%",
          "total": 528,
          "average": 4
        }
        // ... additional mainboard entries omitted
      ],
      "sideboard": [
        {
          "card": "Obsidian Charmaw",
          "count": 117,
          "percentage": "88.64%",
          "total": 280,
          "average": 2.39
        }
        // ... additional sideboard entries omitted
      ]
    }
  ]
}
```
