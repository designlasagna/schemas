# DTCG → Design Lasagna mapping

How a DTCG source tree becomes a v0.3 `tokens.json` manifest. This is the contract the resolver implements and the editor writes against.

- Source: [DTCG Format Module 2025.10](https://tr.designtokens.org/format/)
- Extensions: [`v0.3/dtcg-extensions.json`](../v0.3/dtcg-extensions.json)
- Output: [`v0.3/tokens.json`](../v0.3/tokens.json)
- Worked example: [`examples/dtcg-source/`](../examples/dtcg-source) → [`examples/expected/tokens.json`](../examples/expected/tokens.json)
- Model: [`concepts.md`](./concepts.md) — what groups, modes, collections and tiers each decide, and why only one of them is a hierarchy

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
| `type` | `$extensions[NS].type` → else `$type` → else target's `$type` | Granular wins; inherited through whole-token references |
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

### R8 — No `aliasChain`; `modes` is the alias source`aliasChain` was **removed in v0.3**. It was unread by every consumer, its v0.2 data merely duplicated `resolved`, and its `string | string[]` type could not represent a token whose chain differs per mode — `color.bg.primary` resolves via `color.blue.500` in light and `color.blue.300` in dark, which a flat list conflates into one false path.

Consumers derive references from `modes` instead, which is already keyed by condition and therefore correct per mode:

```json
"modes":    { "light": "{color.blue.500}", "dark": "{color.blue.300}" },
"resolved": { "light": "#00427a",         "dark": "#52a8e1" }
```

Emitters MUST keep `modes` whenever a token references another token, including refs nested inside composite values. `resolved` MUST NOT contain unresolved `{...}` refs. Both are enforced by `test/validate.mjs`.

Building a transitive dependency graph means walking `modes` across tokens — a few lines in `token-core`, done once, rather than a precomputed field that was wrong for multi-mode tokens.

### R9 — Both reference syntaxes, with different reach
DTCG 7.5.1 requires tools to support both. They are not interchangeable:

| | Curly brace `{a.b}` | JSON Pointer `$ref` |
|---|---|---|
| Targets | whole tokens only | any document location |
| Implicit path | appends `/$value` | explicit, full path |
| **Reach** | **any file in the project** | **its own file only** |

Curly-brace aliases resolve against the merged token namespace, so they cross mode files freely. JSON Pointers are document-scoped — `#/` is the root of the file the reference was authored in, and DTCG defines no cross-document pointer form. A pointer aimed at another file raises `unresolved-pointer`.

This is a feature for file-per-mode: `theme.light` and `theme.dark` can carry a byte-identical `{ "$ref": "#/palette/seed" }` and each resolves to its own seed. See `color.accent` in `examples/dtcg-pointers/`.

A token-level `$ref` replaces `$value` entirely, so such a node is a **token, not a group**, and inherits `$type` from its target when it declares none.

### R10 — Platform references are sanitized
DTCG permits token names that are illegal in a CSS custom property — a group named `ui/legacy` yields `--ds-ui/legacy-accent`. Characters outside `[A-Za-z0-9_-]` are replaced with `-` and a `sanitized-platform-reference` warning is raised. Sanitization can in principle collide; the warning is what surfaces it.

### R11 — `$extends` is expanded before the token walkDTCG 6.4 lets a group inherit from another group. Because it changes the shape of the tree, it is resolved first — a file using `$extends` would otherwise lose every inherited token silently, since `$`-prefixed keys are skipped by the walk.

Merge semantics (6.4.3) are asymmetric and easy to get wrong:

| At the same path | Behaviour |
|---|---|
| group + group | merge recursively |
| token + anything | **complete replacement** — not property-by-property |
| local `$`-property | overrides the inherited one |

References use either syntax (`{group}` or `#/group`) and are **document-scoped**, like `$ref` (R9). Groups are not addressable across files, and expansion runs before files are merged into one token namespace.

Cycles are rejected, including the non-obvious case in spec example 16 where a group extends its own **ancestor** — resolving the parent requires resolving the child.

**Sharp edge: inherited aliases are absolute.** Deep merge copies token definitions verbatim, so an alias inside an inherited token keeps pointing at the original group:

```json
"button":           { "color": "#00ffff",
                      "border": { "$value": { "color": "{button.color}" } } },
"button-secondary": { "$extends": "{button}", "color": "#666666" }
```

`button-secondary.border` resolves to `#00ffff`, **not** the local `#666666`. DTCG has no relative or self reference — example 15 writes `{extended.color}` explicitly — so this is correct but surprising. A linter rule flagging inherited aliases that point outside the extending group would be worth having.

### R12 — Deprecation is only read from where the schema declares it
A token counts as deprecated when, and only when, it declares one of:

1. `$extensions["recipes.designlasagna"].deprecated` — with `message`, and optionally `removal` and `replacement`
2. DTCG `$deprecated` — `true` or a message string

Nothing else is inspected. In particular, a notice written in `$description` — *"Deprecated. Replaced with X. Will be removed 10 jan 2027."* — is prose, and the resolver treats it as prose.

This is deliberate. Design tools upstream of DTCG often expose only a description field, so real systems do carry lifecycle information there, and it is tempting to parse it. Resist it:

- Every convention is different, in every language, and the tail never ends.
- An inferred `removal` date makes the language server raise hard errors from a regex reading of a sentence.
- An inferred `replacement` drives a code action, so a wrong guess edits somebody's source.
- The manifest would assert lifecycle state the source never declared, and schema validation would then be validating an invention.

Migrating prose into one of the two supported forms is the design system author's job, and a one-off one. The resolver's contract is that the manifest reflects what the source actually says.

## Schema changes this work required

**`ContrastInfo` in `v0.3/tokens.json` — added `required: ["ratio"]` and `additionalProperties: false`.**

The `A11y.wcagContrast` `oneOf` was unsatisfiable for the map form. `ContrastInfo` was fully open, so `{"light": {...}, "dark": {...}}` matched *both* branches, and `oneOf` demands exactly one. Any per-mode contrast data would have failed validation. Caught by `test/validate.mjs`.

**`aliasChain` removed from `v0.3/tokens.json`.** See R8. Still present in `v0.2/tokens.json`, which is frozen — a v0.2 → v0.3 migration drops the field, and no consumer needs rewriting because none read it.

## Open items

1. **No schema for `ds.config.json`.** It is a new artifact carrying `designSystem`, `conditions`, `collections`, `source.files` and platform naming. Needs `v0.3/build-config.json`.
2. **Multi-dimension conditions are unexercised.** Both fixtures use one dimension. Add a brand × colorScheme fixture to prove the `dimension:value` key grammar end to end.
3. **`$deprecated` on a DTCG group** deprecates all descendants; interaction with token-level overrides needs a stated precedence rule.
4. **`ds-language-server` still declares `aliasChain?: string`** in `src/parsers/tokens.ts`. Dead code — safe to delete.
5. **Inherited aliases have no relative form.** See R11. Worth a lint rule rather than a schema change.

## Fixture projects

| Project | Covers |
|---|---|
| `examples/dtcg-source` → `examples/expected/tokens.json` | curly-brace aliases, two modes, group cascade, composite values, deprecation with removal date, foreign `$extensions`, computed per-mode contrast |
| `examples/dtcg-pointers` → `examples/expected/pointers.tokens.json` | JSON Pointer references: whole-token, colour component, dimension value/unit, typography sub-properties, chaining onto curly-brace, and per-document resolution across mode files |

Both are validated by `test/validate.mjs` and reproduced byte for byte by `@designlasagna/token-core`.
