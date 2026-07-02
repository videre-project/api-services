# Responses And Errors

This page documents the response conventions used by `https://api.videreproject.com`.

For route-specific fields, see the endpoint docs under [`docs/api`](../api/index.md). For cache and runtime limits, see [Rate Limits](rate-limits.md).

The API is intentionally conservative about response shapes. Most routes return arrays at the top level, even when the route normally contains one row. That keeps list, detail, and aggregate consumers close to the same parsing model: check the HTTP status, inspect `parameters` and `meta`, then read `data`.

## JSON Responses

API-generated responses use JSON and include:

```text
Content-Type: application/json
```

The API uses two success envelopes. List routes use a paginated list envelope. Detail and aggregate routes use a direct query envelope. Both include the parsed request parameters and query metadata so clients can inspect what the API actually applied.

Infrastructure responses can be different. A Cloudflare edge rejection, such as a rate-limit block, can return an infrastructure response instead of the API's JSON error envelope. HTTP status is the first discriminator for every response.

Parsing order:

1. Check the HTTP status.
2. If the response is JSON, parse it.
3. If `object=error`, treat it as an API error envelope.
4. If `object=list`, treat `data` as a paginated page.
5. Otherwise, treat `data` as a direct query result array.

## List Envelope

Paginated list routes return:

```json
{
  "object": "list",
  "parameters": {
    "format": "modern",
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

`object` is always `list` for this envelope. `data` is the current page. The route documentation defines the row shape inside `data`.

`parameters` contains normalized route and query parameters, including applied defaults. The API omits internal database connection fields. Collection-backed card search summarizes the collection by mode, match, and size rather than echoing the submitted ID list.

`meta.exec_ms` is the API-side execution time in milliseconds. It is diagnostic context rather than a service-level guarantee. `meta.database` and `meta.backend` identify the database target used by the request, not application routing fields.

`row_count` is the number of rows returned in this response, not the total number of matching rows. `meta.total` is the total only when it is a number.

## Pagination

List routes accept `limit` and `offset` unless an endpoint says otherwise:

| Policy | Value |
|---|---:|
| Default limit | 100 |
| Maximum limit | 500 |
| Default offset | 0 |

Autocomplete has a smaller policy:

| Policy | Value |
|---|---:|
| Default limit | 20 |
| Maximum limit | 100 |

There are two pagination modes:

- **Probe pagination:** the API fetches one extra row to determine whether another page exists. `meta.total` is `null`.
- **Exact-count pagination:** the API runs a count query. `meta.total` is a number.

When `meta.has_more` is true, request the next page with:

```text
offset=meta.next_offset
```

Keep every other filter unchanged while paging. Changing the query changes the result set and can make offsets point at different rows.

Card search uses probe pagination by default. `include_total=true` asks for an exact result count, which adds count-query work.

Probe pagination provides enough information for infinite scroll and "load more" interfaces. Exact totals provide table copy such as "1-25 of 3,214".

## Direct Query Envelope

Detail and aggregate routes return:

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

This envelope is used when pagination metadata is not part of the route's contract. Examples include single-object lookups and aggregate views such as metagame, archetype, and matchup summaries.

`data` is still an array. A single-card route returns a one-row array rather than a bare object, so clients can process detail and aggregate results with the same top-level shape.

Pagination metadata such as `limit`, `offset`, `has_more`, and `next_offset` appears on direct query routes only when the route explicitly documents it. Routes that can return many rows and need paging use the list envelope.

## Error Envelope

API-generated errors use:

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

`body` is optional. Validation errors and some route errors may only include the top-level error fields.

The error `message` is meant for debugging and simple client display. For program behavior, branch on HTTP status first and then on route context instead of treating `message` as a stable machine-readable error code.

## Empty Results

Many routes return `400 Bad Request` for an empty result:

```json
{
  "object": "error",
  "status": 400,
  "reason": "Bad Request",
  "message": "No results found.",
  "body": {
    "parameters": {
      "exact": "Not A Card"
    },
    "meta": {
      "row_count": 0,
      "total": 0,
      "limit": 100,
      "offset": 0,
      "has_more": false,
      "next_offset": null
    },
    "data": []
  }
}
```

This is current API behavior. `No results found.` is an empty-result signal, and getting rows requires changing the request. The `message` and optional `body` distinguish this from other `400` responses.

This behavior differs from APIs that return `200` with an empty list. It lets detail-like routes and list-like routes share the same `No results found.` signal. Client libraries can normalize this to empty lists:

- If status is `400` and `message` is `No results found.`, expose `data` as `[]`.
- If status is `400` for any other message, expose it as a validation or request error.

## Validation Errors

Validation errors use `400 Bad Request` and describe the invalid parameter:

```json
{
  "object": "error",
  "status": 400,
  "reason": "Bad Request",
  "message": "Invalid format specified: 'not-a-format'"
}
```

Common validation failures include:

- Missing required parameter.
- Invalid format, legality, rarity, sort, or direction value.
- Invalid card search text.
- Invalid collection body for `POST /cards/search`.
- Collection ID pools larger than 10,000 IDs.
- Collection IDs that are not positive integers.

The request must change before retrying.

Validation happens before database work. A validation error means the API could not safely interpret the request, not that the database lacked matching rows.

## Timeout And Fatal Errors

Requests have a Worker timeout and database queries have a shorter query timeout. Current values are documented in [Rate Limits](rate-limits.md).

Timeout and fatal route errors use API-generated error envelopes when they are created inside the Worker:

```json
{
  "object": "error",
  "status": 408,
  "reason": "Request Timeout",
  "message": "Request timed out"
}
```

```json
{
  "object": "error",
  "status": 500,
  "reason": "Internal Server Error",
  "message": "Encountered a fatal error."
}
```

Database execution failures are sanitized before being returned to clients. Operational details are logged by the Worker rather than exposed in the public response.

`408` and `500` are retryable with backoff. If the same query repeatedly times out, narrow the filters, reduce `limit`, or avoid exact totals before retrying again.

## Rate-Limit Responses

`POST /cards/search` has a Cloudflare edge rate limit. Requests rejected at the edge can return a Cloudflare response instead of the API envelope because Cloudflare handles them before the Worker runs.

Status code:

- `429 Too Many Requests`: back off and retry later.

Immediate retries can receive the same edge response. Interactive collection searches are most likely to hit this limit when each keystroke sends a new request; debounced input and one in-flight request per user action reduce repeated `429` responses.

## Not Found

Unknown routes return:

```json
{
  "object": "error",
  "status": 404,
  "reason": "Not Found",
  "message": "Could not find the requested resource."
}
```

This means the route was not registered. It is different from an existing route returning `No results found.`

## Status Summary

Common response handling:

- `2xx` with `object=list`: render `data` as the current page and use `meta.next_offset` for pagination.
- `2xx` with a `data` array: render `data` as the direct result.
- `400` with `message` set to `No results found.`: show an empty state.
- `400` with any other message: show a request or validation error.
- `408`, `429`, or `5xx`: retry only with backoff, or ask the user to narrow the query.
- `404`: treat as a client route bug or unsupported endpoint.
