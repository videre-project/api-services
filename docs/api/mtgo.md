# MTGO Manifest API

For shared response, pagination, caching, and rate-limit behavior, see [API Overview](index.md).

The MTGO manifest API reports the current MTGO ClickOnce deployment metadata used by Videre's ingestion services to detect client updates.

```text
GET /mtgo/manifest
```

The endpoint fetches Daybreak's live MTGO deployment and application manifests, then returns a normalized JSON document directly. Database-backed API routes use the shared `parameters`/`meta`/`data` response envelope; the manifest route returns the manifest document itself.

## Response Shape

The manifest includes:

```text
version
codebase
date
public_key
dependencies
```

`dependencies` is the normalized dependency list from the MTGO application manifest. The array can be long because it includes MTGO client assemblies and third-party assemblies distributed with the client.

Each dependency includes:

```text
name
version
file
size
public_key
hash
```

`public_key` is present on the top-level manifest and on dependencies that publish one. `hash` contains the manifest digest algorithm and value when MTGO publishes one for that dependency.

Example response, abbreviated from live manifest output:

```jsonc
{
  "version": "3.4.157.4683",
  "codebase": "3.4.157.4683.20260701100032",
  "date": "2026-07-01T10:00:32",
  "public_key": "e0b489d8605198df",
  "dependencies": [
    {
      "name": "AdminScene",
      "file": "AdminScene.dll",
      "version": "3.4.157.4683",
      "size": 36864,
      "hash": {
        "algorithm": "sha1",
        "value": "90a5596a74fb25569945bc80f62d5dc97f4d1519"
      }
    },
    {
      "name": "Ben.Demystifier",
      "file": "Ben.Demystifier.dll",
      "version": "0.4.0.0",
      "size": 72704,
      "public_key": "a6d206e05440431a",
      "hash": {
        "algorithm": "sha1",
        "value": "19a9d08812c03c2c3835c21c9e95c865a0594bd"
      }
    },
    {
      "name": "Card",
      "file": "Card.dll",
      "version": "3.4.157.4683",
      "size": 232741888,
      "hash": {
        "algorithm": "sha1",
        "value": "5c93b693cbc4e82efccd5fe05e1ca905717587e"
      }
    },
    {
      "name": "CardManager",
      "file": "CardManager.dll",
      "version": "3.4.157.4683",
      "size": 685056,
      "hash": {
        "algorithm": "sha1",
        "value": "18f2e489f5322a817bd2ce509ffaa3ded7a0db47"
      }
    },
    // ... additional dependencies omitted
  ]
}
```

The manifest endpoint reflects Daybreak's live deployment metadata, so values change whenever MTGO publishes a new client build.
