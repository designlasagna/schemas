# @designlasagna/schemas

> Layer your design system right. 🍝

JSON schemas for design system manifests — tokens, utilities, and CEM extensions.

Used by the [Design Lasagna Language Server](https://github.com/designlasagna/language-server) for IntelliSense, diagnostics, and code actions. Also useful for CI validation, documentation tooling, and build pipelines.

## Schemas

| Schema | Purpose |
|--------|---------|
| `v0.2/tokens.json` | Design token manifest (resolved values, modes, multi-platform references, deprecation) |
| `v0.2/utilities.json` | Utility/style preset manifest (categorized, multi-platform, with deprecation) |
| `v0.2/cem-extensions.json` | Extensions to Custom Elements Manifest for lifecycle management |

## Usage

### In manifest files (`$schema`)

```json
{
  "$schema": "https://designlasagna.recipes/v0.2/tokens.json",
  "schemaVersion": "0.2.0",
  "tokens": [...]
}
```

### CI validation

```bash
npm install @designlasagna/schemas ajv-cli
ajv validate -s node_modules/@designlasagna/schemas/v0.2/tokens.json -d dist/tokens.json
```

### Programmatic

```js
import tokenSchema from '@designlasagna/schemas/v0.2/tokens.json' assert { type: 'json' };
import utilitySchema from '@designlasagna/schemas/v0.2/utilities.json' assert { type: 'json' };
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

## License

MIT
