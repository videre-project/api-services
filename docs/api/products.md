# Products API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The products API lists non-card MTGO catalog entries imported from the catalog. Rows include tickets, boosters, complete sets, preconstructed products, trophies, and other catalog objects. Card and token catalog rows are documented in the [Cards API](cards.md).

```text
GET /products
GET /products/:id
```

`/products` returns a paginated list. `/products/:id` returns one product by MTGO catalog ID, using the same row shape as `/products`.

## Filters

```text
/products?q=ticket
/products?q=!"Event Ticket"
/products?q=type:BSTR set:MB1
/products?id=1
/products?name=Booster
/products?exact=Event Ticket
/products?set=SOS
/products?type=BSTR
/products?is_tradable=true
```

Supported query parameters are `id`, `q`, `name`, `exact`, `set`, `type`, `is_tradable`, `order`, `dir`, `limit`, and `offset`.

The `q` parameter accepts plain text and tagged terms. Untagged text searches the product search vector and fuzzy-normalized product name. `!"Event Ticket"` or `exact:"Event Ticket"` maps to the `exact` filter. `set:`, `e:`, and `edition:` map to the `set` filter. `name:` maps to the `name` filter. `type:` and `object_type:` map to the `type` filter. `catalog:`, `cid:`, and `mtgoid:` map to the numeric `id` filter.

`id` is an exact MTGO catalog ID filter. `name` is a case-insensitive contains filter on the normalized product name. `exact` is an exact normalized product name filter. `set` is an exact uppercase MTGO set-code filter. `type` is an exact uppercase MTGO object type code, such as `BSTR` for boosters or `TCKT` for tickets. `is_tradable` filters rows where MTGO publishes a boolean tradability value.

## Sorting And Pagination

```text
/products?q=booster&order=name&dir=asc&limit=25
/products?order=set
```

Supported sort keys are `rank`, `name`, `set`, and `type`. `rank` sorts by similarity to the `q` value and is the default when `q` is supplied. Without `q`, the default sort key is `name`. The response includes exact `total`, `has_more`, and `next_offset` metadata.

## Response Shape

Each product includes:

```text
id
set_code
set_name
name
object_type
texture_number
is_tradable
image_url
```

`id` is the MTGO catalog ID. `set_code` is the imported MTGO set code for the product, and `set_name` is joined from `/sets` when the set exists in the catalog. `object_type` is MTGO's product type code. `texture_number` is the MTGO catalog texture number used by the product image pipeline.

`is_tradable` can be `true`, `false`, or `null`. `null` means the catalog row lacks a published tradability value.

## Images

Product images use a separate CDN path from card images:

```text
https://r2.videreproject.com/products/{id}-300px.png
```

Example response, from `/products?exact=Event%20Ticket&limit=1`:

```json
{
  "object": "list",
  "parameters": {
    "exact": "Event Ticket",
    "limit": 1
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 171,
    "row_count": 1,
    "total": 1,
    "limit": 1,
    "offset": 0,
    "has_more": false,
    "next_offset": null
  },
  "data": [
    {
      "id": 1,
      "set_code": "ETK",
      "set_name": "Event Ticket",
      "name": "Event Ticket",
      "object_type": "TCKT",
      "texture_number": 2,
      "is_tradable": null,
      "image_url": "https://r2.videreproject.com/products/1-300px.png"
    }
  ]
}
```
