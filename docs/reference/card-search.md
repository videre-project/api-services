# Card Search Syntax

This page documents the `q` syntax used by the card routes:

```text
GET /cards?q=...
POST /cards/search?q=...
GET /cards/random?q=...
```

For route shapes, response fields, collection search, and examples, see [Cards API](../api/cards.md). For shared response, pagination, caching, and rate-limit behavior, see [API Overview](../api/index.md) and [Rate Limits](rate-limits.md).

The syntax is an MTGO-focused subset inspired by Scryfall search. Supported terms are backed by MTGO catalog fields, generated legality data, and Videre's card search indexes.

`q` is a compact form for building the same filters exposed as query parameters. Plain words search names and oracle text. Tagged terms constrain a word to a specific field. Comparison operators apply to ordered fields such as mana value, release date, and rarity.

## How Queries Are Parsed

The parser splits `q` on whitespace. Text inside double quotes stays together:

```text
lightning bolt
name:"Lightning Bolt"
artist:"Christopher Rush"
```

Tokens that are not recognized as operators or tagged terms remain as plain text search. Plain text searches card names and oracle text using the database search index:

```text
/cards?q=lightning bolt
/cards?q=draw a card
```

Most tagged terms fill one API filter. If the same filter is supplied both as an explicit query parameter and inside `q`, the explicit query parameter wins. If a singleton filter appears twice inside `q`, the first recognized value wins. Type terms are the main exception: repeated `t:` terms are combined.

The `q` parameter accepts letters, numbers, punctuation, symbols, and whitespace. Control characters are rejected before parsing.

The parser supports plain text, tagged terms, comparisons, and narrow negation. Full boolean grouping and parenthesized `or` syntax are outside the supported `q` grammar. Explicit query parameters cover structured behavior beyond `q`.

## Common Recipes

Common examples:

```text
/cards?q=lightning bolt
/cards?q=!"Lightning Bolt"&unique=prints
/cards?q=!"Lightning Bolt" year>2020&unique=prints
/cards?q=t:artifact -t:creature
/cards?q=format:modern mv<=2
/cards?q=artist:"Christopher Rush" set:1E
/cards?q=is:token name:clue
```

`unique=prints` returns MTGO print rows for printing, image, set, and collection views. `unique=cards` collapses reprints to one representative per oracle card.

Search boxes can send the user's text as plain `q`. Untagged text can match both card names and oracle text, while `name:` limits matching to card names.

## Exact Name Shorthand

The `!"..."` shorthand performs an exact card-name lookup inside `q`:

```text
/cards?q=!"Lightning Bolt"
/cards?q=!"Lightning Bolt" year>2020
```

This maps to the same exact-name filter as `exact=Lightning Bolt`. It still returns print rows unless `unique=cards` is supplied.

## Name And Text

| Syntax | Meaning |
|---|---|
| `name:bolt` | Card name contains `bolt`. |
| `n:bolt` | Alias for `name`. |
| `exact:"Lightning Bolt"` | Exact normalized card name. |
| `oracle:"draw a card"` | Oracle text contains the value. |
| `o:"draw a card"` | Alias for `oracle`. |

Untagged text searches both names and oracle text. `name:` and `oracle:` constrain matching to one field.

`exact:` is stricter than `name:`. It matches resolved card names from autocomplete or known decklist entries; partial user input generally belongs in `name:` or untagged text.

## Set, Printing, And Catalog Terms

| Syntax | Meaning |
|---|---|
| `set:MM2` | MTGO set code equals `MM2`. |
| `e:MM2` | Alias for `set`. |
| `edition:MM2` | Alias for `set`. |
| `number:150` | Collector number equals `150`. |
| `collector:150` | Alias for `number`. |
| `cn:150` | Alias for `number`. |
| `cid:605` | MTGO catalog ID equals `605`. |
| `catalog:605` | Alias for `cid`. |
| `mtgoid:605` | Alias for `cid`. |
| `artid:147` | Art ID equals `147`. |
| `art:147` | Alias for `artid`. |
| `art_id:147` | Alias for `artid`. |
| `frame:2015` | Frame style equals `2015`. |
| `frame_style:2015` | Alias for `frame`. |
| `promo:prerelease` | Promo label contains `prerelease`. |
| `promo_label:prerelease` | Alias for `promo`. |

Set codes are compared case-insensitively. Collector numbers are exact string matches, which matters for MTGO catalog values that contain letters or suffixes.

Catalog IDs identify MTGO catalog rows, not oracle cards. They are the right identifier for card images, collection matching, and exact printing lookup. Oracle-level grouping is controlled separately with `unique=cards`.

## Colors

