# 0002 — Keep token platform mappings closed

- **Status:** superseded by [0003](0003-open-platform-mapping.md) on 2026-10-15
- **Decided:** 2026-10-14
- **Applies to:** `PlatformMapping` in `v0.4/tokens.json` and
  `v0.4/dtcg-extensions.json`.

## Decision

Each platform mapping entry stays closed: exactly `{ "reference": "<string>" }`,
with `reference` required and no other keys. This is an accepted exception to
[Open schemas, warning tools](../openness.md).

Only the entry is closed. The `platforms` object accepts any platform key, and
the token itself stays open.

```jsonc
"platforms": {
  "flutter": { "reference": "DsColors.bgPrimary" },     // valid: any platform key
  "web": { "reference": "--x", "usage": "var(--x)" }     // invalid: extra key
}
```

## Why

After [0001](0001-remove-platform-mapping-usage.md) a mapping has one job: to
say what the token is called on that platform. There is nothing left on it for
a team to extend, and a closed entry makes a leftover `usage` or a typo such as
`refrence` fail instead of being silently ignored.

## Consequences

- Custom per-platform data goes on the token, for example under `metadata`,
  not inside the mapping entry.
- Opening the entry later is a relaxation and fits in a 0.4.x patch. Revisit if
  teams need per-platform data that does not belong on the token.
