# Working on @designlasagna/schemas

- Read [docs/openness.md](docs/openness.md) before changing any schema. Native manifest objects stay open; unknown fields and likely mistakes are tool warnings (language server, token-core), not schema errors. Do not add `additionalProperties: false` or other narrowing to fix a review finding — propose a tool warning instead.
- Removing a field or closing an object needs a decision record in `docs/decisions/` (numbered, with why and migration) before it ships. Link it from the CHANGELOG entry.
- A 0.4.x patch may only fix or relax validation. Breaking changes need a new version directory and an explicit decision from Magnus.
- `v0.2/`, `v0.3/` and `dtcg/` are byte-frozen.
- Run `npm run validate` and `npm test` before handing off. Never push, tag or publish without approval.
