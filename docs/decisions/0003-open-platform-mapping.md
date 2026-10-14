# 0003 — Open token platform mappings

- **Status:** accepted
- **Decided:** 2026-10-15
- **Supersedes:** [0002](0002-keep-platform-mapping-closed.md)
- **Applies to:** `PlatformMapping` in `v0.4/tokens.json` and
  `v0.4/dtcg-extensions.json`.

## Decision

A platform mapping entry is open. `reference` is the only defined field and
stays required; any other field is accepted.

```jsonc
"platforms": {
  "web": { "reference": "--x" },                        // valid
  "ios": { "reference": "Ds.x", "module": "DsTokens" }  // valid: extra data
}
```

## Why

Schemas are open and flexible, so they don't force a design system into one
structure (see [Open schemas](../openness.md)). The only reason for keeping the
entry closed was catching typos and a leftover `usage`, and that is not a
reason to close an object.

Decision [0001](0001-remove-platform-mapping-usage.md) still holds: `usage` is
not part of the schema, and consumers derive usage from the platform key and
`reference`. A manifest that still carries `usage`, or other per-platform data,
is now accepted and tools ignore what they don't support.

## Consequences

- This only relaxes validation, so it ships in a 0.4.x patch. Every manifest
  valid under 0.4.5 stays valid.
- Validators older than 0.4.6 reject extra fields in a mapping.
- `v0.3/` is byte-frozen and keeps the closed mapping.
