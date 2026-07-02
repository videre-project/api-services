# Data Sources And Freshness

This page explains what the Videre API is actually serving. It is written for client authors who need to decide whether a field is raw MTGO data, Videre classification, imported catalog metadata, or derived API output.

For route shapes and response fields, see the endpoint docs under [`docs/api`](../api/index.md). For response envelopes and error behavior, see [Responses And Errors](responses-and-errors.md).

## Request-Time Model

API requests read the current state of `mtgo-db` and return JSON built from that database state. Ingestion work happens before request time in MTGOBot and CardExporter: MTGO login, tournament-page scraping, image rendering, and MTGO client-file reads are upstream import steps rather than request-time API work.

That means freshness is determined before the request starts:

```text
MTGOBot imports event data      -> mtgo-db -> API event routes
CardExporter imports catalog    -> mtgo-db -> API catalog routes
CardExporter uploads images     -> R2      -> API image_url fields
```

If an event has not been imported yet, it cannot appear in `/events`, `/decks`, or aggregate event routes. If a new MTGO build has not been processed by CardExporter yet, new catalog rows, legality changes, or images from that build may not be visible through `/cards`, `/sets`, or `/products`.

## Producers

The API database is populated by two separate ingestion projects:

- [MTGOBot](https://github.com/videre-project/MTGOBot) provides MTGO event, deck, match, standing, player, and archetype data.
- [CardExporter](https://github.com/videre-project/CardExporter) provides MTGO card catalog, set, product, face, legality, image, and client-asset data.

These projects have different update triggers. MTGOBot follows tournament data as events become available. CardExporter follows MTGO client data and the MTGO deployment manifest. A card-catalog update and an event-data update are therefore independent; one can be current while the other is still catching up.

## Route-To-Source Map

This table maps each route family to the data source behind it.

| Route family | Primary source | Notes |
|---|---|---|
| `/events` | MTGOBot | Imported event metadata. |
| `/decks` | MTGOBot | Imported decklists plus current Videre archetype labels. |
| `/matches` | MTGOBot | Imported round and game records when source data includes them. |
| `/standings` | MTGOBot | Imported final standings and tiebreaker fields. |
| `/metagame` | MTGOBot-derived | Aggregate over imported decks and non-mirror matches. |
| `/archetypes` | MTGOBot-derived | Aggregate over imported decklists and Videre archetype labels. |
| `/matchups` | MTGOBot-derived | Aggregate over imported matches and archetype labels. |
| `/cards` | CardExporter | Imported MTGO card catalog, faces, legalities, and generated fields. |
| `/sets` | CardExporter | Imported or inferred MTGO set metadata and catalog counts. |
| `/products` | CardExporter | Imported non-card MTGO catalog entries. |
| `/mtgo/manifest` | Live MTGO manifest | Daybreak deployment metadata fetched by the API. |

The aggregate event routes are views over the same imported event, deck, match, and archetype tables. If an aggregate looks surprising, inspect the raw rows for the same `event_id`, `format`, and date window.

## Event Data

MTGOBot records tournament data from MTGO and writes it into `mtgo-db`. The API exposes that data at two levels.

Raw event routes:

- `/events` returns event records.
- `/decks` returns decklists and current archetype labels.
- `/matches` returns round-by-round match rows.
- `/standings` returns final standings and tiebreakers.

Derived event routes:

- `/metagame` returns archetype share and non-mirror win rates.
- `/archetypes` returns card adoption inside archetypes.
- `/matchups` returns archetype-versus-archetype win rates.

Raw routes expose the imported rows needed to reproduce an event, build a local dataset, or apply an external classification. Derived routes expose Videre's current model of a format over an event window.

The distinction matters because derived routes embed choices:

- Which archetype label a deck currently has.
- Whether mirror matches are excluded from win-rate calculations.
- Which event/date window is being summarized.
- How confidence intervals and percentages are formatted.

Those choices are part of the derived response. The raw routes carry the event rows needed for auditability.

## Archetype Labels

Archetype names and IDs are Videre classifications. They are mutable derived fields, not official MTGO source facts.

The decklist is the stable evidence. The archetype label is Videre's current interpretation of that decklist. Labels can change when:

- New decks require a classification rule update.
- Historical events are reprocessed.
- An archetype is split into more specific labels.
- Several labels are consolidated.
- Classification code is corrected.

Metagame pages generally display the current label. Research, reproducibility, and external classification workflows need the decklist and `event_id`, not only the current archetype string.

## Match And Standing Completeness

MTGO source data is not equally rich for every event. Some events have complete decklists, standings, match rows, and game-level results. Others may have partial match data or missing game details.

Important patterns:

- Bye rows can have missing opponent deck fields.
- Older events may have less complete game-level data.
- Player names are source data and can change in spelling or casing.
- Tiebreaker fields depend on what the source event exposes.

For matchup analysis, `match_count` and `game_count` are the sample-size fields behind the win-rate percentages. For deck or event reconstruction, `event_id` filters keep all rows tied to the same source event.

## Card Catalog Data

CardExporter imports MTGO catalog data from the local MTGO client and related client resources. Its inputs include:

- Card XML from the MTGO ClickOnce data directory.
- Runtime client models used to fill set metadata gaps.
- Validation-rule files that describe format legalities.
- Client assemblies and WPF resources used for rendered assets.

The API is intentionally MTGO-focused. A card result describes an MTGO catalog object rather than a universal paper printing. Fields such as `id`, `set_code`, `frame_style`, `promo_label`, `art_id`, and product `object_type` come from the MTGO catalog model.

CardExporter writes the catalog tables used by the API:

- `cards`
- `oracle_cards`
- `card_faces`
- `sets`
- `products`
- `card_legalities`
- `card_catalog_variants`

`/cards` returns playable and token card catalog rows. `/products` returns non-card catalog objects such as tickets, boosters, complete sets, trophies, and other MTGO product entries. `/sets` returns set metadata and catalog counts.

## Printings, Oracle Cards, And Catalog IDs

The API exposes both printing-level and oracle-level behavior.

`id` is the MTGO catalog ID for a specific card row. It is the identifier used for card image URLs and exact collection matching.

`oracle_id` groups functionally equivalent printings. `unique=cards` collapses search results to one representative per oracle card. `unique=prints` returns individual MTGO print rows.

For collection features, catalog IDs represent printing-specific inventory. Oracle matching treats ownership of any printing as ownership of all functionally equivalent printings.

## Legalities

Card legalities are imported from MTGO validation-rule data and normalized into format/status pairs.

Legalities are oracle-based in the API. This is the behavior most users expect when searching for cards playable in a format: an old printing of Lightning Bolt can appear in a Modern-legal search because Lightning Bolt the oracle card is Modern legal.

That behavior is different from asking "which printings were released after Modern began?" For printing-era questions, combine legality with printing filters:

```text
/cards?q=!"Lightning Bolt" format:modern unique:prints
/cards?q=!"Lightning Bolt" format:modern year>2020 unique:prints
/cards?q=!"Lightning Bolt" format:modern set:MM2 unique:prints
```

`set`, `released`, and `year` constrain the printed object in addition to the oracle card's legality.

## Images

Card and product image URLs are deterministic:

```text
https://r2.videreproject.com/cards/{id}-300px.png
https://r2.videreproject.com/products/{id}-300px.png
```

The API returns the deterministic image URL for the catalog ID after CardExporter has rendered and uploaded the image. Image availability is determined by the prior upload and CDN sync state rather than a request-time Cloudflare R2 check.

This matters in two cases:

- Fresh catalog import: the database row may exist before the image sync has finished.
- Catalog variants: some MTGO foil clone IDs are stored as variants rather than separate card rows, so they usually lack separate `/cards` API rows and image URLs.

Image fetch failures are possible. A missing image can reflect image sync state rather than an invalid card row.

## Set Metadata

Set names, release dates, and set types are derived from MTGO client metadata and CardExporter parsing. They are meant to support MTGO catalog search and filtering.

Paper set taxonomy can differ from these values. MTGO can represent digital products, promos, tokens, and special catalog entries differently from paper Magic references.

Set counts in `/sets` describe imported MTGO catalog rows:

- `card_count` counts non-token card catalog rows.
- `token_count` counts token card catalog rows.
- `product_count` counts non-card product catalog rows.

These counts describe the MTGO catalog representation of a set rather than an authoritative paper checklist.

## Freshness Signals

The API exposes the current live MTGO manifest:

```text
GET /mtgo/manifest
```

That endpoint fetches Daybreak's deployment metadata and reports the live MTGO client version and codebase. A changed manifest means MTGO has published a new client build.

A changed manifest reports deployment state only. A new manifest can appear before CardExporter has imported catalog changes, updated legalities, rendered images, and synchronized R2.

Practical freshness checks:

- For event freshness, check `/events` for the expected format, date, and event name.
- For catalog freshness, compare `/mtgo/manifest` with the CardExporter source manifest state.
- For image freshness, fetch the returned `image_url` and handle missing images gracefully.
- For aggregate freshness, compare `/metagame`, `/archetypes`, or `/matchups` against raw rows for the same event window.

## Stable Identifiers

Stable identifiers are reproducible references. Display strings alone are not:

- `event_id`
- deck ID
- match ID
- card `id`
- `oracle_id`
- `set_code`
- query date or import date

Names, archetype labels, and some metadata fields are display fields. They may change after reclassification or catalog correction.

## Known Data Caveats

Source-data limits:

- Older events may have less complete match or game-level data.
- Bye rows can have missing opponent deck fields.
- Archetype labels are Videre-derived and can change after reclassification.
- MTGO catalog metadata can differ from paper Magic metadata.
- Image URLs are deterministic, but image availability depends on CDN sync state.

Raw event and catalog endpoints carry the provenance behind aggregate views. Store the identifiers and query date used by the client when exact provenance matters.
