# RFC 0002: Lifecycle Contract — Deprecation Across Formats

> **Status:** Accepted for implementation — Magnus approved the proposed contract on 2026-09-21 (“okey.. lets do it”).
> **Approval record:** D1–D14 below are approved. “Pending approval” wording and decision checkboxes in the original proposal are retained as historical draft wording, superseded by this record. Implementation gates still require verification; no publication or downstream runtime implementation is authorized by this RFC acceptance.
> **Authors:** AI-assisted draft for Magnus review
> **Created:** 2026-09-21
> **Target version:** 0.4.0
> **Related:** RFC 0001 (A4 status, B9 icons), `docs/dtcg-mapping.md` (R1, R12, open item 3), `README.md` (Deprecation Object, Time-aware diagnostics)

## Summary

A read-only audit of the v0.3 lifecycle surface (schemas, DTCG mapping docs, token-core, ds-language-server, token-editor) found that **what the schemas declare, what the schemas enforce, and what the consumers actually do are three different contracts**. The gaps that matter:

1. A DTCG source token with bare `$deprecated: true` has no defined valid v0.3 manifest projection — `message` is required on output, but the boolean carries no message.
2. Group-level deprecation precedence is both specified and still open (`docs/dtcg-mapping.md` open item 3): does the nearest declaration replace the inherited record, merge fields, and what does `$deprecated: false` do?
3. CEM lifecycle fields are definition-only, internally uneven, and are not a validating contract.
4. Consumers normalize `deprecated`/`status` inconsistently: explicit `false` vs. absence is indistinguishable after DSLS normalization, `removed` is not recognized outside CEM, CEM attribute `replacement` is declared by the schema but dropped by DSLS, and CEM value deprecation is partly inferred from prose.

This RFC proposes one lifecycle contract for all formats — canonical payload, placement per format, DTCG inheritance semantics, status semantics, replacement resolution, removal-date handling, and the versioning boundary (v0.4, not retroactive to v0.3). Every recommendation is **pending approval**; implementation is gated on the approval checklist at the end.

**Non-goals:** no schema or code changes in this step; no change to v0.3 semantics for already-published documents; no new tooling beyond the tests listed below.

---

## 1. Current state: normative fields vs. what is actually enforced

### 1.1 Schema side

| Surface | Schema declares (normative) | What the schema actually enforces | Gap |
|---|---|---|---|
| v0.2 tokens | `tokens[].deprecated`: `null \| object`; object requires `message`; `removal`, `replacement` optional (`v0.2/tokens.json`) | message required; **object is permissive** — no `additionalProperties: false`, arbitrary sibling keys validate | permissiveness |
| v0.3 tokens | same shape (`v0.3/tokens.json`, `Deprecated` definition); no `status`, no `removed` field on tokens; `since` independent | same permissiveness | no way to state explicit "not deprecated" |
| v0.2 utilities | `categories[].utilities[].deprecated`: `null \| object`; `message` required (`v0.2/utilities.json`) | same | no `status` |
| v0.3 utilities | nested `categories[].utilities[]` **or** root `utilities[]` (`oneOf`); `status` is any string with recommended values; `deprecated`: `null \| object`, `message` required | same permissiveness | `status` semantics undefined in schema |
| v0.3 icons | `icons[].deprecated`: `null \| object`, `message` required; `since` optional; no `status` (`v0.3/icons.json`) | same | no `status` |
| v0.2/v0.3 CEM | definitions only — `LifecycleFields` {`status`, `removal`, `replacement`}, `AttributeExtensions` {`enum`, `removal`, `replacement`, `deprecatedValues`}, `Slot/CssPropertyExtensions` {`deprecated: boolean\|string`, `removal`, `replacement`}, `DeprecatedValue` {`value`, `message` required, `removal?`, `replacement?`} (`v0.3/cem-extensions.json`; v0.2 similar, with `status` a 3-value enum) | **no validating root at all** — no root `type`/`$ref`/required structure; definitions are permissive (no `additionalProperties: false`) | validating a CEM document against the file imposes zero lifecycle constraints |
| v0.3 DTCG extensions | `$extensions["recipes.designlasagna"]`: `TokenExtensions`/`GroupExtensions`/`Deprecated` all **strict** (`additionalProperties: false`); `Deprecated` requires `message`; `replacement` described as "MUST resolve"; group `deprecated` "deprecates every descendant, descendants MAY override" (`v0.3/dtcg-extensions.json`) | strictness is real, but "MUST resolve" is description-only — JSON Schema enforces `string` only; group override semantics left open | resolution unenforced by schema; inheritance open |
| DTCG 2025.10 (local) | `$deprecated: boolean \| string` on root, group, token; `$extends`; open `$extensions` (`dtcg/2025.10/format.json`) | type validation only; does not implement inheritance | normative prose must be checked separately; schema inspection cannot establish absence of standard semantics |

