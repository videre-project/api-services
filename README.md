# api-services

This repository contains Videre's API-facing TypeScript services:

| Service | Purpose |
|---|---|
| `services/videre-api` | Cloudflare Worker API for Magic: The Gathering data. |
| `services/videre-bot` | Cloudflare Worker Discord bot and interaction handler. |

The repo is a small pnpm workspace over `services/*`, with shared TypeScript defaults in `tsconfig.base.json`.

## Setup

Use Node.js 18 or newer. pnpm is pinned through Corepack:

```sh
corepack enable
pnpm install
```

## Commands

Run a service locally:

```sh
pnpm --filter videre-api run dev
pnpm --filter videre-bot run dev
```

Deploy a service:

```sh
pnpm --filter videre-api run deploy
pnpm --filter videre-bot run deploy
```

Sync Discord commands for the bot:

```sh
pnpm --filter videre-bot run sync
pnpm --filter videre-bot run sync:dev
```

Run the API regression tests:

```sh
pnpm --filter videre-api test
```

To include HTTP route checks against a running local API Worker, start the API and pass its base URL:

```sh
VIDERE_API_BASE_URL=http://localhost:8787 pnpm --filter videre-api test
```

The root `dev` and `deploy` scripts run the matching script across every workspace.

## API Docs

- [API Overview](docs/api/index.md)
- [Cards API](docs/api/cards.md)
- [Sets API](docs/api/sets.md)
- [Products API](docs/api/products.md)
- [Prices API](docs/api/prices.md)
- [Events API](docs/api/events.md)
- [Decks API](docs/api/decks.md)
- [Matches API](docs/api/matches.md)
- [Standings API](docs/api/standings.md)
- [Metagame API](docs/api/metagame.md)
- [Archetypes API](docs/api/archetypes.md)
- [Matchups API](docs/api/matchups.md)
- [MTGO Manifest API](docs/api/mtgo.md)
- [Card Search Syntax](docs/reference/card-search.md)
- [Data Sources And Freshness](docs/reference/data-sources.md)
- [Rate Limits](docs/reference/rate-limits.md)
- [Responses And Errors](docs/reference/responses-and-errors.md)

## License

[Apache-2.0 License](/LICENSE).
