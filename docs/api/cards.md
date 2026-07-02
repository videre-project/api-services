# Cards API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

Videre's card search API adds metadata and search operators on top of MTGO's catalog model. It searches MTGO card catalog entries from the same PostgreSQL database that backs the event API. Token rows can be included explicitly. Sealed products and other non-card catalog objects are returned by `/products`.

For the full `q` parameter grammar, including aliases, comparison operators, and unsupported Scryfall terms, see [Card Search Syntax](../reference/card-search.md).

The card routes are:

```text
GET /cards
POST /cards/search
GET /cards/named
GET /cards/autocomplete
GET /cards/random
GET /cards/:id
```

`/cards` returns a paginated list. `/cards/search` accepts the same filters with an optional request-local collection for personalized search. `/cards/named` returns one card by exact or fuzzy card name lookup. `/cards/autocomplete` returns matching card-name suggestions. `/cards/random` returns one random card from the same filtered search space as `/cards`. `/cards/:id` returns one searchable card object by MTGO catalog ID, including card faces when the object has multiple faces or subcard data.

## Query Text

The `q` parameter accepts plain text plus tagged search terms. Untagged words search card names and oracle text. The dedicated syntax reference has the full operator list; this section shows the common forms used by the card routes.

```text
/cards?q=lightning bolt
/cards?q=set:MM2 name:"Lightning Bolt"
/cards?q=t:artifact -t:creature
```

Quoted values keep spaces together. Explicit query parameters and tagged `q` terms use the same underlying filters; explicit parameters win when both are supplied.

`q` supports comparison operators such as `mv<=2`, `pow>=4`, `r>=rare`, `c<=U`, and `released>=2024-01-01`. The explicit query parameters cover exact filters and list controls.

## Named Lookup

`/cards/named` accepts exactly one of `exact` or `fuzzy`:

```text
/cards/named?exact=Lightning%20Bolt
/cards/named?fuzzy=lightnng%20bolt
```

`exact` uses exact normalized card-name matching across canonical names and printed titles. When the query matches a canonical name, ordinary printings rank ahead of printings with a different `printed_name`; when the query matches a printed title, that printed-title row is returned. `fuzzy` uses the same ranked card search as `/cards?q=...` and returns the top-ranked result. The response shape matches `/cards/:id`: a wrapper with a one-row `data` array.

`/cards/autocomplete` returns unique card-name strings in the standard list envelope:

```text
/cards/autocomplete?q=lightn
/cards/autocomplete?q=spirit&include_tokens=true&limit=20
```

Autocomplete searches printed card names and face names. It excludes tokens by default unless `include_tokens=true` is supplied. `data` contains strings, not card objects.

Example autocomplete response, from `/cards/autocomplete?q=lightn&limit=5`:

```json
{
  "object": "list",
  "parameters": {
    "q": "lightn",
    "limit": 5
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 123,
    "row_count": 5,
    "total": 5,
    "limit": 5,
    "offset": 0,
    "has_more": false,
    "next_offset": null
  },
  "data": [
    "Lightning Axe",
    "Lightning Blow",
    "Lightning Bolt",
    "Lightning Dart",
    "Lightning Mare"
  ]
}
```

## Random Card

`/cards/random` accepts the same filters as `/cards` and returns one randomly selected matching card:

```text
/cards/random
/cards/random?q=t:dragon format:modern
/cards/random?set=SOS&unique=prints
```

The response shape matches `/cards/:id`: a wrapper with a one-row `data` array. This is still a cacheable `GET` route, so an identical random-card URL can return the same cached card until the public GET cache expires.

## Common Filters

Name and text:

```text
/cards?name=Lightning
/cards?exact=Lightning Bolt
/cards?text=draw a card
/cards?q=artist:"Christopher Rush"
/cards?q=flavor:"when dragons"
```

Set and rarity:

```text
/cards?set=SOS
/cards?q=set:MM2 rarity:common
/cards?q=r>=rare
/cards?q=year:2021
/cards?q=released>=2024-01-01
```

