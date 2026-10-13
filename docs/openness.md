# Open schemas, warning tools

Decided 2026-10-14. This is the rule for every schema change, including review
findings that look like obvious tightening.

## The rule

**Native manifest schemas stay open. Unknown fields are a tooling warning, not
a schema error.**

No structure fits every design system. Teams attach their own data to tokens,
icons and utilities, and producers add fields before every consumer knows
about them. A closed schema forces all of them to wait for us, or to fork.

- Native objects (`tokens.json`, `utilities.json`, `icons.json`,
  `cem-extensions.json`) accept unknown properties. The schema checks the shape
  of the fields it defines and leaves the rest alone.
- Typos and unknown fields are caught by tools as **warnings**: the language
  server shows a diagnostic ("`deprected` is not a known field — did you mean
  `deprecated`?"), and token-core reports one at build time. Neither fails the
  build by default.
- The same applies to values that are valid but probably a mistake, such as
  `wcagContrast: {}` or an empty platform entry: warn in tools, accept in the
  schema.

## Where a closed object is allowed

Only in these cases. Outside the DTCG namespace, the object's `description`
must say why it is closed:

1. **Design Lasagna's own authoring namespace** — `$extensions.designlasagna`
   in `dtcg-extensions.json` and the records under it, such as
   `StrictDeprecated`. We own every key there, so an unknown key is always a
   mistake.
2. **Structural necessity** — the schema cannot work otherwise. `ContrastInfo`
   is closed so the single-value form stays distinguishable from the
   per-condition map in `A11y.wcagContrast`'s `oneOf`.
3. **An accepted decision record** in [`docs/decisions/`](decisions/) that
   explains why this object is the exception. Token `PlatformMapping` is one
   ([0002](decisions/0002-keep-platform-mapping-closed.md)).

"It would catch typos" is not a reason to close an object. That is the tools'
job.

## Changing a schema

- Add fields as optional. Removing a field or closing an object is breaking:
  it needs a new version directory and an explicit, recorded decision — a
  review finding alone is not enough.
- A patch may only fix or relax validation (see the hosted URL policy in the
  website's `docs/architecture.md`). Reopening an object that was closed
  without one of the reasons above is a relaxation and fits in a patch.
- Before proposing a stricter constraint, ask whether a tool warning does the
  job. It usually does.
- Every removed field or closed object needs a decision record in
  [`docs/decisions/`](decisions/) before it ships: what changed, why, what
  replaces it and how to migrate. A changelog line is not enough.

## Earlier exceptions

`v0.4/utilities.json` `UtilityVariants` was closed without a reason and is
reopened in the next 0.4.x patch: variant kinds are where design systems differ
most, and the root `variantPatterns` was already open.

`v0.3/` stays byte-frozen. Token `PlatformMapping` stays closed by decision
[0002](decisions/0002-keep-platform-mapping-closed.md).
