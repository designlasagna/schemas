# @designlasagna/schemas

> JSON Schema contracts for Design Lasagna manifests and DTCG authoring extensions.

JSON schemas for design system manifests — tokens, utilities, and CEM extensions.

Used by the [Design Lasagna Language Server](https://github.com/designlasagna/ds-language-server) for IntelliSense, diagnostics, and code actions. Also useful for CI validation, documentation tooling, and build pipelines.

## Schemas

| Schema | Purpose |
|--------|---------|
| `v0.2/tokens.json` | Design token manifest (resolved values, modes, multi-platform references, deprecation) |
| `v0.2/utilities.json` | Utility/style preset manifest (categorized, multi-platform, with deprecation) |
| `v0.2/cem-extensions.json` | Extensions to Custom Elements Manifest for lifecycle management |
| `v0.3/tokens.json` | Current Design Lasagna token manifest schema |
| `v0.3/utilities.json` | Current utility/style preset manifest schema |
| `v0.3/cem-extensions.json` | Current CEM lifecycle extension schema |
| `v0.3/dtcg-extensions.json` | `recipes.designlasagna` metadata for DTCG source files |
| `v0.3/icons.json` | Current icon manifest schema |
| `v0.4/{tokens,utilities,icons}.json` | Unreleased lifecycle contract; explicit profile opt-in required |
| `v0.4/{cem-extensions,dtcg-extensions}.json` | Unreleased standards-compatible lifecycle extensions |
| `v0.4/lifecycle.json` | Shared lifecycle fragments; register alongside v0.4 schemas for offline validation |

The [v0.4 lifecycle guide](docs/lifecycle.md) covers authoring, compatibility,
precedence, inheritance, and [consumer test vectors](examples/lifecycle/consumer-cases.json).
The pending `@designlasagna/schemas@0.4.0` release is an unpublished local artifact;
existing v0.2/v0.3 contracts remain unchanged. See the [migration and release handoff](docs/lifecycle-migration.md).

## Usage

### In manifest files (`$schema`)

```json
{
  "$schema": "https://designlasagna.recipes/schemas/v0.3/tokens.json",
  "schemaVersion": "0.3.0",
  "tokens": [...]
}
```

### CI validation

```bash
npm install @designlasagna/schemas ajv-cli
ajv validate -s node_modules/@designlasagna/schemas/v0.3/tokens.json -d dist/tokens.json
```

### Programmatic

```js
import tokenSchema from '@designlasagna/schemas/v0.3/tokens.json' assert { type: 'json' };
import utilitySchema from '@designlasagna/schemas/v0.3/utilities.json' assert { type: 'json' };
```

## DTCG extensions

Token source remains standard DTCG. Design Lasagna-specific governance metadata
belongs in `$extensions["recipes.designlasagna"]` and is validated by
`v0.3/dtcg-extensions.json`. The schema distinguishes group-level fields from
token-only fields such as `since`, `platforms`, `relations`, and `metadata`.

```json
{
  "$extensions": {
    "recipes.designlasagna": {
      "tier": "semantic",
      "usage": { "allowedProperties": ["background-color"] }
    }
  }
}
```

## Multi-Platform Support

Tokens and utilities support optional `platforms` objects for multi-platform design systems:

### Tokens

```json
{
  "id": "color.bg.primary",
  "cssVariable": "--ds-color-bg-primary",
  "platforms": {
    "web": { "reference": "--ds-color-bg-primary" },
    "ios": { "reference": "DsTokens.color.bgPrimary" },
    "android": { "reference": "DsTheme.colors.bgPrimary" }
  },
  "resolved": { "light": "#00427a", "dark": "#52a8e1" }
}
```

### Utilities

```json
{
  "name": "text-heading-1",
  "description": "Typography style heading level-1",
  "platforms": {
    "web": {
      "className": "ds-text-heading-1",
      "properties": { "font-size": "32px", "font-weight": "bold" }
    },
    "ios": {
      "modifier": ".dsTextHeading1()"
    },
    "android": {
      "style": "DsTypography.Heading1"
    }
  }
}
```

Web-only manifests work without `platforms` — `cssVariable` and `properties` serve as shorthands for the web platform.

## Deprecation Object

Native token, utility and icon manifests share this structured payload. CEM keeps
standard boolean/string `deprecated` with sibling metadata; DTCG keeps standard
boolean/string `$deprecated` plus the structured vendor extension. Do not place
an object in either standard field. See the [v0.4 guide](docs/lifecycle.md) for the
new nonempty-message and explicit-false contract; the example below uses a token ID.

```json
{
  "deprecated": {
    "message": "Use color.primary.pressed instead.",
    "removal": "2027-01-01",
    "replacement": "color.primary.pressed"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `message` | ✅ | Human-readable reason + migration guidance |
| `removal` | | When it will be removed (ISO date, semver, or quarter) |
| `replacement` | | Machine-readable replacement identifier |

## Time-aware diagnostics (in the Language Server)

Target v0.4 consumer policy uses real ISO `removal` dates and UTC calendar days
to escalate severity. This schema change does not implement that policy in the
Language Server; existing consumers differ at the 30-day boundary. Versions and
quarters are display-only and do not derive dates or removed status:

| Removal date | Severity |
|---|---|
| > 90 days away | ℹ️ Information |
| 30–90 days away | ⚠️ Warning |
| < 30 days away | 🔴 Error |
| Past due | 🔴 Error |

## Releases and validation

The currently prepared (not yet published) package version is `@designlasagna/schemas@0.4.0`. This breaking pre-1.0 minor release carries the explicitly selected `v0.4` contract; it retains v0.2/v0.3 exports for existing consumers. See the [migration handoff](docs/lifecycle-migration.md) for the compatibility window and release authorization steps.

Validate a checkout before opening a pull request:

```bash
npm ci
npm run validate
npm test
```

Publishing uses npm trusted publishing. After explicit authorization, a pushed, annotated version tag matching `package.json` (for this release, `v0.4.0`) runs validation and then publishes with provenance in GitHub Actions. Do not publish from a local machine or retag a release; publish a new version for corrections.

## License

MIT