Notes:

- The README's "unified deprecation shape" claim (`{message, removal, replacement}`) is true for token/utility/icon manifest objects only — not for CEM (`boolean|string` + sibling fields) nor standard DTCG (`true|string`). The claim needs narrowing in the docs (gated, §11.3).
- `removal` is a bare `string` everywhere; date/semver/quarter formats are descriptive text only, and the two CEM-era descriptions disagree on quarter format (`Q3-2026` in `v0.2/cem-extensions.json` vs. `2026-Q3` in `v0.3/dtcg-extensions.json`).
- The fixture semantic check `test/validate.mjs` enforces replacement resolution for token manifests only (`every deprecated.replacement resolves`), not utilities, icons, CEM, or source documents.

### 1.2 Consumer side (audited behavior)

| Consumer | Behavior today | Contract gap |
|---|---|---|
| DSLS tokens parser | handles v0.3 structured object **and** legacy flat; normalizes absent `deprecated` to `false`; raw-DTCG walker reads non-standard `$status`, `$removal`, `$replacement` and ignores `$extensions["recipes.designlasagna"]` entirely (`ds-language-server/src/parsers/tokens.ts`) | two ingest paths disagree; explicit `false` vs. absence lost |
| DSLS utilities parser | `parseDeprecated` accepts **boolean\|string only** — a v0.3 structured object falls into the string branch; `parseStatus` whitelists 4 values and discards the arbitrary statuses the v0.3 schema allows (`src/parsers/utilities.ts`) | schema-valid inputs silently lose data |
| DSLS `isDeprecated()` | explicit boolean takes precedence; only `status === "deprecated"` counts — **not** `"removed"` (`src/lifecycle.ts`); CEM alone special-cases status-only `deprecated`/`removed` (`src/parsers/cem.ts`) | status semantics ad hoc per format |
| DSLS CEM parser | reads `status`, `removal`, `deprecated`, `deprecatedValues`; **neither attribute nor member reads `replacement`**, so attribute quick-fixes cannot be produced from canonical CEM metadata; additionally infers deprecated values from a deprecation-message regex (`detectDeprecatedValues`) | schema-declared field dropped; prose inference can drive unsafe code actions |
| token-core `buildDeprecated` | extension object wins over standard `$deprecated`; message conflict → `deprecation-message-mismatch` warning; standard string → `{message}`; bare `true` → warning + ad-hoc generated message `"This token is deprecated."` (`token-core/src/emit.ts`) | generated message is not a documented constant |
| token-editor `lifecycleBand` | severity from local-time day count, `days < 30` → error (`token-editor/src/shared/manifest.js`) | at exactly 30 days: editor = warning, DSLS (`<= 30`) = error; different timezone bases |

---

## 2. Canonical deprecation payload

One shape, used by every resolved manifest and as the extension object in DTCG source:

```json
"deprecated": {
  "message": "Use color.bg.primary instead.",
  "removal": "2026-07-30",
  "replacement": "color.bg.primary"
}
```

| Field | Required | Type | Rules |
|---|---|---|---|
| `message` | yes | string | **Non-empty** — v0.4 adds `minLength: 1` (v0.3 only requires presence; `""` currently validates). Human-readable reason + migration guidance. |
| `removal` | — | string | ISO date `YYYY-MM-DD`, semver `X.Y.Z`, or quarter `YYYY-Qn` (§9). Only ISO dates are machine-evaluable. |
| `replacement` | — | string | Machine-readable replacement identifier, **scoped by entity type** (§8). Must not point at a different entity kind. |

Payload states — the full lifecycle claim for an entity:

| State | Meaning |
|---|---|
| absent / `null` | **Not asserted.** No lifecycle claim. Consumers treat as not-deprecated unless `status` says otherwise (§6). |
| `false` (manifests in v0.4; DTCG source) | **Explicitly not deprecated.** A positive assertion that the entity is not deprecated; clears inherited deprecation in DTCG source (§5). |
| `{message, removal?, replacement?}` | **Deprecated.** The canonical record. |

Native manifest payloads remain permissive on unknown keys. The DTCG extension namespace and payload remain closed, as in v0.3. DTCG cancellation uses standard `$deprecated: false`, not extension `deprecated: false`.

---

## 3. Placement per format

Where each lifecycle field lives, format by format (v0.4 target):