Color search uses MTGO's computed color masks. Color values can use `WUBRG`, `C`, or color names.

| Syntax | Meaning |
|---|---|
| `c:U` | At least blue. |
| `c>=WU` | At least white and blue. |
| `c<=U` | At most blue. Colorless cards also match. |
| `c=RG` | Exactly red and green. |
| `color:white` | Alias for `c:white`. |
| `colors:colorless` | Match colorless through the color filter. |
| `id:RG` | Color identity at most red and green. |
| `id>=R` | Color identity includes red. |
| `identity=UB` | Color identity exactly blue and black. |
| `color_identity<=WU` | Alias for `id<=WU`. |

The default operator differs by field:

| Field | Default |
|---|---|
| `c`, `color`, `colors` | `>=` |
| `id`, `identity`, `color_identity` | `<=` |

Only `=`, `<=`, and `>=` are supported for color comparisons.

The default operators follow common deckbuilding search behavior. `c:U` means "has blue among its colors", while `id:RG` means "can fit in a red-green color identity". Explicit operators override those defaults.

## Numeric And Date Comparisons

Numeric terms support `=`, `<`, `<=`, `>`, and `>=`.

| Syntax | Field |
|---|---|
| `mv<=2` | Mana value. |
| `cmc<=2` | Alias for mana value. |
| `mana_value<=2` | Mana value. |
| `pow>=4` | Power. |
| `power>=4` | Power. |
| `tou<4` | Toughness. |
| `toughness<4` | Toughness. |
| `loy>=3` | Loyalty. |
| `loyalty>=3` | Loyalty. |
| `def>=4` | Defense. |
| `defense>=4` | Defense. |
| `year>2020` | Set release year. |

Date terms also support `=`, `<`, `<=`, `>`, and `>=`.

| Syntax | Meaning |
|---|---|
| `released>=2024-01-01` | Set release date on or after the date. |
| `release<2020-01-01` | Alias for `released`. |
| `date=2026-06-23` | Alias for `released`. |

Date values are `YYYY-MM-DD`.

Power, toughness, loyalty, and defense are stored as printed text in the card catalog, so the API compares their numeric value when one can be derived. Cards with non-numeric printed values may not behave like ordinary numeric cards for these filters.

## Mana Cost

Mana-cost filters match the exact printed mana cost:

```text
/cards?q=m:{R}
/cards?q=mana:{U}{U}
/cards?q=cost={2}{G}
```

Supported keys are `m`, `mana`, `cost`, and `mana_cost`. Cost comparison is not numeric. `mv`, `cmc`, and `mana_value` perform numeric mana-value comparisons.

Mana cost is exact by design. A search for `m:{R}` matches cards printed with exactly `{R}`, not every card that contains red mana in its cost.

## Rarity

| Syntax | Meaning |
|---|---|
| `r:common` | Exact rarity. |
| `rarity:rare` | Exact rarity. |
| `r>=rare` | Rare or mythic. |
| `r<rare` | Common or uncommon. |

Rarity comparisons use the normal paper rarity ladder: `common`, `uncommon`, `rare`, and `mythic`. MTGO-specific rarity names such as `token`, `bonus`, and `promo` can be used as exact values, but they are not part of the comparison ladder.

Short aliases such as `c`, `u`, `r`, and `m` are normalized through the same generated rarity alias table used by the API validators.

Rarity comparison covers the normal rarity ladder only. Exact rarity matching covers MTGO-specific values such as `token` and `promo`.

## Types

Type terms search card types, supertypes, subtypes, and multi-word text in the printed type line.

```text
/cards?q=t:artifact
/cards?q=t:artifact -t:creature
/cards?q=type:legendary type:creature
/cards?q=t:"time lord"
```

Repeated type terms are combined. Included terms must all match. Excluded terms must not match.

If a query includes the same term as both included and excluded, the API treats the query as empty and returns no results:

```text
/cards?q=t:artifact -t:artifact
```

Single-word type terms match parsed type, supertype, and subtype arrays. A quoted multi-word type term falls back to a contains check against the printed type line, which supports cases such as `t:"time lord"`.

## Formats And Legalities

`format:` filters to cards that are legal in the format:

```text
/cards?q=format:modern
/cards?q=f:pioneer
```

The API also accepts legality terms:

```text
/cards?q=legal:modern
/cards?q=banned:modern
/cards?q=restricted:vintage
/cards?q=legality:modern:banned
/cards?q=legality:banned
```

Legalities are oracle-based. If any printing of the same oracle card has that format legality, matching print rows can appear in the result.

Supported legality values are:

- `legal`
- `not_legal`
- `banned`
- `restricted`
- `suspended`

