# Concepts

Four things shape a token, and only one of them is a hierarchy. Conflating them is the most common source of confusion, in tooling and in conversation, so this is what each one is and what it decides.

| | decides | lives in | DTCG? | optional? |
|---|---|---|---|---|
| **Group** | the token's **identity** — `path`, `id`, platform name | nesting in the source file | ✅ | no |
| **Mode** | which **values** it has | `ds.config.json` → `source.files[].mode` | ❌ | yes |
| **Collection** | a **label**: where it is stored | `$extensions` or `source.files[].collection` | ❌ | yes |
| **Tier** | a **label**: what role it plays | `$extensions` or `source.files[].tier` | ❌ | yes |

---

## Groups are the only hierarchy

A DTCG group is an object with tokens under it. Nothing declares it; it exists because something is nested inside it.

```json
{
  "color": {
    "blue": {
      "500": { "$type": "color", "$value": "..." }
    }
  }
}
```

That produces `id: color.blue.500`, `path: ["color","blue","500"]`, and `--ds-color-blue-500`. **The nesting is the name.** Renaming a group renames every token under it, which is why doing so has to repoint every reference (R11).

Groups can hold properties that cascade to everything beneath them — `$type`, `$description`, `$deprecated`, and the `recipes.designlasagna` extensions block. Nearest ancestor wins, token always wins.

---

## Modes are a value axis, and are not DTCG

**DTCG has no modes, themes or conditions concept.** This surprises people, including us: it is Gap 2 in [`dtcg-mapping.md`](./dtcg-mapping.md), and it is the entire reason `ds.config.json` exists.

A mode is declared outside the token files, by mapping files to modes:

```json
"conditions": {
  "colorScheme": { "values": ["light", "dark"], "default": "light" }
},
"source": {
  "files": [
    { "file": "theme.light.tokens.json", "mode": "light" },
    { "file": "theme.dark.tokens.json",  "mode": "dark" }
  ]
}
```

The same token id appears in both files with different values, and the resolver merges them:

```json
"resolved": { "light": "#00427a", "dark": "#52a8e1" }
```

Two consequences worth holding onto:

- **Every `.tokens.json` file stays valid DTCG**, because the invention lives in the config rather than in the token syntax. Another tool can read the files without knowing anything about modes.
- **A mode changes which value you see, not which tokens exist.** It is a view over the same set, which is why it belongs in a switcher rather than in a filter list.

Systems commonly have more than one axis — a colour scheme *and* a density, *and* a brand. Those are independent: choosing dark says nothing about which density you want. See [`condition-keys.md`](./condition-keys.md) for how combinations are keyed.

---

## Collection and tier are labels, and they are independent

Neither is a level. Both are optional. Both describe the same token from different angles:

- **Collection** answers *where is this stored*. It is a container, and in a design tool it usually maps to one file with its own mode axis.
- **Tier** answers *what role does this play*. It is a position in the layering: primitive → semantic → component.

They frequently overlap, which is what makes them look like the same thing. A system might keep its raw palette in a `Primitives` collection *and* tag those tokens `tier: primitive`. That redundancy is normal and correct — the two facts are simply true at once.

They are still independent. From a real exported system:

```
primitive × Primitives         151
primitive × Typography size     38     one tier, two collections
semantic  × Border              11
semantic  × Color              124
semantic  × Effect               4
semantic  × Size                 3     one tier, six collections
semantic  × Spacing             12
semantic  × Typography          30
component × Component           35
```

`semantic` spans six collections. Neither field contains the other.

### The trap

In that system, collection → tier happens to be a *function*: each collection carries exactly one tier. Read the table quickly and you would conclude tier sits above collection.

It does not. That is one team's convention. A team that keeps everything colour-related in a single `Color` collection ends up with primitives and semantic tokens side by side in it, and the two genuinely cross-cut.

**Tooling must not assume either direction.** Both are flat labels over one tree.

### One of them is ordered

The sharpest difference between the two is easy to miss, because both render as
lists of strings:

> **A tier is ordered. A collection is not.**

Nothing about `semantic` describes a job the token does. It describes that it may
point down and not up. The order *is* the concept — which is why
`reference-direction` can take `by: "tier"` and mean something, and why a
collection has no equivalent.

An interface should show this. Declared tiers listed in their declared order,
with a direction; collections alphabetically, without one. That teaches the
difference by observation, and it stays mechanism rather than policy: a system
that declares no order gets no claim about one.

---

## The file is derived, not fundamental

In a system exported from a design tool, a file is usually the intersection of a collection and a mode:

