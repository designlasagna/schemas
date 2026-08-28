#!/usr/bin/env node
/**
 * Schema + fixture validation harness.
 *
 *  1. JSON Schema validation of each expected manifest against v0.3/tokens.json
 *  2. JSON Schema validation of every `recipes.designlasagna` block in the DTCG
 *     source against v0.3/dtcg-extensions.json
 *  3. Semantic checks a JSON Schema cannot express (counts, references,
 *     deprecation replacements, condition keys, extension preservation)
 *  4. Negative tests — intentionally invalid docs that MUST be rejected
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const PROJECTS = [
  {
    name: 'dtcg-source',
    description: 'curly-brace aliases, two modes, composite, deprecation',
    source: 'examples/dtcg-source',
    expected: 'examples/expected/tokens.json',
    expectForeignExtensions: true,
  },
  {
    name: 'dtcg-pointers',
    description: 'JSON Pointer references (DTCG 7.1.2, 7.3)',
    source: 'examples/dtcg-pointers',
    expected: 'examples/expected/pointers.tokens.json',
    expectForeignExtensions: false,
  },
];

const NS = 'recipes.designlasagna';
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const tokensSchema = read('v0.3/tokens.json');
const extSchema = read('v0.3/dtcg-extensions.json');
const dtcgFormatSchema = read('dtcg/2025.10/format.json');
ajv.addSchema(extSchema);

const validateManifest = ajv.compile(tokensSchema);
const validateDtcg = ajv.compile(dtcgFormatSchema);
const validateToken = ajv.compile({ $ref: `${extSchema.$id}#/definitions/TokenExtensions` });
const validateGroup = ajv.compile({ $ref: `${extSchema.$id}#/definitions/GroupExtensions` });

let pass = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isToken = (node) => isObj(node) && ('$value' in node || typeof node.$ref === 'string');

const ALIAS_RE = /\{([^}]+)\}/g;
function collectAliases(value, out = []) {
  if (typeof value === 'string') for (const m of value.matchAll(ALIAS_RE)) out.push(m[1]);
  else if (Array.isArray(value)) for (const v of value) collectAliases(v, out);
  else if (isObj(value)) for (const v of Object.values(value)) collectAliases(v, out);
  return out;
}

function collectPointers(value, out = []) {
  if (Array.isArray(value)) for (const v of value) collectPointers(v, out);
  else if (isObj(value)) {
    if (typeof value.$ref === 'string') out.push(value.$ref);
    for (const v of Object.values(value)) collectPointers(v, out);
  }
  return out;
}

/* ── per-project ─────────────────────────────────────────────────────────── */

