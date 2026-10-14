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
| `v0.3/tokens.json` | v0.3 token manifest schema |
| `v0.3/utilities.json` | v0.3 utility/style preset manifest schema |
| `v0.3/cem-extensions.json` | v0.3 CEM lifecycle extension schema |
| `v0.3/dtcg-extensions.json` | `recipes.designlasagna` metadata for DTCG source files |
| `v0.3/icons.json` | v0.3 icon manifest schema |
| `v0.4/{tokens,utilities,icons}.json` | Current lifecycle contract; explicit profile opt-in required |
| `v0.4/{cem-extensions,dtcg-extensions}.json` | Current standards-compatible lifecycle extensions |
| `v0.4/lifecycle.json` | Shared lifecycle fragments; register alongside v0.4 schemas for offline validation |

The [v0.4 lifecycle guide](docs/lifecycle.md) covers authoring, compatibility,
precedence, inheritance, and [consumer test vectors](examples/lifecycle/consumer-cases.json).
The v0.4 contract shipped in 0.4.0, a breaking pre-1.0 minor release that retains v0.2/v0.3 exports for existing consumers.
Their `$id`s moved under `/schemas/` (see [CHANGELOG.md](CHANGELOG.md)). See the [migration guide](docs/lifecycle-migration.md).

## Usage

### In manifest files (`$schema`)

```json
{
  "$schema": "https://designlasagna.recipes/schemas/v0.4/tokens.json",
  "schemaVersion": "0.4.0",
  "tokens": [...]
}
```

### CI validation

```bash
npm install @designlasagna/schemas ajv-cli
ajv validate -s node_modules/@designlasagna/schemas/v0.4/tokens.json -r node_modules/@designlasagna/schemas/v0.4/lifecycle.json -d dist/tokens.json
```

### v0.4 utility manifest shape

A v0.4 utility manifest must choose exactly one root representation, with neither
preferred: use root `utilities` for a flat list, or root `categories` for a
grouped list whose entries live in each `categories[].utilities` array. Do not
provide both root fields, and do not omit both.

```json
{ "schemaVersion": "0.4.0", "utilities": [{ "name": "display-block" }] }
```

```json
{
  "schemaVersion": "0.4.0",
  "categories": [
    { "name": "Display", "utilities": [{ "name": "display-block" }] }
  ]
}
```

### Programmatic

```js
import tokenSchema from '@designlasagna/schemas/v0.4/tokens.json' with { type: 'json' };
import utilitySchema from '@designlasagna/schemas/v0.4/utilities.json' with { type: 'json' };
```

## DTCG extensions

Token source remains standard DTCG. Design Lasagna-specific governance metadata
belongs in `$extensions["recipes.designlasagna"]` and is validated by
`v0.4/dtcg-extensions.json`. The schema distinguishes group-level fields from
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

Web-only manifests work without `platforms`. The older `cssVariable` and `properties` shorthands are still accepted in v0.4 but are legacy: prefer `platforms.web.reference` and `platforms.web.properties` in new manifests.

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

## Schema policy

Schemas are open and flexible: unknown fields are accepted, and you can validate your files against a version to check that they match it. Tools use the fields they support and ignore the rest. Only Design Lasagna's own DTCG authoring namespace, and objects that must be closed for the schema to work, reject unknown fields. See [Open schemas](docs/openness.md) before proposing any stricter constraint.

## Releases and validation

The v0.4 contract shipped in 0.4.0, a breaking pre-1.0 minor release that retains v0.2/v0.3 exports for existing consumers. See the [migration guide](docs/lifecycle-migration.md) for the compatibility window and consumer migration path.

Validate a checkout before opening a pull request:

```bash
npm ci
npm run validate
npm test
```

Publishing uses npm trusted publishing. A pushed, annotated version tag matching `package.json` runs validation and then publishes with provenance in GitHub Actions. Do not publish from a local machine or retag a release; publish a new version for corrections.

## License

MIT
