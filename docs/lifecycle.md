# Lifecycle authoring — v0.4 (unreleased)

This implements the approved lifecycle design in RFC 0002. The pending package
release is 0.4.0; this checkout is an **unpublished local integration artifact**.
Published v0.2/v0.3 schemas are unchanged by this work. Do not apply v0.4 semantics
retroactively. See the [migration and release handoff](lifecycle-migration.md).

## Select the contract

- Native manifests: use `schemaVersion: "0.4.0"` and the appropriate
  [`v0.4` schema](../v0.4/tokens.json). As before, schemaVersion is validated as
  a string, not a version-dispatch algorithm; consumers must select the right profile.
- CEM and DTCG: explicitly opt into contract `0.4` in the consuming project's
  resolver/configuration. This repository does not prescribe a new config key or
  implement that selection. With no opt-in, retain the legacy profile.
- Never replace standard CEM `schemaVersion` with the Design Lasagna version.
- Offline users must register all six exported v0.4 schemas by `$id` before
  compiling. Relative `$ref`s resolve to `v0.4/lifecycle.json` without network access.

## Native tokens, utilities and icons

Use `deprecated` on the entity, and optional `status` alongside it:

```json
{
  "status": "deprecated",
  "deprecated": {
    "message": "Use space.new.",
    "replacement": "space.new",
    "removal": "2027-01-01"
  }
}
```

This is a lifecycle excerpt, not a complete manifest. `message` is a required,
nonempty string (`minLength: 1`, not a whitespace-trimming rule). `replacement`
and `removal` are optional strings. Native payloads remain open to custom keys.

| Authored value | Meaning |
|---|---|
| absent or `null` | No deprecation assertion; status can still assert it |
| `false` | Explicit negative assertion |
| object | Positive deprecation assertion |
| `true` or string | Not a native manifest representation; migrate from legacy parser allowances |

`status` preserves arbitrary strings. Exactly `deprecated` and `removed` have
lifecycle meaning; other strings are informational, not aliases or case-folded
keywords. Status-only deprecated uses generated message `Deprecated.`. Removed
usage is an error, even with an object supplying its message. Positive same-node
evidence wins over false, with a `lifecycle-conflict` warning; retain the authored
conflict rather than silently deleting it. An absent field must never be
normalized to explicit false before resolving evidence.

## DTCG: standard field plus vendor metadata

Keep standard `$deprecated` as boolean/string; structured details live in
`$extensions["recipes.designlasagna"].deprecated`. Mirror an authored message into
standard `$deprecated` for interoperability. Both token and group extension
namespaces support `status`; their namespaces and payloads remain closed. Do not
put false/null in the extension payload: cancellation is `$deprecated: false`.

1. At one node the extension record wins over a conflicting standard message;
   emit `deprecation-message-mismatch`. Extension object plus standard false is
   positive evidence plus `lifecycle-conflict`.
2. The nearest token/group with explicit deprecation or status deprecated/removed
   supplies the **whole** lifecycle record. Do not merge stale ancestor removal
   or replacement fields into a child's message-only override.
3. No declaration means inherit. False clears inherited deprecation **and removed**.
   Custom status alone is informational: preserve it separately, without clearing
   inherited lifecycle state.
4. Bare standard true becomes `Deprecated.` with `bare-deprecation` warning.
   Track generated provenance internally; a serialized message string cannot
   distinguish this fallback from identical authored text.
5. Value aliases do not transfer lifecycle. Apply standard `$extends` expansion
   before lifecycle selection, not an invented reference-edge inheritance rule.

DTCG 2025.10 §§5.2.4 and 6.3.1 already specify false overriding group defaults.
The additional same-node conflict rules are Design Lasagna policy. Third-party
DTCG consumers may ignore the extension; this is why consistent mirroring matters.

## CEM: do not change standard deprecated

Standard `deprecated` stays boolean/string. Its string is the canonical message;
`status`, `removal`, and `replacement` are sibling vendor metadata. These apply to
declarations, attributes, members, slots, CSS properties, CSS parts and events.

```json
{
  "name": "size",
  "deprecated": false,
  "enum": ["medium", "large"],
  "deprecatedValues": [
    {"value": "medium", "message": "Use large.", "replacement": "large"}
  ]
}
```

