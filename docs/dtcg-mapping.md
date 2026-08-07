# DTCG → Design Lasagna mapping

How a DTCG source tree becomes a v0.3 `tokens.json` manifest. This is the contract the resolver implements and the editor writes against.

- Source: [DTCG Format Module 2025.10](https://tr.designtokens.org/format/)
- Extensions: [`v0.3/dtcg-extensions.json`](../v0.3/dtcg-extensions.json)
- Output: [`v0.3/tokens.json`](../v0.3/tokens.json)
- Worked example: [`examples/dtcg-source/`](../examples/dtcg-source) → [`examples/expected/tokens.json`](../examples/expected/tokens.json)

```
.tokens.json (DTCG)  ──resolve──▶  tokens.json (Lasagna)  ──▶  LSP · docs · CI
   + ds.config.json                     generated
```

## The three gaps

DTCG cannot express three things Lasagna needs. Everything below follows from these.

| # | Gap | Resolution |
|---|-----|-----------|
| 1 | `$deprecated` (5.2.4) is only `true \| string`. No removal date, no machine-readable replacement. | `deprecated {message, removal, replacement}` in `$extensions`. Mirror the message into `$deprecated` for cross-tool interop. |
| 2 | **No modes / themes / conditions concept at all.** | File-per-mode, declared in `ds.config.json`. Every source file stays 100% valid DTCG. |
| 3 | `$type` is coarse — `dimension` covers radius, spacing, font-size, border-width. | Granular `type` in `$extensions`; `$type` stays DTCG-valid. |

## Field mapping

| Lasagna Token field | Source | Notes |
|---|---|---|
| `id` | DTCG path joined with `.` | `color.bg.primary` |
| `path` | DTCG path segments | |
| `description` | `$description` | |
| `type` | `$extensions[NS].type` → else `$type` | Granular wins |
| `modes` | `$value` per mode file | Authored form, aliases intact — **the only alias source** |
| `resolved` | resolved `$value` per mode | See serialization below. MUST be fully resolved |
| `sourceFiles` | files the token appeared in | |
| `deprecated` | `$extensions[NS].deprecated` | `$deprecated` alone → `{message}` only |
| `platforms.web` | derived from `ds.config.json` naming | Overridable |
| `platforms.*` | `$extensions[NS].platforms` | |
| `a11y.wcagContrast` | **computed** from resolved colors | Author only overrides |
| `metadata.extensions` | all **non**-Lasagna `$extensions` | MUST be preserved |
| `tier` `collection` `group` `category` `priority` `usage` `docs` `keywords` `tags` `since` `format` | `$extensions[NS]`, with group cascade | |
| `tokenRelations` (root) | hoisted from `$extensions[NS].relations` | Declaring token prepended |
| `conditions` `collections` `designSystem` `source` | `ds.config.json` | |
| `counts` | computed | |

## Resolver rules

### R1 — Group cascade
`$extensions[NS]` on a DTCG group (6.3.2) cascades to all descendants. Nearest ancestor wins; token-level always wins. Only fields in `GroupExtensions` may appear on a group — `since`, `platforms`, `relations` and `metadata` are token-only.

### R2 — Modes come from config, not token syntax
```json
"source": { "files": [
  { "file": "primitives.tokens.json",  "mode": "base"  },
  { "file": "theme.light.tokens.json", "mode": "light" },
  { "file": "theme.dark.tokens.json",  "mode": "dark"  }
]}
```
The same token id across mode files merges into one manifest token with one key per mode in `resolved`. Mode-invariant tokens live in a `base` file.

### R3 — Metadata is declared once, in the default-mode file
Otherwise file-per-mode forces authors to duplicate every description and usage rule across every theme file, and they will drift.

**Rule:** the first file in `source.files` order that declares a field wins. Non-default mode files carry `$value` only. See `theme.dark.tokens.json` in the example — it is values-only by design.

### R4 — Condition keys are flat
One dimension → bare values (`light`, `dark`). Two or more → sorted `dimension:value` segments joined by `/`. Nesting is **not available** — it is ambiguous with `CompositeValue`. Full grammar and rationale: [`condition-keys.md`](./condition-keys.md).

### R5 — Value serialization
`resolved` permits only `string`, `number`, or `CompositeValue`. So:

| DTCG `$value` | `resolved` | Rule |
|---|---|---|
| `{colorSpace, components, hex}` | `"#00427a"` | hex string for web; `format.colorSpace` records the space |
| `{value: 16, unit: "px"}` | `"16px"` | concatenated |
| `["Inter", "Helvetica", "sans-serif"]` | `"Inter, Helvetica, sans-serif"` | **arrays are not valid in `resolved`** — must be joined |
| `700` | `700` | number passthrough |
| typography object | `CompositeValue` | each sub-value serialized by the rules above |

The fontFamily case is easy to get wrong: DTCG font families are arrays, and `resolved` has no array branch.

### R6 — Foreign extensions are preserved (MUST)
DTCG 5.2.3 requires tools to preserve extension data they do not understand. Any `$extensions` key other than `recipes.designlasagna` is copied verbatim to `metadata.extensions`. On write-back the editor must restore them byte-for-byte. Real files carry `com.figma.*` and Tokens Studio blocks; dropping them silently corrupts the source.

### R7 — a11y contrast is computed, not authored
Ratios are derived from resolved colors and `relations` of type `contrast-pair`. Because ratios differ per mode, `wcagContrast` uses the **per-condition map form** — this resolves RFC open question 6. In the example, `color.bg.primary` is 10.19 (light) and 7.09 (dark).

### R8 — No `aliasChain`; `modes` is the alias source
`aliasChain` was **removed in v0.3**. It was unread by every consumer, its v0.2 data merely duplicated `resolved`, and its `string | string[]` type could not represent a token whose chain differs per mode — `color.bg.primary` resolves via `color.blue.500` in light and `color.blue.300` in dark, which a flat list conflates into one false path.

Consumers derive references from `modes` instead, which is already keyed by condition and therefore correct per mode:

```json
"modes":    { "light": "{color.blue.500}", "dark": "{color.blue.300}" },
"resolved": { "light": "#00427a",         "dark": "#52a8e1" }
```

Emitters MUST keep `modes` whenever a token references another token, including refs nested inside composite values. `resolved` MUST NOT contain unresolved `{...}` refs. Both are enforced by `test/validate.mjs`.

Building a transitive dependency graph means walking `modes` across tokens — a few lines in `token-core`, done once, rather than a precomputed field that was wrong for multi-mode tokens.

## Schema changes this work required

**`ContrastInfo` in `v0.3/tokens.json` — added `required: ["ratio"]` and `additionalProperties: false`.**

The `A11y.wcagContrast` `oneOf` was unsatisfiable for the map form. `ContrastInfo` was fully open, so `{"light": {...}, "dark": {...}}` matched *both* branches, and `oneOf` demands exactly one. Any per-mode contrast data would have failed validation. Caught by `test/validate.mjs`.

**`aliasChain` removed from `v0.3/tokens.json`.** See R8. Still present in `v0.2/tokens.json`, which is frozen — a v0.2 → v0.3 migration drops the field, and no consumer needs rewriting because none read it.

## Open items

1. **No schema for `ds.config.json`.** It is a new artifact carrying `designSystem`, `conditions`, `collections`, `source.files` and platform naming. Needs `v0.3/build-config.json`.
2. **Multi-dimension conditions are unexercised.** The example uses one dimension. Add a brand × colorScheme fixture to prove the `dimension:value` key grammar end to end.
3. **`$deprecated` on a DTCG group** deprecates all descendants; interaction with token-level overrides needs a stated precedence rule.
4. **`ds-language-server` still declares `aliasChain?: string`** in `src/parsers/tokens.ts`. Dead code — safe to delete.