Rarity comparisons use the normal rarity ladder: `common`, `uncommon`, `rare`, and `mythic`. MTGO-specific values such as `token`, `bonus`, and `promo` still work as exact rarity filters.

Colors and color identity:

```text
/cards?q=c<=U
/cards?q=c:%3EWU
/cards?q=id:%3DRG
```

Color operators follow Scryfall-style set logic:

| Operator | Meaning |
|---|---|
| `=` | Exactly these colors. |
| `<=` | At most these colors. |
| `>=` | At least these colors. |

MTGO colorless values are exposed as `C` in the API response, so a query like `colors<=U` can return cards whose `colors` array is `["C"]`.

Type filters can be combined with commas or repeated tagged terms in `q`:

```text
/cards?type=artifact,!creature
/cards?q=t:adventure
/cards?q=t:instant -t:sorcery
```

Numeric filters support mana value, power, toughness, loyalty, and defense:

```text
/cards?mana_value=1
/cards?q=mv<=1 -t:land
/cards?q=pow>=4 tou<4
```

Mana-cost filters match exact printed costs:

```text
/cards?mana_cost={R}
/cards?q=m:{U}{U}
```

Catalog filters cover MTGO-specific identifiers:

```text
/cards?q=number:150 set:MM2
/cards?q=artid:147
```

## Formats And Legalities

Format filters use MTGO format codes. If a format filter omits the legality, the API treats it as `legal`.

```text
/cards?format=modern
/cards?q=format:pioneer
/cards?q=legal:modern
/cards?q=legality:modern:banned
```

The response includes a `legalities` object keyed by format code.

## Tokens, Products, And Uniqueness

Tokens are cards in the catalog, but normal searches hide them by default. `include_tokens=true` allows token rows to appear alongside normal cards. Token-only filters return token rows without normal cards.

```text
/cards?q=is:token
/cards?is_token=true
/cards?q=spirit&include_tokens=true
/cards?q=is:promo
/cards?q=is:multiface
/cards?q=is:split
```

Sealed products and other MTGO catalog products are returned by `/products`, not `/cards`.

The `unique` option controls print collapsing:

```text
/cards?q=Lightning Bolt&unique=cards
/cards?q=Lightning Bolt&unique=prints
```

`cards` returns one representative per oracle card. `prints` returns each MTGO printing.

MTGO foil clones are preserved in the database as catalog variants rather than independent card rows. Those variants usually lack separate `/cards` results, and ordinary foil clone catalog IDs therefore lack separate CDN images.

## Collection-Aware Search

`POST /cards/search` personalizes card search against a caller-provided MTGO collection. The query string accepts the same filters, sorting, and pagination controls as `GET /cards`; the JSON body adds a `collection` object.

```http
POST /cards/search?q=lightning%20bolt&unique=prints
Content-Type: application/json
```

```json
{
  "collection": {
    "ids": [605, 1195],
    "mode": "rank",
    "match": "prints"
  }
}
```

`collection.ids` must contain positive integer MTGO catalog IDs. The inline pool is capped at 10,000 IDs, and duplicate IDs are ignored.

Collection modes:

| Mode | Meaning |
|---|---|
| `only` | Return matching cards from the collection only. |
| `exclude` | Return matching cards outside the collection only. |
| `rank` | Return all matching cards, ranking collection matches first. |

Collection matching:

| Match | Meaning |
|---|---|
| `prints` | Match exact MTGO catalog IDs. |
| `oracle` | Treat owned print IDs as ownership of every card with the same oracle ID. |

When omitted, `mode` defaults to `only` and `match` defaults to `prints`.

Collection-backed responses include `in_collection` on each returned card and summarize the collection in `parameters.collection` by mode, match, and size rather than echoing the full ID list. `GET /cards` remains the cacheable public search path; collection-backed POST responses are private.

