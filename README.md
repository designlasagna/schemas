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

## Usage

### In manifest files (`$schema`)

```json
{
  "$schema": "https://designlasagna.recipes/v0.3/tokens.json",
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
    "web": {
      "reference": "--ds-color-bg-primary",
      "usage": "var(--ds-color-bg-primary)"
    },
    "ios": {
      "reference": "DsTokens.color.bgPrimary",
      "usage": "Color.dsBgPrimary"
    },
    "android": {
      "reference": "DsTheme.colors.bgPrimary",
      "usage": "DsTheme.colors.bgPrimary"
    }
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

All schemas share a unified deprecation shape:

```json
{
  "deprecated": {
    "message": "Use `--ds-color-primary-pressed` instead.",
    "removal": "2026-07-30",
    "replacement": "--ds-color-primary-pressed"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `message` | ✅ | Human-readable reason + migration guidance |
| `removal` | | When it will be removed (ISO date, semver, or quarter) |
| `replacement` | | Machine-readable replacement identifier |

## Time-aware diagnostics (in the Language Server)

The Language Server uses `removal` dates to escalate diagnostic severity:

| Removal date | Severity |
|---|---|
| > 90 days away | ℹ️ Information |
| 30–90 days away | ⚠️ Warning |
| < 30 days away | 🔴 Error |
| Past due | 🔴 Error |

## Releases and validation

The current published package is [`@designlasagna/schemas@0.3.4`](https://www.npmjs.com/package/@designlasagna/schemas). Its `0.3.x` package line implements the stable `v0.3` schema contract; the package also retains `v0.2` exports for existing consumers.

Validate a checkout before opening a pull request:

```bash
npm ci
npm run validate
npm test
```

Publishing uses npm trusted publishing. A pushed, annotated version tag matching `package.json` (for example, `v0.3.4`) runs validation and then publishes with provenance in GitHub Actions. Do not publish from a local machine or retag a release; publish a new patch version for corrections.

## License

MIT