| Format / entity | Deprecation | Status | Removal / replacement | Value level |
|---|---|---|---|---|
| Token manifest | `tokens[].deprecated`: `false \| null \| object` (v0.4) | `status` (v0.4, new) | inside the object | — |
| Utility manifest | `utilities[].deprecated` (nested and flat): `false \| null \| object` (v0.4) | `status` (existing v0.3) | inside the object | — |
| Icon manifest | `icons[].deprecated`: `false \| null \| object` (v0.4) | `status` (v0.4, new) | inside the object | — |
| CEM declaration | sibling `deprecated: boolean \| string` (standard CEM slot), plus `status`, `removal`, `replacement` | `status` (existing) | sibling fields | — |
| CEM attribute / member | sibling `deprecated: boolean \| string`, plus `removal`, `replacement`, `deprecatedValues[]` | — | sibling fields | `deprecatedValues[].{value, message, removal?, replacement?}` |
| CEM slot / cssProperty | sibling `deprecated: boolean \| string`, plus `removal`, `replacement` | — | sibling fields | — |
| DTCG source token / group | standard `$deprecated: boolean \| string` (mirror) **+** `$extensions[NS].deprecated: object` (canonical, `message` required) | `$extensions[NS].status` (v0.4, new) | extension object only | — (DTCG has no value level) |

The CEM table summarizes current common placements, not a restriction on the proposed profile: apply sibling `status`, `removal`, and `replacement` to declarations, attributes, members, slots, CSS properties, CSS parts, and events wherever the pinned standard supports `deprecated`. `deprecatedValues` is specifically an attribute-value extension. Component deprecation does not implicitly deprecate each child API entry. Validate attribute/member duplicates against the same owner; conflicting duplicate claims require a diagnostic rather than arbitrary precedence.

Key points:

- DTCG source keeps standard `$deprecated` as a `boolean|string` mirror for interop; the extension object is the canonical record (existing R3 mapping in `docs/dtcg-mapping.md`).
- CEM keeps the standard `deprecated: boolean|string`; the deprecation *message* maps to that standard string (§4) — the same strategy as DTCG source.
- No format has deprecation below value level except CEM attribute values.
- `since`, `priority`, `tier` are independent of deprecation — deprecation implies none of them (existing R2).
- `status`, `deprecated`, `removal`, `replacement`, `deprecatedValues` are the only lifecycle fields; everything else (descriptions, metadata) is prose or metadata, never lifecycle (§10).

---

## 4. CEM design decision: alternatives

**Option A — keep the existing sibling fields (recommended).** Standard CEM `deprecated: boolean | string` on declarations/attributes/slots/cssProperties, plus the Lasagna siblings `status`, `removal`, `replacement`, `deprecatedValues`. The deprecation *message* maps to the standard CEM string, exactly as DTCG source maps message → `$deprecated` string. Schema changes (v0.4): publish explicit composable entry definitions and full-CEM validation fixtures; `DeprecatedValue.message` becomes non-empty. Partial sibling extension definitions must remain permissive: `additionalProperties: false` would reject standard CEM keys such as `name`.

- Pros: this is already how DSLS reads CEM; siblings preserve the existing authoring layout without inventing a new vendor container; `deprecated: true` stays interoperable with non-Lasagna CEM tooling; authoring and the README CEM example are unchanged; no new machinery.
- Cons: the siblings are un-namespaced (collision risk with future standard CEM keys; validation cannot eliminate that risk); message + metadata are split across fields on one entry.

**Option B — namespaced object.** `$extensions["recipes.designlasagna"] = {deprecated: {...}}` on CEM entries (the DTCG shape).

- Viable alternative: a vendor-owned object avoids sibling collisions and keeps the common payload intact. `$extensions` would be our convention, not a standard CEM mechanism. Standard `deprecated` must still be mirrored for interoperability. Costs: updating existing readers and dual-location migration. Not preferred for this revision, but not inherently incompatible with CEM.

**Option C — sidecar file.** A separate lifecycle file keyed by tag name/attribute.

- Cons: breaks CEM's self-contained nature; two sources of truth; drift. Rejected.

**Recommendation (pending approval): Option A** — use the existing sibling fields, preserve the standard `deprecated: boolean | string`, and map the message to the standard string. The structured parts (`removal`, `replacement`, `deprecatedValues`) remain Lasagna siblings.

---

## 5. DTCG source: precedence and inheritance

This proposes closing the group-override open item in `docs/dtcg-mapping.md`; it does not claim the DTCG standard lacks inheritance semantics. Proposed rules, all **pending approval and standards verification**:

