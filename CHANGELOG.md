# Changelog

## Unreleased

### Breaking — planned 0.4.0 release

- Add the explicitly selected v0.4 lifecycle contract and exports. Native lifecycle
  payloads now accept explicit `false`, canonical messages must be nonempty, and
  tokens/icons gain `status`; consumers must not apply these semantics to v0.2/v0.3.
- DTCG lifecycle uses the standard `$deprecated` boolean/string mirror plus the
  `recipes.designlasagna` extension, with whole-record inheritance and explicit
  false cancellation. CEM continues to use standard boolean/string `deprecated`
  with sibling metadata. See `docs/lifecycle-migration.md` before upgrading.

### Added

- Lifecycle format examples, schema fixtures, and downstream consumer vectors under
  `examples/lifecycle/`.

### Removed

- Removed the redundant `usage` property from v0.3 token platform mappings. Each mapping now contains only its required `reference`.
