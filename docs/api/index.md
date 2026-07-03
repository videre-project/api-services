# API Overview

The Videre API is served from:

```text
https://api.videreproject.com
```

The service provides cacheable public reads over MTGO event, deck, match, card, set, and product data. HTTP API routes are public and unauthenticated.

Examples in these docs use real or abbreviated API output. Long arrays, nullable fields, and diagnostic database metadata may be omitted for readability. For the complete response fields for a route, use the Response Shape section in that route's page, such as [Cards API](cards.md), [Events API](events.md), or [Metagame API](metagame.md).

Reference docs:

- [Card Search Syntax](../reference/card-search.md)
- [Data Sources And Freshness](../reference/data-sources.md)
- [Rate Limits](../reference/rate-limits.md)
- [Responses And Errors](../reference/responses-and-errors.md)

## Route Families

Catalog routes return MTGO catalog data independent of tournament results.

| Route | Returns |
|---|---|
| `/cards` | Paginated card and token catalog rows, with `q` search syntax documented in [Card Search Syntax](../reference/card-search.md). |
| `/cards/named` | One card selected by exact or fuzzy card-name lookup. |
| `/cards/autocomplete` | Unique suggestion strings from canonical card names, printed titles, and face names. |
| `/cards/random` | One random card from the same filtered search space as `/cards`. |
| `/sets` | MTGO set metadata and catalog counts. |
| `/products` | Non-card MTGO catalog objects such as boosters, tickets, trophies, and sealed products. |
| `/mtgo/manifest` | Current Daybreak MTGO ClickOnce deployment metadata. |

Event routes return imported MTGO tournament data and Videre aggregate views.

| Route | Returns |
|---|---|
| `/events` | Imported event metadata: event ID, name, date, format, kind, rounds, and player count. |
| `/decks` | Player decklists with mainboard and sideboard card quantities, deck names, and current Videre archetype labels. |
| `/matches` | Round-by-round match rows with player/opponent data, match result, game results when available, and joined deck/archetype fields. |
| `/standings` | Final standings with rank, record, points, tiebreakers, and joined deck/archetype fields. |
| `/metagame` | Per-archetype deck share, non-mirror match win rate, and non-mirror game win rate. |
| `/archetypes` | Card adoption statistics inside each Videre archetype label. |
| `/matchups` | Archetype-versus-archetype match and game win rates. |

Aggregate routes such as `/metagame`, `/archetypes`, and `/matchups` summarize an event window selected by `format`, `event_id`, `min_date`, and `max_date`. They are derived from imported deck, match, standing, and archetype-label rows.

The aggregate routes expose different summaries over those imported rows: `/metagame` returns archetype share and win-rate rows, `/archetypes` returns card-adoption rows inside each archetype, and `/matchups` returns archetype-pair win-rate rows. Raw event routes such as `/events`, `/decks`, `/matches`, and `/standings` expose the event metadata and source rows used to build those summaries.

For provenance and freshness details, see [Data Sources And Freshness](../reference/data-sources.md).

## Shared Behavior

Successful `GET` responses are cached by the Worker cache with:

```text
Cache-Control: max-age=3600, s-maxage=1800
```

The Worker cache stores successful `GET` responses under a key that includes the full URL and an internal cache version. Error responses pass through without cache storage. `POST /cards/search` responses are private because the request body can contain a caller-provided collection; those responses use:

```text
Cache-Control: private, no-store
```

`GET /cards/random` uses the same GET cache path as other public routes. An identical random-card URL can therefore return the cached random result until the cache expires or the cache version changes.

All requests made to the API have a 15 second Worker timeout. Separately, database queries are cancelled after 10 seconds.

## Pagination

List endpoints accept pagination through `limit` and `offset` parameters unless the endpoint page otherwise documents a different policy.

| Parameter | Default | Maximum | Notes |
|---|---:|---:|---|
| `limit` | 100 | 500 | Controls returned rows. |
| `offset` | 0 | none | Page with `meta.next_offset`. |

Autocomplete uses a tighter limit policy because suggestion responses are intended for compact search-box result sets:

| Endpoint | Default | Maximum |
|---|---:|---:|
| `/cards/autocomplete` | 20 | 100 |

Probe-paginated list endpoints fetch one extra row to determine whether another page exists. In those responses, `meta.total` is `null`, while `meta.has_more` and `meta.next_offset` describe the next page. Card search routes (`GET /cards` and `POST /cards/search`) also accept `include_total=true`; when that parameter is supplied, the API runs an exact count query and returns the result in `meta.total`. Card search also calculates an exact total automatically when `limit=500`, the maximum page size. Other list endpoints that calculate totals directly return a numeric `meta.total` without `include_total`.

When `meta.has_more` is true, request the same route again with `offset=meta.next_offset`. Keep the other filters unchanged while paging, since changing the filter set changes the result order and page boundaries.

## Dates

Event-backed routes use `YYYY-MM-DD` dates for `min_date` and `max_date`. When the route supports event filters and no date range is supplied, the API defaults to the recent event window used by the service: from 31 days before the request date through the request date.

`event_id` selects a single event and bypasses date-range filtering. Date ranges select rolling windows, such as the last month of Modern Challenges.

For card search, `released` also accepts `YYYY-MM-DD`, and `year` accepts a four-digit release year.

## Formats

Routes that accept `:format` also accept `format` as a query parameter. If both are supplied, the path segment wins because it is parsed as the route parameter.

Format values use Videre's generated MTGO format constants. Common values include:

- `standard`
- `pioneer`
- `modern`
- `legacy`
- `vintage`
- `pauper`
- `premodern`

## Rate Limits

The public edge rate limit currently applies only to collection-backed card search. For the full guardrail summary, see [Rate Limits](../reference/rate-limits.md).

- `POST /cards/search`: 20 requests per 10 seconds per client IP and Cloudflare colo.

Other HTTP routes rely on cache behavior, pagination limits, Worker timeouts, database query timeouts, and database pool limits.

## Response Envelopes

This section summarizes the top-level shapes. For client-facing error behavior, empty-result handling, validation errors, pagination modes, and edge rate-limit responses, see [Responses And Errors](../reference/responses-and-errors.md).

Paginated list endpoints return:

```json
{
  "object": "list",
  "parameters": {
    "limit": 25
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 12.345,
    "row_count": 25,
    "total": null,
    "limit": 25,
    "offset": 0,
    "has_more": true,
    "next_offset": 25
  },
  "data": []
}
```

Detail and aggregate endpoints that use the direct query envelope return:

```json
{
  "parameters": {
    "format": "modern"
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 12.345,
    "row_count": 1
  },
  "data": []
}
```

Both envelopes include the original parsed `parameters` so the applied filters are visible in the response. The `database` metadata is diagnostic context rather than application routing data.

Errors return:

```json
{
  "object": "error",
  "status": 400,
  "reason": "Bad Request",
  "message": "No results found.",
  "body": {
    "parameters": {},
    "meta": {
      "row_count": 0
    },
    "data": []
  }
}
```

`body` is present only when the route has contextual response data to include, such as the empty list envelope returned with `No results found.` errors.
