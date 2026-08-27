# Condition keys in `resolved`

Resolves RFC 0001 open questions **#1** and **#8**.

> #8. How do condition combinations work in `resolved` keys? Is it `"light/main"` (slash-separated), nested objects, or something else?

## Decision: flat, slash-separated keys. Never nested.

### Why nesting is not available

This is forced by the existing schema, not a preference. In `v0.3/tokens.json`:

```json
"resolved": {
  "additionalProperties": {
    "oneOf": [
      { "type": "string" },
      { "type": "number" },
      { "$ref": "#/definitions/CompositeValue" }
    ]
  }
}
```

and

```json
"CompositeValue": {
  "type": "object",
  "additionalProperties": true
}
```

`CompositeValue` is an unconstrained object. So a nested condition map:

```json
"resolved": { "light": { "main": "#00427a" } }
```

is **structurally indistinguishable** from a composite token value:

```json
"resolved": { "light": { "fontSize": "16px", "lineHeight": 1.5 } }
```

A consumer cannot tell whether `resolved.light` is a nested condition dimension or a shadow/typography value without out-of-band knowledge. Nesting is therefore unavailable while `CompositeValue` stays open. **Keys must stay flat.**

## Key grammar

```
key        := "base" | segment ( "/" segment )*
segment    := bareValue | dimension ":" value
```

### One dimension — bare values

```json
"conditions": {
  "colorScheme": { "type": "colorScheme", "values": ["light", "dark"], "default": "light" }
},
"resolved": { "light": "#00427a", "dark": "#52a8e1" }
```

Backwards compatible with v0.2 manifests already using `base` / `light` / `dark`.

### Two or more dimensions — qualified segments

```json
"resolved": {
  "brand:main/colorScheme:light":      "#00427a",
  "brand:main/colorScheme:dark":       "#52a8e1",
  "brand:partner-a/colorScheme:light": "#7a0042",
  "brand:partner-a/colorScheme:dark":  "#e152a8"
}
```

Rules:

1. Segments are **sorted alphabetically by dimension name**. `brand` before `colorScheme`. This makes keys canonical and order-independent — no root-level `conditionOrder` field is needed, and consumers can construct a lookup key without reading the manifest header.
2. Dimension names and values MUST NOT contain `/` or `:`.
3. Bare values are only legal when the system declares exactly one condition dimension. With two or more, every segment MUST be qualified. This removes the ambiguity of `"light/main"`, where you cannot tell which dimension `main` belongs to.
4. `base` is reserved for condition-independent tokens (most primitives) and MUST NOT be combined with other segments.

### Partial keys

A token that varies on only some declared dimensions omits the rest:

```json
"resolved": { "colorScheme:light": "#fff", "colorScheme:dark": "#000" }
```

Consumers resolve by longest-match on the requested condition set, falling back to `base`.

## On `modes` vs `conditions` (open question #1)

`modes` is retained in v0.3 as the **authored** values (may contain unresolved aliases); `resolved` is the fully-resolved output. They are different layers, not duplicates — keep both. `modes` keys use the same grammar as `resolved`.

## Authoring side

DTCG has no modes concept (see `docs/dtcg-mapping.md`). Condition keys are produced by the resolver from **file-per-mode** source mapping declared in `ds.config.json`, so the grammar above is an emitter concern — authors never type these keys by hand.
