# Where this stops

Design Lasagna resolves tokens, describes them and governs them. It does not
build them. This is the line, and the reasoning, because "we could just generate
the outputs too" is a question that comes back.

## Style Dictionary does six things

| | |
|---|---|
| parse token files | `token-core` |
| resolve aliases, modes, `$ref`, `$extends` | `token-core` |
| transform **names** | `token-core`, when a project asks it to |
| serialize values | `token-core` |
| transform values **per platform** | Style Dictionary |
| emit files — formats, templates, actions | Style Dictionary |

Four of the six already live here, which is exactly why the question is
tempting. The two that remain are Style Dictionary's core.

## The line

**The manifest must be sufficient. The tooling must not become a build system.**

Sufficient means: anything downstream can produce any output from the manifest
alone, without reading the source files or re-implementing resolution. Names,
resolved values, authored values, modes, metadata — all present, nothing that
requires going back to the DTCG.

That makes outputs *possible* for everyone without making them *our problem*.

A CSS file is roughly twenty lines from `platforms.web.reference` and
`resolved`. A small team should not need a build pipeline to get one, so
reference emitters for CSS and JSON/TypeScript ship as **examples to copy** —
not as a plugin system, not as a supported surface.

A Swift colour extension is the other end: nested `@objc` classes,
`@available(*, deprecated, message:)` annotations, and an action that writes
`.colorset` asset catalog directories. That is not templating. That is a build
tool, and there is a good one.

## Why not go further

**Configurable output is not a feature, it is a product.** The moment outputs
are configurable, the commitment is:

- a transform registry, per platform and per type
- a format and template registry
- an action system for side effects
- value semantics for twelve DTCG types across N platforms

That is Style Dictionary. Rebuilding it means competing with a mature tool on
its strongest ground, and it re-imports policy at precisely the point this
project has been most careful to avoid it — every value transform is somebody's
opinion about what a Swift colour looks like. "Mechanism here, policy in the
project" does not survive a built-in opinion about `rgba()`.

There is also a strategic version. What is novel here is the governance layer:
the manifest, the language server, the docs, the lint rules, the editor, and the
metadata no build tool can generate. If `token-core` generated outputs, the
answer to *why use this instead of Style Dictionary* becomes "it is a worse
Style Dictionary with an editor". If it does not, the answer is "Style
Dictionary keeps working, and you get everything it was never trying to do."

## What sufficiency currently fails

`serializeValue()` already makes platform choices, and they are web choices:

```
color      → colorToHex(value)                    → "#00427a"
dimension  → `${value.value}${value.unit}`        → "16px"
fontFamily → ["Inter","Helvetica","sans-serif"]   → "Inter, Helvetica, sans-serif"
```

The last is a CSS font stack. Swift wants the array. And `colorToHex` raises an
error for any colour space it cannot hex, so a P3 colour without an explicit
`hex` fails — a colour iOS represents natively.

The manifest is not *lossy*: `needsModes()` keeps the authored DTCG value
whenever it differs from the serialization, which for every object-valued token
it does. But `resolved` is web-flavoured, and a non-web consumer has to know to
ignore it and re-serialize from `modes`.

RFC 0001 lists "web-first bias — top-level `cssVariable` and `properties`
shortcuts" among the v0.2 problems v0.3 set out to fix. The same bias survived
one level down, in the value serialization rather than the field names.

## Naming has two directions and neither is ours to pick

A project decides where names are computed:

- **build-authoritative** — an exporter is the source, Style Dictionary computes
  names, the manifest imports them
- **manifest-authoritative** — the repo is the source, `token-core` derives
  names from the authored path, the build reads them

Both are supported. The editor needs the second, because it has to show a
reference at author time, before any build — but that is a requirement of the
editor, not of the format, and a project that never opens the editor is not
using this wrongly.

The invariant is not which end wins. It is **exactly one implementation of a
name**. Two things computing a name independently will drift, and the drift is
silent: a CSS custom property that resolves to nothing is not an error.