```
Color.light.tokens.json   →  collection: Color,  mode: light
Color.dark.tokens.json    →  collection: Color,  mode: dark
Primitives.tokens.json    →  collection: Primitives,  mode: base
```

Which is why `source.files[]` can declare `collection` and `tier` for everything in a file, instead of repeating them on every token — and why choosing a collection when creating a token can pick the file, rather than writing a per-token override that would leave the file and the manifest disagreeing.

A token can span several files. One with light and dark values exists in two, and its metadata is declared once, in the first (R3).

---

## Type is a third label

`$type` is DTCG and constrained to values DTCG defines. `$extensions["recipes.designlasagna"].type` narrows it for rendering — `spacing` rather than `dimension` — so a documentation tool can pick the right preview without guessing from names. Both are written when they differ, since `$type` has to stay something DTCG accepts.

`category`, `subCategory` and `keywords` are further labels with no structural meaning.

---

## Putting it together

```
color                            group        structure
└── blue                         group
    └── 500                      token        id = color.blue.500
        ├── light  #00427a       mode         which value
        ├── dark   #52a8e1       mode
        ├── tier        primitive    label
        ├── collection  palette      label
        └── type        color        label
```

One tree. One value axis per declared condition. Any number of independent labels.

An interface should show that shape: the groups as structure, the modes as a view control, and the labels as filters — rather than four equivalent-looking lists, which implies four peers and is where the confusion starts.

---

## What the labels *mean* is not this schema's business

`tier` looks like it carries semantics — primitives are referenced by semantic
tokens, which are referenced by component tokens, and primitives are not meant
for product code. That is a real and useful convention, and it is **one team's
convention**.

The schema deliberately does not encode it. `tier` is a free string (RFC A6)
and `status` was made one too (A4) for the same reason: a system that layers
differently, or names its layers differently, should not have to fight the
format. "Not prescribing naming conventions" is in the RFC's non-goals.

Tooling still needs to act on these ideas, so the split is:

- **the schema** carries the labels
- **the project** declares what they mean, in `ds.config.json`
- **the tooling** provides mechanism — selectors and configurable rules — and
  no defaults

In practice that means a lint config in the ESLint shape, where a team says
which tokens are off limits and *what makes them so* — a tier, a collection, a
group, a tag:

```json
"lint": {
  "rules": {
    "no-reference": ["error", {
      "from": { "tier": ["component"] },
      "to":   { "tier": ["primitive"] },
      "message": "Components must go through a semantic token."
    }],
    "reference-direction": ["error", {
      "by": "tier",
      "order": ["primitive", "semantic", "component"],
      "skipped": "warning"
    }]
  }
}
```

With nothing configured, nothing is checked. A system with no stated layering
has no layering to violate.

The same intent can be expressed against whichever field the team actually
organises by — `{ "to": { "collection": ["Primitives"] } }` and
`{ "to": { "group": ["color.raw"] } }` say the same thing about differently
structured systems.

---

## A word means one thing per ecosystem

Not per file, and not per package. If a term is load-bearing anywhere in Design
Lasagna, nothing else may take it — even where the second meaning is locally
obvious from context. Having to disambiguate by context *is* the cost, and it is
paid on every read, by everyone, forever.

The rule has been applied twice, with opposite outcomes, which is the useful
part:

- **`group` failed it and was renamed.** DTCG group nesting and a
  documentation label shared the word inside a single file. It is `label` as of
  v0.3 — see the last section.
- **`layer` would fail it, so `tier` stays.** Layers already mean the parts of a
  design system — tokens, components, utilities, docs, sandbox, language server —
  which is the sense the project is named for. Taking the word for a token
  ordering would repeat the `group` mistake knowingly. `tier` is less evocative
  and it is free.

A rule that only ever returns "rename it" is a preference. This one refuses a
rename as readily as it demands one.

---

## Settled: `group` the label is now `label`

`$extensions["recipes.designlasagna"].group` was a **human-facing display label**
— `"Color"`, `"Layout"` — with nothing to do with DTCG group nesting. Two
different things shared the word inside one file:

```json
"color": {                                  ← a DTCG group
  "$extensions": {
    "recipes.designlasagna": {
      "group": "Color"                      ← a label that is not that
    }
  }
}
```

It is `label` as of v0.3. DTCG nesting is carried by `path` and `id`, and
nothing else claims the word.

The schema had documented the distinction in a description, which was the
version of this fix that does not work: a note is read once and a name is read
every time. Renaming cost one field before release and nothing after, which is
why the timing mattered more than the size.

One survivor, deliberately: the lint selector `{ "to": { "group": ["color.raw"] } }`
still says `group`, because there it really does mean DTCG nesting — it selects
every token under a path. Same word, and this time the same concept.