`POST /cards/search` is rate limited because each request is personalized and cannot be shared through the public GET cache. See [Rate Limits](../reference/rate-limits.md) for the current public threshold.

Examples:

```text
/cards/search?q=type:creature&unique=cards
/cards/search?exact=Lightning%20Bolt&unique=prints
/cards/search?q=dragon&order=rank
```

## Response Shape

Card result objects include the MTGO catalog fields used for deckbuilding and search:

```text
id
oracle_id
set_code
set_name
set_release_date
set_type
collector_number
name
canonical_name
printed_name
display_name
artist
art_id
mana_cost
mana_value
type_line
oracle_text
flavor_text
colors
color_identity
power
toughness
loyalty
defense
rarity
frame_style
promo_label
is_token
is_promo
is_multiface
is_split
legalities
image_url
in_collection
```

The `name` field is the canonical mechanical card name used by existing clients; `canonical_name` is the same value under an explicit field name. The`printed_name` field is present when the MTGO catalog row has a different printed title, such as Universes Within-style promotional treatments. In all cases, the `display_name` field defaults to `printed_name` when present and otherwise to the canonical name, and is the source for the card-name string used in autocomplete and other UI features.

`in_collection` is present only on `POST /cards/search` responses that include a collection.

Catalog flags such as `is_token`, `is_promo`, `is_multiface`, and `is_split` reflect imported MTGO catalog fields. Some flag values can be `null` when the source catalog row lacks that value.

`/cards/:id` also includes ordered `faces` for split, modal, adventure, and other multi-face catalog entries.

Example list response, from `/cards?exact=Lightning%20Bolt&set=1E&unique=prints&limit=1`:

```json
{
  "object": "list",
  "parameters": {
    "exact": "Lightning Bolt",
    "set": "1E",
    "unique": "prints",
    "limit": 1
  },
  "meta": {
    "database": "api@worker-db.videreproject.com/mtgo",
    "backend": "postgres",
    "exec_ms": 98,
    "row_count": 1,
    "total": null,
    "limit": 1,
    "offset": 0,
    "has_more": false,
    "next_offset": null
  },
  "data": [
    {
      "id": 605,
      "oracle_id": "ca3eec5d-2acb-5278-a807-d694edd299ea",
      "set_code": "1E",
      "collector_number": null,
      "set_name": "Limited Edition Alpha",
      "name": "Lightning Bolt",
      "canonical_name": "Lightning Bolt",
      "printed_name": null,
      "display_name": "Lightning Bolt",
      "artist": "Christopher Rush",
      "art_id": 147,
      "mana_cost": "{R}",
      "mana_value": 1,
      "type_line": "Instant",
      "oracle_text": "Lightning Bolt deals 3 damage to any target.",
      "flavor_text": null,
      "colors": ["R"],
      "color_identity": ["R"],
      "power": null,
      "toughness": null,
      "loyalty": null,
      "defense": null,
      "rarity": "common",
      "frame_style": 1,
      "promo_label": null,
      "is_token": null,
      "is_promo": false,
      "is_multiface": false,
      "is_split": false,
      "set_release_date": "1993-08-05T00:00:00.000Z",
      "set_type": "CoreSet",
      "legalities": {
        "legacy": "legal",
        "modern": "legal",
        "pauper": "legal",
        "pioneer": "not_legal",
        "vintage": "legal",
        "standard": "not_legal",
        "premodern": "legal"
      },
      "image_url": "https://r2.videreproject.com/cards/605-300px.png"
    }
  ]
}
```

## Sorting And Pagination

```text
/cards?q=dragon&order=name&dir=asc&limit=25&offset=50
/cards?q=dragon&order=name&include_total=true
```

Supported sort keys are `rank`, `name`, `mana_value`, `set`, and `released`. Card search fetches one extra row by default, so `has_more` and `next_offset` are available without running a second exact-count query. `total` is `null` unless `include_total=true` is supplied. `include_total=true` asks the API for an exact result count.