function validateProject(project) {
  console.log(`\n${'═'.repeat(60)}\n${project.name} — ${project.description}\n${'═'.repeat(60)}`);

  const manifest = read(project.expected);
  const srcFiles = readdirSync(join(root, project.source)).filter((f) => f.endsWith('.tokens.json'));

  console.log('\n[0] DTCG source → DTCG 2025.10 Format Module');
  check('source contains at least one .tokens.json', srcFiles.length > 0);
  for (const file of srcFiles) {
    const source = read(join(project.source, file));
    check(
      `${file} validates`,
      validateDtcg(source),
      validateDtcg.errors ? ajv.errorsText(validateDtcg.errors) : '',
    );
  }

  console.log('\n[1] Manifest → v0.3/tokens.json');
  check(
    `${project.expected} validates`,
    validateManifest(manifest),
    validateManifest.errors ? ajv.errorsText(validateManifest.errors, { separator: '\n      ' }) : '',
  );

  console.log('\n[2] DTCG $extensions → v0.3/dtcg-extensions.json');
  const foreignExtensions = [];
  function walk(node, path, file) {
    if (!isObj(node)) return;
    const ext = node.$extensions?.[NS];
    if (ext) {
      const fn = isToken(node) ? validateToken : validateGroup;
      check(`${file}:${path || '<root>'} (${isToken(node) ? 'token' : 'group'})`,
        fn(ext), fn.errors ? ajv.errorsText(fn.errors) : '');
    }
    for (const key of Object.keys(node.$extensions ?? {})) {
      if (key !== NS) foreignExtensions.push(`${file}:${path}:${key}`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      walk(v, path ? `${path}.${k}` : k, file);
    }
  }
  for (const f of srcFiles) walk(read(join(project.source, f)), '', f);

  console.log('\n[3] Semantic checks');
  const tokens = manifest.tokens;
  const byId = new Map(tokens.map((t) => [t.id, t]));

  check('token ids are unique', byId.size === tokens.length,
    `${tokens.length} tokens, ${byId.size} unique ids`);

  check('counts.total matches tokens.length', manifest.counts.total === tokens.length,
    `counts.total=${manifest.counts.total}, actual=${tokens.length}`);

  for (const dim of ['tier', 'collection', 'type']) {
    const actual = {};
    for (const t of tokens) if (t[dim] != null) actual[t[dim]] = (actual[t[dim]] ?? 0) + 1;
    const declared = manifest.counts.by[dim] ?? {};
    const keys = new Set([...Object.keys(actual), ...Object.keys(declared)]);
    const bad = [...keys].filter((k) => (actual[k] ?? 0) !== (declared[k] ?? 0));
    check(`counts.by.${dim} matches`, bad.length === 0,
      bad.map((k) => `${k}: declared ${declared[k] ?? 0} vs actual ${actual[k] ?? 0}`).join(', '));
  }

  const sortedCountKeys = Object.entries(manifest.counts.by)
    .filter(([, v]) => JSON.stringify(Object.keys(v)) !== JSON.stringify([...Object.keys(v)].sort()))
    .map(([k]) => k);
  check('counts.by.* keys are sorted (diff stability)', sortedCountKeys.length === 0,
    sortedCountKeys.join(', '));

  const declaredConditions = new Set(['base', ...Object.values(manifest.conditions ?? {}).flatMap((c) => c.values)]);
  const badKeys = tokens.flatMap((t) =>
    Object.keys(t.resolved).filter((k) => !declaredConditions.has(k)).map((k) => `${t.id}:${k}`));
  check('all resolved keys are declared conditions', badKeys.length === 0, badKeys.join(', '));

  // `modes` is the sole reference source (aliasChain removed in v0.3).
  const badAlias = tokens.flatMap((t) =>
    collectAliases(t.modes ?? {}).filter((ref) => !byId.has(ref)).map((ref) => `${t.id} → {${ref}}`));
  check('every curly-brace alias in `modes` resolves', badAlias.length === 0, badAlias.join(', '));

  const badPointer = tokens.flatMap((t) =>
    collectPointers(t.modes ?? {}).filter((p) => !p.startsWith('#/')).map((p) => `${t.id} → ${p}`));
  check('every $ref in `modes` is a rooted JSON Pointer', badPointer.length === 0, badPointer.join(', '));

  check('no token carries `aliasChain` (removed in v0.3)',
    tokens.every((t) => !('aliasChain' in t)),
    tokens.filter((t) => 'aliasChain' in t).map((t) => t.id).join(', '));

  const leaked = tokens.filter((t) =>
    collectAliases(t.resolved).length > 0 || collectPointers(t.resolved).length > 0);
  check('no unresolved references leak into `resolved`', leaked.length === 0,
    leaked.map((t) => t.id).join(', '));

  const badReplacement = tokens
    .filter((t) => t.deprecated?.replacement && !byId.has(t.deprecated.replacement))
    .map((t) => `${t.id} → ${t.deprecated.replacement}`);
  check('every deprecated.replacement resolves', badReplacement.length === 0, badReplacement.join(', '));

  check('deprecated entries have a message',
    tokens.filter((t) => t.deprecated && !t.deprecated.message).length === 0);

  const badRelations = (manifest.tokenRelations ?? []).flatMap((r) => r.tokens.filter((id) => !byId.has(id)));
  check('tokenRelations reference existing tokens', badRelations.length === 0, badRelations.join(', '));

  const badCollection = tokens.filter((t) => t.collection && !manifest.collections?.[t.collection]);
  check('token.collection keys exist in collections', badCollection.length === 0,
    badCollection.map((t) => t.id).join(', '));

  const badCssName = tokens
    .filter((t) => t.platforms?.web && !/^--[A-Za-z0-9_-]+$/.test(t.platforms.web.reference))
    .map((t) => `${t.id} → ${t.platforms.web.reference}`);
  check('web references are valid CSS custom property names', badCssName.length === 0, badCssName.join(', '));

  const badContrast = [];
  for (const t of tokens) {
    const c = t.a11y?.wcagContrast;
    if (c && !('ratio' in c)) {
      for (const [k, v] of Object.entries(c)) {
        if (!declaredConditions.has(k)) badContrast.push(`${t.id}:${k}`);
        if (v.against && !byId.has(v.against)) badContrast.push(`${t.id}:${k} against ${v.against}`);
      }
    }
  }
  check('per-mode wcagContrast keys and targets are valid', badContrast.length === 0, badContrast.join(', '));

  if (project.expectForeignExtensions) {
    check('foreign $extensions found in source', foreignExtensions.length > 0);
    check('foreign $extensions preserved in manifest metadata (DTCG 5.2.3 MUST)',
      tokens.some((t) => t.metadata?.extensions &&
        Object.keys(t.metadata.extensions).some((k) => k !== NS)));
  }

  check('Lasagna namespace never leaks into metadata.extensions',
    tokens.every((t) => !Object.keys(t.metadata?.extensions ?? {}).includes(NS)));
}

for (const project of PROJECTS) validateProject(project);

/* ── negative tests ──────────────────────────────────────────────────────── */

console.log(`\n${'═'.repeat(60)}\nnegative tests\n${'═'.repeat(60)}\n`);
const neg = [
  ['manifest missing required `tokens`', validateManifest, { schemaVersion: '0.3.0' }],
  ['token missing required `resolved`', validateManifest, { schemaVersion: '0.3.0', tokens: [{ id: 'a.b' }] }],
  ['deprecated without message', validateToken, { deprecated: { removal: '2026-01-01' } }],
  ['unknown key in extensions namespace', validateToken, { notARealField: true }],
  ['priority out of range', validateToken, { priority: 500 }],
  ['group extensions may not carry token-only fields', validateGroup, { since: '1.0.0' }],
  ['invalid DTCG token name', validateDtcg, { 'bad.name': { $value: 'nope' } }],
];
for (const [name, fn, doc] of neg) check(`rejects: ${name}`, !fn(doc));

/* ── summary ─────────────────────────────────────────────────────────────── */

console.log(`\n${'─'.repeat(60)}`);
if (failures.length) {
  console.log(`FAILED — ${pass} passed, ${failures.length} failed\n`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log(`PASSED — ${pass} checks across ${PROJECTS.length} fixture projects\n`);