When a query supplies `format` without an explicit legality, the API assumes `legal`.

This makes `format:modern` return cards that are legal in Modern. Explicit legality terms return banned, restricted, suspended, or not-legal cards.

## Artist And Flavor Text

```text
/cards?q=artist:"Christopher Rush"
/cards?q=a:"Christopher Rush"
/cards?q=illustrator:"Christopher Rush"
/cards?q=flavor:"when dragons"
/cards?q=ft:"when dragons"
```

Artist and flavor filters search card and face attributes. They are case-insensitive contains filters.

These fields support catalog discovery rather than normal deck legality or gameplay filtering. Older or unusual MTGO catalog rows may omit them when the upstream data lacks those values.

## Boolean Flags

The `is:` namespace contains API-supported card flags:

| Syntax | Meaning |
|---|---|
| `is:token` | Return token rows. |
| `is:promo` | Promo label is present. |
| `is:multiface` | The catalog entry has additional face rows. |
| `is:multi-face` | Alias for `is:multiface`. |
| `is:dfc` | Alias for `is:multiface`. |
| `is:split` | Split or subcard relationship is present. |
| `is:subcard` | Alias for `is:split`. |
| `-is:token` | Keep token rows excluded. This is also the default. |
| `-is:promo` | Promo label is not present. |
| `-is:multiface` | No additional face rows. |
| `-is:split` | No split or subcard relationship. |

Normal searches hide tokens by default. `is:token` changes the search to token rows. `include_tokens=true` is a query parameter, not a `q` term; it allows tokens to appear alongside normal cards.

`is:multiface` and `is:split` are MTGO catalog predicates. They find cards with additional face rows or split/subcard relationships; paper layout taxonomy can differ.

## Sorting And Uniqueness

Sort and uniqueness terms can be supplied through `q`:

```text
/cards?q=dragon order:released dir:desc
/cards?q=lightning bolt sort:name direction:asc
/cards?q=lightning bolt unique:prints
/cards?q=lightning bolt unique:cards
```

Supported order values:

| Value | Meaning |
|---|---|
| `rank` | Search rank, then stable card fields. |
| `relevance` | Alias for `rank`. |
| `name` | Card name. |
| `mv` | Mana value. |
| `cmc` | Alias for mana value. |
| `mana` | Alias for mana value. |
| `mana_value` | Mana value. |
| `set` | Set code and collector number. |
| `released` | Set release date. |
| `release` | Alias for `released`. |

Supported directions are `asc`, `ascending`, `desc`, and `descending`.

Supported unique values:

| Value | Meaning |
|---|---|
| `prints` | Return print rows. |
| `printings` | Alias for `prints`. |
| `cards` | Collapse to one representative per oracle card. |
| `card` | Alias for `cards`. |
| `oracle` | Alias for `cards`. |
| `oracles` | Alias for `cards`. |

When `order` is omitted, text searches default to `rank`; non-text searches default to `name`. When `unique` is omitted, `/cards` returns print rows.

Sorting happens after filters are applied. For collection-aware searches with `mode=rank`, collection membership is applied before the normal sort so owned cards appear first within the matching result set.

## Negation

Negation is currently supported for type terms and `is:` flags:

```text
/cards?q=t:artifact -t:creature
/cards?q=-is:token
/cards?q=-is:promo
/cards?q=-is:multiface
```

Negation support is limited to type terms and `is:` flags. A token such as `-artist:foo` falls back to plain text search instead of meaning "artist is not foo."

General negative filters require explicit API parameters or a dedicated route-level option.

## URL Encoding

Clients URL-encode characters such as spaces, quotes, braces, `<`, `>`, and `=`. These examples show the readable form:

```text
/cards?q=!"Lightning Bolt" year>2020
/cards?q=m:{R}
/cards?q=c<=U
```

Encoded form:

```text
/cards?q=!%22Lightning%20Bolt%22%20year%3E2020
/cards?q=m%3A%7BR%7D
/cards?q=c%3C%3DU
```

Most client libraries handle this when query parameters are supplied as a map or `URLSearchParams`. Manual string concatenation is easy to get wrong because quotes, braces, and comparison operators all have special meaning in URLs.

## Unsupported Scryfall Terms

The parser intentionally supports a smaller grammar than Scryfall. Unlisted terms either become plain text search or are rejected by the route validator. Current gaps include full Scryfall layout predicates, keyword ability predicates, artist IDs, watermark and border filters, price filters, game and paper-set availability terms, and full boolean grouping.

Explicit API parameters are the structured option for client UIs. `q` covers human-entered search strings, comparison operators, and compact advanced search syntax.
