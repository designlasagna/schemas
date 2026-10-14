# 0001 — Remove `usage` from token platform mappings

- **Status:** accepted
- **Decided:** 2026-09-05 (commit `b3c6388`, first released in 0.4.0). Recorded 2026-10-14.
- **Applies to:** `PlatformMapping` in `tokens.json` and `dtcg-extensions.json`, v0.3 directory from 0.4.0, and v0.4.

## Decision

A token platform mapping carries only `reference`. The optional `usage`
property is removed.

```json
"platforms": {
  "web": { "reference": "--ds-color-bg-primary" },
  "ios": { "reference": "DsTokens.color.bgPrimary" }
}
```

## Why

`usage` was redundant with `platforms`. The platform key plus `reference`
already tell a consumer how to use the token: on `web`, `--ds-color-bg-primary`
is used as `var(--ds-color-bg-primary)`, and native platforms use the
reference directly. Turning a reference into usage code is the consumer's job —
the language server or a code generator — so storing it in the manifest
duplicated data that could drift from `reference`.

The old README showed an iOS mapping whose `usage` (`Color.dsBgPrimary`)
could not be derived from its `reference` (`DsTokens.color.bgPrimary`). That
was a bad example, not a use case the schema meant to support.

## Consequences

- Producers emit `reference` only. token-core strips `usage` from emitted
  platforms.
- Consumers derive usage syntax from the platform key and `reference`.
- Published 0.3.x releases (up to 0.3.4) still accept `usage`; the `v0.3/`
  files shipped from 0.4.0 do not. The hosted `/schemas/v0.3/` files are
  byte-frozen.
- The same change closed the mapping (`additionalProperties: false`). It was
  reopened in 0.4.6 by [0003](0003-open-platform-mapping.md); `usage` is still
  not part of the schema.

## Migrating

Delete `usage` from every platform mapping. If a design system needs usage
syntax that cannot be derived from `reference`, generate it in its own
tooling for that platform instead of storing it in the manifest.
