# Prices API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The prices API returns GoatBots daily average sell prices in event tickets for MTGO catalog IDs. Catalog IDs can refer to cards, card catalog variants, or products. Missing price data means GoatBots did not publish a price for that catalog ID/date; it is not a tradability signal.

```text
GET /prices/:id
GET /prices/:id/history?from=&to=&limit=&offset=
POST /prices/search
```

`/prices/:id` returns the latest known price for one MTGO catalog ID. `/prices/:id/history` returns dated rows for that ID. `POST /prices/search` accepts a JSON body:

```json
{
  "ids": [605, 1195],
  "date": "latest"
}
```

`date` may be `latest` or a `YYYY-MM-DD` price date. Batch responses include `meta.missing_ids` for requested catalog IDs with no matching price row.

## Response Shape

Each price row includes:

```text
id
price_date
sell_price
source
url
kind
name
cardset
rarity
version
foil
```

`id` is the MTGO catalog ID. `source` is currently `goatbots`, and `url` points at the source website. `name`, `cardset`, `rarity`, `version`, and `foil` are GoatBots definition metadata when available.
