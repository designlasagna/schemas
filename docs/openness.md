# Open schemas

Decided 2026-10-14, revised 2026-10-15. This is the rule for every schema
change, including review findings that look like obvious tightening.

## The rule

**Schemas are open and flexible. They don't force anyone into a particular way
of working or structure.**

No structure fits every design system. Teams attach their own data to tokens,
icons and utilities, and producers add fields before every consumer knows
about them. A closed schema forces all of them to wait for us, or to fork.

- Native objects (`tokens.json`, `utilities.json`, `icons.json`,
  `cem-extensions.json`) accept unknown properties. The schema checks the shape
  of the fields it defines and leaves the rest alone.
- **Authors validate when they choose to.** An author validates their files
  against a schema version to check that they match it. The schema says what a
  version contains; it doesn't judge how a design system is built.
- **Tools know what they know.** A tool uses the fields it supports, ignores
  the rest, and never changes or drops data it doesn't understand. Unknown
  fields are not reported as problems. At most a tool notes them in its log,
  so a developer who wonders why something doesn't work can see what the tool
  didn't understand.
- **Design Lasagna tools support Design Lasagna schemas**, starting with the
  latest version.

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
   explains why this object is the exception.

"It would catch typos" is not a reason to close an object.

## Changing a schema

- Add fields as optional. Removing a field or closing an object is breaking:
  it needs a new version directory and an explicit, recorded decision — a
  review finding alone is not enough.
- A patch may only fix or relax validation (see the hosted URL policy in the
  website's `docs/architecture.md`). Reopening an object that was closed
  without one of the reasons above is a relaxation and fits in a patch.
- Every removed field, closed or reopened object needs a decision record in
  [`docs/decisions/`](decisions/): what changed, why, what replaces it and how
  to migrate. A changelog line is not enough.

## Earlier exceptions

`v0.4/utilities.json` `UtilityVariants` was closed without a reason and was
reopened in 0.4.5. Token `PlatformMapping` was kept closed by decision
[0002](decisions/0002-keep-platform-mapping-closed.md) and reopened in 0.4.6 by
decision [0003](decisions/0003-open-platform-mapping.md).

`v0.3/` stays byte-frozen.