1. **Token beats group** (existing R1, unchanged).
2. **Within a node:** if both the extension object and standard `$deprecated` are present, the **extension object is the canonical record** and the standard field is a mirror. If the standard string and the object `message` differ → `deprecation-message-mismatch` warning (existing token-core behavior, codified).
3. **Nearest declaration replaces the whole inherited deprecation record — no stale-field merge.** A declaration at the nearest node (standard boolean/string, `false`, or extension object) supersedes the entire inherited record. If a group declares `{message, removal, replacement}` and a token declares only `$deprecated: "msg"`, the token's record is exactly `{message: "msg"}` — the group's `removal`/`replacement` are **not** carried over. Authors must restate fields they want to keep.
4. **`$deprecated: false` explicitly clears inherited deprecation.** The token is not deprecated and no inherited fields apply.
5. **Absent means inherit.** A node with no deprecation declaration at all (no `$deprecated`, no extension object) inherits the nearest ancestor's declaration (group standard or extension object); if none exists, it is not deprecated.

`false` vs. absent, summarized:

| Node's own state | Inherited group deprecation | Result |
|---|---|---|
| absent | present | inherit the full inherited record |
| `$deprecated: false` | present | **cleared** — not deprecated, no inherited fields |
| `$deprecated: "msg"` | present | record replaced — exactly `{message: "msg"}` |
| extension object | present | record replaced — exactly the object |
| `$deprecated: true` | present | record replaced — generated message `Deprecated.` (§5.1) |
| any of the above | absent | the node's own record (or nothing) |

### 5.1 Complete lifecycle-record selection

For this proposed profile, walk from the token toward the root. The nearest node with explicit standard/extension deprecation **or** status `deprecated`/`removed` supplies the entire lifecycle record (state, message, removal, replacement). A custom status alone does not clear inherited deprecation; preserve it separately as informational author metadata. Explicit `false` clears inherited `removed` as well as inherited deprecation. At the selected node, positive evidence beats false with `lifecycle-conflict`: this includes an extension object alongside standard `$deprecated: false`. `removed` remains an error even when an object supplies the message. Never merge metadata from an older ancestor.

Group replacements are resolved separately for each descendant; invalid/self targets have no fix. Value aliases do not transfer lifecycle. Any `$extends` expansion must follow the pinned DTCG standard before this profile is applied; do not invent lifecycle propagation from reference edges.

### 5.2 Bare `$deprecated: true`

Bare standard `true` (no extension object) is legal DTCG but carries no message. Consumers normalize it to the **generated normalized message `Deprecated.`** — an exact, deterministic fallback. Consumers retain generated provenance internally; the emitted message string alone cannot distinguish generated from identical authored text, plus a `bare-deprecation` warning urging explicit metadata. token-core's current ad-hoc string `"This token is deprecated."` aligns to `Deprecated.` under this contract.

---

## 6. Status semantics

- **Normative statuses: only `deprecated` and `removed`.**
  - `status: "deprecated"` → the entity is deprecated (diagnostic; if no structured record exists, the message is the generated `Deprecated.`).
  - `status: "removed"` → the entity is no longer available; usage is an error. It counts as deprecation for diagnostics. **No replacement action is generated from status alone** — replacement must be an explicit field.
- **Any other status is informational.** `draft`, `ready`, `experimental`, `beta`, or arbitrary custom strings: allowed (free string), no lifecycle diagnostic, no effect on `isDeprecated`, never drives code actions. (v0.3 already allows arbitrary strings on utilities/CEM; consumers currently whitelist and drop them — the contract says keep the value, ignore the lifecycle meaning.)
- **Conflict rule (proposed decision): same-node positive evidence wins, with a conflict diagnostic.**

| Same-node combination | Resolution | Diagnostic |
|---|---|---|
| `status: "deprecated" \| "removed"` + `deprecated` object | object is the canonical record (consistent positive evidence) | none |
| `status: "deprecated" \| "removed"` + `deprecated: false` | **deprecated wins** (positive evidence beats the explicit negative) | `lifecycle-conflict` (warning) |
| `status: <informational>` + `deprecated` object | object wins | none — informational status makes no claim |
| `status: <informational>` + `deprecated: false` | not deprecated | none |
| `deprecated: false` alone | not deprecated | none — `false` only has power against *inherited* deprecation (§5), never against same-node positive evidence |

This supersedes today's ad-hoc precedences (DSLS boolean-over-status, CEM status-only fallback, `removed` unrecognized outside CEM).

---

## 7. Attribute vs. value deprecation (CEM) — independent axes