This deprecates only `size="medium"`, not the attribute. Attribute and value
axes can both be deprecated; neither suppresses or inherits metadata from the
other. Component deprecation does not implicitly deprecate each child API entry.
Duplicate attribute/member claims for the same owner must surface conflicts.
Bare true gets a generated message; descriptions and message prose are never
parsed into enum deprecation or replacement actions.

[`cem-extensions.json`](../v0.4/cem-extensions.json) and
[`lifecycle.json`](../v0.4/lifecycle.json) are **definitions-only**, not full-document
validators. Select the appropriate fragment and compose it with the pinned
standard CEM schema. Partial fragments must stay open to standard keys; closing
them with `additionalProperties: false` would reject `name`, `kind`, etc.
Tests use upstream CEM revision `d2f79f0d22c4d48a68628cf867c2319576ffc5d2`.

## Replacement identifiers and safe actions

Identifiers, not instructions or platform syntax:

| Entity | Replacement scope |
|---|---|
| Token | token `id`, same manifest/source's resulting token set |
| Utility | utility `name`, same manifest, not necessarily CSS class |
| Icon | icon `name`, same manifest |
| CEM custom element | exact `tagName`, same manifest |
| Other CEM declaration | exact `name`, same module |
| CEM attribute/member/slot/property/part/event | same kind and owner, exact name |
| Attribute value | enum value of that same attribute |

Check inherited group replacements for each descendant independently. Unresolved
or ambiguous targets produce diagnostics and **no action**. Self targets, cycles,
removed targets, or unsafe edits also produce no action. Component replacement
remains diagnostic-only; a verified attribute-name edit may be offered. Migration
instructions belong in message, never replacement.

## Removal and severity

Removal strings may describe ISO calendar dates, semantic versions, or quarters
(`YYYY-Qn`; legacy `Qn-YYYY` remains display-only). Only real dates matching exactly
`YYYY-MM-DD` participate in UTC calendar-day arithmetic. Reject impossible dates
for arithmetic; do not normalize February 30 or guess a date from a version or
quarter. Undatable values display as authored with warning severity.

For deprecated entities: fewer than 30 days (including overdue) → error;
30–90 days inclusive → warning; more than 90 days → info. Missing/undatable
removal → warning. Removed state always remains error. A past removal date never
implicitly authors `status: "removed"`.

## Compatibility and rollout

| Change | Compatibility impact |
|---|---|
| Native false accepted | Old object/null consumers need upgrades |
| Nonempty messages | Narrows the old string contract; empty messages need author input |
| Explicit status on tokens/icons/DTCG | New semantics; custom strings must be retained |
| Whole-record inheritance, conflicts | Behavioral changes, not just additive fields |
| Standard CEM boolean/string and DTCG mirrors | Preserved; no structured object in standard deprecated fields |
| CEM value independence | Removes implicit suppression/prose inference from canonical processing |
| Replacement resolution and UTC bands | Consumer changes; no automatic prose-derived edits |

Upgrade schemas/tests first, then token-core and token-editor producers, then LSP
and UI consumers. Producers must not emit v0.4 to old consumers by default.
Old parser-only forms (native booleans/strings, non-standard raw-DTCG `$status`,
`$removal`, `$replacement`, prose inference) are not canonical schema fields.
Keep them in explicitly selected legacy adapters, not the v0.4 authoring contract.
Converting prose/instruction replacements requires author review, not guessing.

## Examples and consumer conformance

- [Full format examples](../examples/lifecycle/v0.4.json), grouped by format.
- [Valid/invalid schema fixtures](../examples/lifecycle/schema-cases.json).
- [Consumer vectors](../examples/lifecycle/consumer-cases.json): partial expected
  normalization/diagnostic/action assertions with input excerpts and context.

`npm test` executes schema fixtures, standard composition, legacy regressions,
offline references, and packaging checks. It checks consumer-vector structure,
**not their semantic execution**: JSON Schema cannot prove inheritance,
precedence, replacement resolution or time-aware diagnostics. Downstream tasks
must wire vectors into their parser → store → diagnostics → actions tests,
including explicit profile selection and standard `$extends` conformance. No
LSP/token-core implementation or package publishing is included here.
