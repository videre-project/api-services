# Sets API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The sets API lists MTGO set records imported from the card catalog. Rows provide set codes, release dates, MTGO set-type values, and catalog counts for cards, tokens, and products.

```text
GET /sets
GET /sets/:code
```

`/sets` returns a paginated list. `/sets/:code` returns one set by MTGO set code, using the same row shape as `/sets`.

## Filters

```text
/sets?q=strixhaven
/sets?q=code:STX
/sets?code=SOS
/sets?name=Modern Horizons
/sets?type=LargeExpansionSet
```

Supported query parameters are `q`, `code`, `name`, `type`, `order`, `dir`, `limit`, and `offset`.

The `q` parameter accepts plain text and tagged terms. Untagged text searches set code and set name. `code:`, `set:`, `e:`, and `edition:` map to the `code` filter. `name:` maps to the `name` filter, and `type:` or `set_type:` maps to the `type` filter. Explicit query parameters win when both are supplied.

`code` is an exact case-insensitive MTGO set-code filter. `name` is a case-insensitive contains filter on the set name. `type` is an exact case-insensitive filter on the MTGO `set_type` value.

## Sorting And Pagination

```text
/sets?order=released&dir=desc&limit=25&offset=50
/sets?order=name&dir=asc
```

Supported sort keys are `released`, `name`, `code`, and `type`. `released` sorts by `release_date` and defaults to descending order. The other sort keys default to ascending order. The response includes exact `total`, `has_more`, and `next_offset` metadata.

## Response Shape

Each set includes:

```text
code
name
release_date
age
set_type
card_count
token_count
product_count
```

`release_date` is the imported MTGO release date as an ISO timestamp. `age` is the numeric MTGO set age value imported with the set metadata. `set_type` is an MTGO-derived grouping value; paper Magic product taxonomy can differ.

`card_count` counts non-token card catalog rows in the set. `token_count` counts token card rows. `product_count` counts non-card catalog products whose `set_code` matches the set.

Example response, from `/sets?code=STX&limit=1`:

```json
{
  "object": "list",
  "parameters": {
    "code": "STX",
    "limit": 1
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 150,
    "row_count": 1,
    "total": 1,
    "limit": 1,
    "offset": 0,
    "has_more": false,
    "next_offset": null
  },
  "data": [
    {
      "code": "STX",
      "name": "Strixhaven: School of Mages",
      "release_date": "2021-04-23T00:00:00.000Z",
      "age": 319,
      "set_type": "LargeExpansionSet",
      "card_count": 285,
      "token_count": 0,
      "product_count": 11
    }
  ]
}
```
