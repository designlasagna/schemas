# Lifecycle v0.4 migration and release handoff

## Version and release boundary

The lifecycle contract is schema version **`0.4.0`** and the pending package release is
**`@designlasagna/schemas@0.4.0`**. This is a breaking pre-1.0 minor release, not a
`0.3.x` patch: it adds a new explicitly selected profile and changes validation and
consumer semantics. It is currently a local, unpublished integration artifact.

Do not publish from a workstation. After review and explicit release authorization,
commit the release, create and push annotated tag `v0.4.0`, and let the trusted
publishing workflow validate and publish it with provenance. The tag must exactly
match `package.json`; never retag or publish `0.3.5` as this contract.

## Compatibility window and selection

| Document/consumer | Required action | Compatibility |
|---|---|---|
| Existing native v0.2/v0.3 manifests | Keep their existing `$schema` and `schemaVersion`; use legacy parsing. | No retroactive validation or reinterpretation. |
| Native v0.4 manifests | Set `schemaVersion: "0.4.0"` and select the matching `v0.4/{tokens,utilities,icons}.json` export. | Requires a v0.4-aware consumer. |
| DTCG and CEM | Select lifecycle profile `0.4` in project/resolver configuration. Do **not** replace CEM's standard `schemaVersion`. | No profile selection means legacy behavior. |
| Producers | Emit v0.4 only after the target consumer explicitly supports/selects it. | Dual support during rollout; do not silently upgrade output. |

A consumer may continue accepting documented legacy parser-only forms only in an
explicit legacy adapter. Native `true`/string deprecation, raw-DTCG `$status`,
`$removal`, `$replacement`, and prose-derived lifecycle data have no automatic,
lossless v0.4 conversion.

## Before and after by format

### Native token, utility, and icon manifests

Before (v0.2/v0.3), leave the profile unchanged:

```json
{ "deprecated": { "message": "Use color.new." } }
```

After (v0.4), opt in at the **manifest root**. `status` and `deprecated` belong
on each token, utility, or icon entry—not beside `schemaVersion`:

```json
{
  "schemaVersion": "0.4.0",
  "tokens": [
    {
      "id": "color.old",
      "status": "deprecated",
      "deprecated": {
        "message": "Use color.new.",
        "replacement": "color.new",
        "removal": "2027-01-01"
      }
    }
  ]
}
```

For utility and icon manifests, use the same lifecycle fields on an entry in their
respective `utilities` or `icons` collection. The surrounding excerpt omits other
format-required fields.

`false` is an explicit negative assertion; absent and `null` are not assertions.
Objects require a nonempty `message`. Preserve arbitrary `status` strings; only
`deprecated` and `removed` have lifecycle meaning. Do not convert a legacy native
boolean/string automatically: request an author message and replacement scope.

### DTCG source

Before, standard deprecation may be only a boolean/string:

```json
{ "$deprecated": "Use color.new." }
```

After, retain the standard interoperable mirror and put structured fields in the
vendor extension:

```json
{
  "$deprecated": "Use color.new.",
  "$extensions": {
    "recipes.designlasagna": {
      "deprecated": { "message": "Use color.new.", "replacement": "color.new" },
      "status": "deprecated"
    }
  }
}
```

Use standard `$deprecated: false` to clear inherited state; never put `false` or
`null` in the extension payload. The nearest explicit lifecycle declaration
replaces the whole inherited record. An extension object wins a same-node conflict
with a standard string/false, which must produce the documented diagnostic.
Expand standard `$extends` before lifecycle selection. Do not migrate raw vendor
`$status`, `$removal`, or `$replacement` fields: move reviewed values into the
extension and retain a standard boolean/string mirror.

### CEM

Before, CEM already uses its standard field:

```json
{ "name": "size", "deprecated": "Use variant." }
```

After, keep that field and add sibling metadata; do not use an object in
`deprecated`:

```json
{
  "name": "size",
  "deprecated": "Use variant.",
  "replacement": "variant",
  "removal": "2027-Q1",
  "deprecatedValues": [
    { "value": "medium", "message": "Use large.", "replacement": "large" }
  ]
}
```

Attribute-level and attribute-value lifecycle are independent. A `deprecatedValues`
entry does not deprecate its attribute. Do not infer either from descriptions or
messages. A CEM component replacement is diagnostic-only; an action requires a
verified, safe member/attribute replacement.

## Precedence and unsupported conversions

Positive same-node evidence (`status: deprecated|removed` or a canonical object)
wins over `false`; preserve the conflicting authored data and report
`lifecycle-conflict`. `removed` is always an error. Custom statuses are
informational. Replacement is an identifier in its entity's local scope, not prose;
unresolved, ambiguous, self, cyclic, removed, or unsafe targets get no action.

Only exact ISO `YYYY-MM-DD` removals drive UTC severity. Semver and `YYYY-Qn` are
displayed as authored; legacy `Qn-YYYY` is display-only. Never infer a removal date,
removed status, replacement, or value deprecation from prose.

## Consumer handoff

The agreed local artifact is this checkout at `@designlasagna/schemas@0.4.0`, with:

- exports: `v0.4/lifecycle.json`, tokens, utilities, icons, CEM extensions, and DTCG extensions;
- examples: `examples/lifecycle/v0.4.json` and `schema-cases.json`;
- executable downstream vectors: `examples/lifecycle/consumer-cases.json`.

DSLS must install the packed artifact (or use a local file dependency), explicitly
select profile `0.4`, and run every consumer vector through parser → normalized
store → diagnostics → actions. Its implementation must retain legacy behavior when
the profile is absent. Token-core and token-editor must likewise avoid emitting v0.4
for an unselected consumer; their required normalization, inheritance, mirror, and
UTC-policy work remains separate follow-up work.

## Verification versus publication

Local verification can prove the checkout/package contents only. Before handoff,
run `npm run validate`, `npm test`, create a tarball with `npm pack`, then install
that tarball into a temporary consumer and resolve all six exports plus the fixture
files. This is **not publication evidence**: npm registry availability, provenance,
tag-triggered CI, and the actually released version exist only after explicit
authorization and the release workflow completes.
