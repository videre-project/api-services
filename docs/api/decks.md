# Decks API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The decks API returns player decklists from imported MTGO events. Each row includes event metadata, the player name, mainboard and sideboard card quantities, the deck name, and the current Videre archetype label.

```text
GET /decks/:format?
```

The endpoint returns individual decklist rows selected by `format`, `event_id`, `min_date`, and `max_date`. The `/archetypes` aggregate groups these same decklists by current Videre archetype label and counts card appearances inside each group.

## Filters

```text
/decks/modern
/decks/modern?event_id=12845711
/decks/pioneer?min_date=2026-06-01&max_date=2026-06-26
/decks/modern?player=Manatraders&archetype=Murktide
```

Supported query parameters are `format`, `event_id`, `min_date`, `max_date`, `player`, `archetype`, `limit`, and `offset`.

`format` can be supplied as the path segment or as a query parameter. If both are present, the path value wins.

`event_id` selects one imported event and takes precedence over date filters.

`min_date` and `max_date` select events by event date. If no `event_id` or date range is supplied, the API uses the default recent event window described in [API Overview](index.md).

`player` is a case-insensitive contains filter on the decklist player name. `archetype` is a case-insensitive contains filter on the current deck name or archetype label.

`offset` and `limit` page through large event windows.

Responses use the standard list envelope with `meta.limit`, `meta.offset`, `meta.has_more`, and `meta.next_offset`. For full-event exports, keep requesting the same route with `offset=meta.next_offset` until `has_more` is false.

## Response Shape

Each deck row includes:

```text
id
event_id
event_name
date
format
event_type
player
deck_name
archetype
archetype_id
mainboard
sideboard
```

`mainboard` and `sideboard` are arrays of MTGO card quantity tuple strings in the form `(catalog_id,name,quantity)`. Card names containing spaces or punctuation are quoted inside the tuple string. `deck_name`, `archetype`, and `archetype_id` are the current Videre classification metadata for the decklist.

Example response, abbreviated from real API output. `// ...` marks omitted array entries.

```jsonc
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
      "id": 58586563,
      "event_id": 12845711,
      "event_name": "Modern Challenge 64",
      "date": "2026-06-30T00:00:00.000Z",
      "format": "Modern",
      "event_type": "Challenge",
      "player": "Bruskk",
      "deck_name": "Grixis Control",
      "archetype": "Grixis Control",
      "archetype_id": 16668,
      "mainboard": [
        "(144470,Island,1)",
        "(143203,\"Quantum Riddler\",2)",
        "(130651,\"Gloomlake Verge\",1)",
        "(126417,\"Psychic Frog\",4)",
        "(102237,\"Force of Negation\",2)",
        "(126509,\"Sink into Stupor\",2)"
        // ... additional mainboard entries omitted
      ],
      "sideboard": [
        "(26860,\"Magus of the Moon\",1)",
        "(40024,\"Surgical Extraction\",1)",
        "(78226,\"Mystical Dispute\",3)",
        "(126125,\"Consign to Memory\",4)"
        // ... additional sideboard entries omitted
      ]
    }
  ]
}
```
