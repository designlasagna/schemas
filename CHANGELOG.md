# Changelog

## 0.4.1 — 2026-10-06

Nothing yet.

## 0.4.0 — 2026-09-24

Adds the v0.4 contracts under `v0.4/`, built on a shared lifecycle fragment. v0.3 documents stay valid against the v0.3 contracts. See `docs/lifecycle-migration.md` before upgrading.

### Breaking

- Native lifecycle payloads accept an explicit `deprecated: false`, and canonical deprecation messages must be non-empty. Consumers must not apply these semantics to v0.2 or v0.3 documents.
- DTCG lifecycle uses the standard `$deprecated` boolean/string mirror plus the `recipes.designlasagna` extension, with whole-record inheritance and explicit `false` cancellation. CEM keeps standard boolean/string `deprecated` with sibling metadata.
- The `$id` of every contract moves to `https://designlasagna.recipes/schemas/<version>/<file>`. This also applies to the existing v0.2 and v0.3 files, which previously used `https://designlasagna.recipes/<version>/<file>`.
- The v0.3 token and DTCG platform mappings are closed and no longer accept `usage` (see Removed). This change is shipped in the `v0.3/` directory, so it first appears in this release.

### Added

- v0.4 lifecycle contract and exports: `lifecycle.json`, `tokens.json`, `utilities.json`, `icons.json`, `cem-extensions.json` and `dtcg-extensions.json`.
- `docs/lifecycle.md` and `docs/lifecycle-migration.md`, published in the package.
- Lifecycle format examples, schema fixtures and downstream consumer vectors under `examples/lifecycle/`.

### Removed

- The redundant `usage` property from platform mappings in `v0.3/tokens.json` and `v0.3/dtcg-extensions.json`. Each mapping now contains only its required `reference`, and mappings reject other properties. This was committed after 0.3.4, so published 0.3.x releases still accept `usage`; 0.4.0 is the first release with it removed.

### All contracts

- **Breaking:** `$id` is now `https://designlasagna.recipes/schemas/v0.4/<file>`; documents point `$schema` at the new URL.
- **Breaking:** deprecation `message` must be a non-empty string.
- `status` is canonical and references the shared `Status`; any string is accepted, only `deprecated` and `removed` carry meaning.
- Deprecation records alias the shared lifecycle definitions.
- Native only: `deprecated` accepts an explicit `false`.

### tokens.json

- New optional `Token.status`.
- **Breaking:** platform mappings are closed and `usage` is removed.

### utilities.json

- `UtilityClass.status` now references the shared `Status`.

### icons.json

- New optional `Icon.status`.

### cem-extensions.json

- **Breaking:** `DeprecatedValue.message` must be non-empty.
- New `LifecycleFields.deprecated` (boolean or string).
- Removal targets are documented as ISO date, semver or quarter, and replacement as scoped to the same entity kind and owner (described in the schema, not enforced by a pattern).
- New `DeclarationExtensions`, `MemberExtensions`, `CssPartExtensions` and `EventExtensions`, each referencing `LifecycleFields`.
- `SlotExtensions` and `CssPropertyExtensions` now reference `LifecycleFields`, gaining `status`.
- `AttributeExtensions` gains `deprecated` and `status`.

### dtcg-extensions.json

- **Breaking:** platform mappings are closed and `usage` is removed.
- New optional `status` on `TokenExtensions` and `GroupExtensions`.
- Group deprecation: the nearest declaration replaces the whole inherited record; `$deprecated: false` clears it.
- `Deprecated` aliases the shared `StrictDeprecated`.

### lifecycle.json

- New definitions-only fragment shared by the other contracts.

## 0.3.4 — 2026-08-30

### Changed

- CI workflows run on Node 24. No schema changes.

## 0.3.3 — 2026-08-28

### Added

- DTCG format schema (`dtcg/2025.10/format.json`) and its license, included in the package.

### Changed

- Publishing uses npm trusted publishing.
- Removed a legacy reference from the RFC text.

## 0.3.2 — 2026-08-27

### Changed

- CI publishes with the organization npm token. No schema changes.

## 0.3.1 — 2026-08-27

### Fixed

- Publish the scoped package with public access. No schema changes.

## 0.3.0 — 2026-08-27

First tagged release. Introduces the v0.3 contracts and the release validation and publishing workflow.

### Added

- v0.3 contracts: `tokens.json`, `utilities.json`, `icons.json`, `cem-extensions.json` and `dtcg-extensions.json`.
- DTCG authoring extensions (`v0.3/dtcg-extensions.json`), a DTCG mapping spec, and example fixtures, published under `examples/`.
- Release validation and publishing workflow.