- Attribute-level `deprecated` (boolean|string) deprecates the whole attribute.
- `deprecatedValues[]` deprecates specific values; **its presence does not deprecate the attribute itself** (codifies current DSLS behavior).
- The two axes are **independent** and may coexist: an attribute can be deprecated while specific values are additionally deprecated, or the attribute can be active while one value is deprecated (e.g. `size` is fine, `size="medium"` is deprecated).
- Value-level `message`/`removal`/`replacement` come from the `deprecatedValues[]` entries; attribute-level from the siblings. No cross-inheritance between the axes.
- Consumers must not use prose inference to decide which axis applies — explicit fields only (§10).

---

## 8. Replacement identifiers: scoping and resolution

- Replacement identifiers are **scoped by entity type**:
  - token → token id in the same manifest;
  - utility → utility `name` in the same manifest, not a platform-specific class name;
  - icon → icon name in the same manifest;
  - CEM custom element → exact `tagName` in the same manifest; other declarations → exact `name` in the same module;
  - CEM attribute/member/slot/cssProperty/cssPart/event → exact name of the same kind on the same owner;
  - CEM attribute value → an enum value of that attribute.
- Instruction prose belongs in `message`, never `replacement`. Self references, cycles, and removed targets do not qualify for automatic fixes.
- Resolution is semantic; JSON Schema cannot enforce cross-entity/cross-document references. Enforcement lives in emitters and contract tests (extend `test/validate.mjs`'s existing token check to utility and icon fixtures).
- **Unresolved or ambiguous → no fix.** If the identifier does not resolve to exactly one entity of the expected kind, consumers emit a warning (`unresolved-replacement` / `ambiguous-replacement`) and **no quick fix / code action is generated**. This prevents an action that "replaces with" a nonexistent or ambiguous target. Component replacement remains diagnostic-only; attribute renames may use a verified safe edit. Any unsafe edit remains diagnostic-only.

---

## 9. Removal values and time-aware severity

- `removal` is a bare string; accepted forms: ISO date `YYYY-MM-DD`, semver `X.Y.Z`, quarter `YYYY-Qn`. Use `YYYY-Qn` for new authoring; preserve historical v0.2 docs. Accept legacy `Q3-2026` as display-only during migration.
- **Only ISO dates drive time-aware severity** (day math and the README bands: overdue → error, `< 30 days` → error, `30–90` → warning, `> 90` → info; undatable removal → warning).
- **No date guessing:** consumers must not convert semver or quarter strings into dates (no release-calendar inference); they render them as authored.
- **No automatic `removed` state:** a past removal date never derives `status: "removed"`. Status is authored, never derived; overdue dates only raise severity.
- Day counts are calendar days in **UTC** (aligns DSLS and token-editor, which currently disagree at exactly 30 days — editor `< 30`, DSLS `<= 30` — pending approval).

---

## 10. No prose inference

Lifecycle decisions come only from explicit fields — extending R12 from DTCG to every format. CEM's current `detectDeprecatedValues` regex (deprecation message + enum → inferred deprecated values) is removed from the canonical path; it may remain as an opt-in legacy compatibility flag that **never** drives quick fixes. Prose in `description`, `$description`, and `message` is never parsed for lifecycle meaning: `message` is displayed and quoted, never interpreted.

---

## 11. Versioning: the v0.4 contract, not retroactive

### 11.1 Boundary

- This RFC defines the **v0.4.0 schema contract** (`schemaVersion: "0.4.0"`). It is **not retroactive**: v0.3 documents keep their published semantics; no existing document is re-validated or re-interpreted under v0.4 rules. v0.2/v0.3 documents continue to validate against their own schemas, and consumers keep the legacy (v0.2 flat) compatibility path for old manifests.
- This is a new, potentially breaking contract: nonempty messages narrow validation; precedence, inheritance and replacement rules change behavior. Old consumers must not be assumed compatible.
- CEM and DTCG sources select this profile through explicit project/resolver contract configuration (`0.4`); absence retains the legacy profile. Do not overload CEM's standard `schemaVersion` with the Design Lasagna version. Producers and consumers must agree on the selected profile before exchanging new documents.

### 11.2 Native manifest `false` support (proposed)

- v0.3 tokens/utilities/icons: `deprecated: null | object` — `false` is currently schema-invalid.
- v0.4: `deprecated: false | null | object`.
  - `false` = explicit "not deprecated" assertion (§2 state table).
  - legacy `null` / absent = **not asserted** — no lifecycle claim; consumers treat as not-deprecated unless `status` says otherwise.
- Adding `false` widens schema acceptance but can break consumers that assume object/null. Consumer upgrades and explicit profile selection are required.

### 11.3 Explicit status support (proposed) — v0.4 only

- `status: string` (free; normative values `deprecated`/`removed`, informational otherwise — §6) is added in **v0.4** to:
  - token manifests (`tokens[].status`),
  - icon manifests (`icons[].status`),
  - the DTCG extension namespace (`$extensions["recipes.designlasagna"]` — `TokenExtensions` and `GroupExtensions`).
- Utilities already have `status` in v0.3 (unchanged); CEM already has `status` via `LifecycleFields` (unchanged). **No status field is retroactively added to any v0.3 schema**, and none of the above changes v0.3 documents.

### 11.4 Documentation updates (gated)

- README "Deprecation Object" → narrow the claim to resolved manifest objects; add the per-format placement table (§3); note the CEM message→standard-string mapping; document absent/`null`/`false`/object states.
- `docs/dtcg-mapping.md` → close open item 3 with the §5 rules.
- RFC 0001 open items A4/D4 → resolved by D7/D13.

---

## Decision table

| ID | Decision point | Current state (evidence) | Proposed decision | Status |
|---|---|---|---|---|
| D1 | Canonical payload | v0.3 requires `message` but empty string passes | `message` required + `minLength: 1`; `removal`/`replacement` optional | ⏳ pending approval |
| D2 | Bare `true` message | token-core ad-hoc `"This token is deprecated."`; DSLS none | generated constant `Deprecated.`, internal provenance; `bare-deprecation` warning | ⏳ pending approval |
| D3 | Nearest declaration replaces whole inherited record; no stale-field merge | `docs/dtcg-mapping.md` open item 3 | adopt §5 rule 3 | ⏳ pending approval |
| D4 | `false` clears inherited deprecation; absent inherits | DTCG standard specifies false overriding group defaults; Lasagna conflict interaction needs definition | adopt §5 rules 4–5 | ⏳ pending approval |
| D5 | Same-node positive evidence wins + conflict diagnostic | DSLS boolean precedence; CEM status-only fallback; `removed` unrecognized | adopt §6 | ⏳ pending approval |
| D6 | CEM: keep sibling fields; standard `deprecated: bool\|string`; message → standard string | audit finding: definition-only, uneven | adopt option A (§4) | ⏳ pending approval |
| D7 | Status: only `deprecated`/`removed` normative; others informational | v0.3 free string; consumers whitelist and drop | adopt §6 | ⏳ pending approval |
| D8 | Attribute vs. value deprecation independent (CEM) | DSLS already behaves this way | codify §7 | ⏳ pending approval |
| D9 | Replacement scoped by entity type; unresolved/ambiguous → no fix | enforced for token fixtures only | adopt §8 | ⏳ pending approval |
| D10 | Removal: ISO/semver/quarter; only ISO → severity; no date guessing; no auto `removed`; UTC days | README ISO-only; quarter formats inconsistent; 30-day boundary split | adopt §9 | ⏳ pending approval |
| D11 | No prose inference | CEM regex inference present | adopt §10 | ⏳ pending approval |
| D12 | Manifest `deprecated` accepts `false`; `null`/absent not asserted | v0.3 `null \| object` | adopt §11.2 | ⏳ pending approval |
| D13 | `status` on tokens/icons + DTCG namespace, v0.4 only | absent there | adopt §11.3 | ⏳ pending approval |
| D14 | v0.4 contract; not retroactive to v0.3 | — | adopt §11.1 | ⏳ pending approval |

---

## Examples

### E1 — Canonical manifest payload (token)

```json
{
  "id": "color.bg.legacy",
  "deprecated": {
    "message": "Use color.bg.primary instead.",
    "removal": "2026-07-30",
    "replacement": "color.bg.primary"
  }
}
```

### E2 — DTCG source: absent inherits, `false` clears, no stale-field merge

Illustrative group-member excerpt (not a complete document):

```json
"space": {
  "$type": "dimension",
  "$deprecated": true,
  "$extensions": {
    "recipes.designlasagna": {
      "deprecated": {
        "message": "Legacy spacing.",
        "removal": "2026-10-01"
      }
    }
  },
  "bg": {
    "primary":  { "$value": { "value": 8, "unit": "px" } },
    "legacy":   { "$value": { "value": 4, "unit": "px" }, "$deprecated": false },
    "rebrand":  { "$value": { "value": 12, "unit": "px" }, "$deprecated": "Use the v2 spacing." }
  }
}
```

- `space.bg.primary` — absent → inherits the full group record (`message` + `removal`).
- `space.bg.legacy` — `$deprecated: false` → cleared; no inherited fields.
- `space.bg.rebrand` — record becomes exactly `{message: "Use the v2 spacing."}`; no inherited removal.

### E3 — DTCG source: bare `true` → generated message

```json
{ "gap": { "$type": "dimension", "$value": { "value": 8, "unit": "px" }, "$deprecated": true } }
```

→ manifest projection `deprecated: { "message": "Deprecated." }` + `bare-deprecation` warning. The normalizer knows this fallback was generated; the serialized string alone does not preserve that provenance.

### E4 — CEM declaration + attribute/value independence

```json
{
  "tagName": "ds-button",
  "name": "DSButton",
  "status": "deprecated",
  "deprecated": "Use ds-button-v2.",
  "removal": "2026-10-01",
  "replacement": "ds-button-v2",
  "attributes": [
    {
      "name": "variant",
      "type": { "text": "primary | secondary | tertiary" },
      "deprecatedValues": [
        {
          "value": "tertiary",
          "message": "Removed after the 2025 release.",
          "replacement": "secondary",
          "removal": "2026-06-30"
        }
      ]
    },
    {
      "name": "legacy-mode",
      "deprecated": true,
      "removal": "2026-12-01",
      "replacement": "variant"
    }
  ]
}
```

- `ds-button` — deprecated (consistent `status` + `deprecated`); replacement scoped to a declaration name.
- `variant` — the attribute itself is **not** deprecated; only `variant="tertiary"` is (value axis, §7).
- `legacy-mode` — attribute deprecated; bare `true` → generated `Deprecated.` message.

### E5 — Conflict: positive evidence wins

```json
{ "name": "text-legacy", "status": "deprecated", "deprecated": false }
```

→ deprecated (positive evidence wins) + `lifecycle-conflict` warning. `false` is not suppressed from the record — the conflict is surfaced, not silently resolved.

---

## Tests (proposed — written to encode the decisions, gated on approval)

### Schema repo (`test/validate.mjs` + fixtures)

- v0.4 fixtures: `deprecated: false` valid on token/utility/icon; `deprecated: {message: ""}` rejected (`minLength: 1`); `replacement` semantic resolution extended from tokens to utility fixtures; CEM entry checks against composable definitions plus the standard CEM schema — standard keys remain valid while lifecycle keys are type-checked.
- DTCG source precedence fixtures (assert on the projected manifest): group object + token standard string (token wins, no merge); group standard + token `$deprecated: false` (cleared); group object + token extension object (record replaced); bare `true` → `Deprecated.`.

### ds-language-server

- Parser → store → diagnostic → action matrix: absent / `null` / `false` / object; status-only `deprecated` / `removed` / custom (informational); conflict (`status` + `false`) → diagnostic + deprecated; CEM attribute `replacement` now parsed (enables the existing replacement action path); attribute-vs-value independence; unresolved/ambiguous replacement → diagnostic, **no** action; thresholds at the 30/90-day boundaries on a UTC basis; component replacement stays diagnostic-only.
- Utilities parser: structured-object branch (the currently broken path for v0.3 objects).

### token-core

- Emit group deprecation + override + `false` clearing to golden manifests; bare `true` → `Deprecated.` + `bare-deprecation` warning; `deprecation-message-mismatch` unchanged.

---

## Producer / consumer inventory

| System | Role | Lifecycle surface today (evidence) | Required change (all gated) |
|---|---|---|---|
| token-editor | Authoring producer | builds the `$extensions[NS]` patch incl. `deprecated` object + mirrors message into `$deprecated` (`token-editor/src/server/server.mjs`) | status authoring (D13); generated-message alignment (D2) |
| token-core | Compiler / emitter | `buildDeprecated`: extension wins, mismatch warning, ad-hoc bare-`true` message (`token-core/src/emit.ts`) | generated constant (D2); whole-record replacement, no merge (D3); `false` clearing (D4) |
| ds-language-server | Primary consumer | manifests v0.2/v0.3, raw DTCG, CEM, utilities (`src/parsers/*`, `src/lifecycle.ts`) | §6 centralized semantics; `removed` recognized (D5/D7); structured parsing for utilities/icons (fix); CEM attribute `replacement` (D6/D9); prose inference removed from canonical path (D11); UTC threshold alignment (D10) |
| token-editor UI | Consumer | `lifecycleBand`, local time, `< 30` (`token-editor/src/shared/manifest.js`) | UTC basis + boundary alignment (D10) |
| schemas (this repo) | Contract | v0.3 JSON schemas + fixtures | v0.4: `false` (D12), `minLength: 1` (D1), `status` (D13), composable CEM definitions (D6), quarter-format note (D10) |
| `test/validate.mjs` | Contract tests | DTCG + token manifest checks | extended per test plan |

---

## Review evidence and remaining verification

The existing source example `examples/dtcg-source/theme.light.tokens.json` mirrors a message into standard `$deprecated` and the extension object; `examples/expected/tokens.json` contains its compiled payload. Current fixtures do not cover CEM/utility/icon lifecycle, group cancellation, or bare true. The test plan must additionally cover group removed + child false, custom child status + inherited deprecation, standard false + extension object, alias non-inheritance, malformed dates, legacy quarter strings, replacement cycles/self references, and explicit profile selection.

**Standards verification (2026-09-21):** [DTCG 2025.10 format](https://www.designtokens.org/tr/2025.10/format/) §5.2.4 explicitly allows true/string/false; false may override group defaults. §6.3.1 says group deprecation extends to child tokens unless explicitly overridden, and false may override parent defaults. §6.3.2 permits vendor-specific group extensions. Thus inherited standard deprecation and explicit-false cancellation are standard behavior; same-node conflicting Lasagna metadata remains our proposed policy, not a standard rule.

The upstream [CEM schema](https://github.com/webcomponents/custom-elements-manifest/blob/master/schema.json) and [types](https://github.com/webcomponents/custom-elements-manifest/blob/master/schema.d.ts), retrieved 2026-09-21, define boolean/string `deprecated` on all entry types listed above and leave additional properties open. Both sibling metadata and a vendor object can therefore preserve standard validation. Implementation must pin the supported CEM revision and test full composed entries, rather than rely on a moving master URL. `$extends` conformance fixtures are also an implementation gate. No new conformance tests or schema implementation were added in this design task.

An independent post-draft reviewer could not run because its provider reached a usage limit. The coordinating agent corrected CEM composition, provenance, scope, inheritance and compatibility issues directly; independent review is still recommended.

## Existing test status (audited baseline)

| Suite | Result | Notes |
|---|---|---|
| schemas `npm test` | **76 pass** | both DTCG fixture projects; re-verified 2026-09-21 |
| ds-language-server `npm test` | **137 pass** | — |
| token-core `npm test` | **3 existing failures** | all pre-existing golden/parity failures caused by the local working-tree `$schema` URL change (expected manifests still carry `/v0.3/...`); not lifecycle-related |
| token-editor | no test script | — |

---

## Approval checklist

**Decisions (each requires Magnus' approval — no item is approved yet):**

- [ ] D1 — canonical payload: `message` required + non-empty (`minLength: 1`); `removal`/`replacement` optional
- [ ] D2 — bare standard `true` → generated normalized message `Deprecated.` (constant, internal provenance; serialized text alone is ambiguous)
- [ ] D3 — nearest declaration replaces the whole inherited deprecation record; no stale-field merge
- [ ] D4 — `$deprecated: false` clears inherited deprecation; absent inherits
- [ ] D5 — same-node positive evidence wins, with `lifecycle-conflict` diagnostic
- [ ] D6 — CEM: keep existing sibling fields; standard `deprecated: boolean|string`; message → standard string
- [ ] D7 — only `deprecated`/`removed` are normative statuses; all others informational
- [ ] D8 — attribute and value deprecation are independent axes (CEM)
- [ ] D9 — replacement identifiers scoped by entity type; unresolved/ambiguous → diagnostic, no fix
- [ ] D10 — `removal`: ISO/semver/quarter; only ISO drives severity; no date guessing; no auto `removed`; UTC day counts
- [ ] D11 — no prose inference in the canonical path
- [ ] D12 — v0.4 manifests accept `deprecated: false`; legacy `null`/absent stays not-asserted
- [ ] D13 — `status` added for tokens/icons and the DTCG namespace only in v0.4
- [ ] D14 — the contract is v0.4.0 and not retroactive to v0.3 semantics

**Implementation gates (nothing starts until the relevant decisions are approved):**

- [ ] Schema changes first (this repo, new v0.4 files), validated by the extended tests
- [ ] Producer changes next (token-editor, token-core), golden tests updated
- [ ] Consumer changes last (ds-language-server, token-editor UI), full test matrix green
- [ ] Docs updated: README "Deprecation Object" narrowed; `docs/dtcg-mapping.md` open item 3 closed; RFC 0001 A4/D4 resolved
- [ ] No edits to v0.3 schemas or published documents; no retroactive re-validation
- [ ] No commits until this RFC is approved
