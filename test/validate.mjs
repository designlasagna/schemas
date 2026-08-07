#!/usr/bin/env node
/**
 * Phase 0 validation harness.
 *
 *  1. JSON Schema validation of the expected manifest against v0.3/tokens.json
 *  2. JSON Schema validation of every `recipes.designlasagna` block in the DTCG
 *     source against v0.3/dtcg-extensions.json
 *  3. Semantic checks a JSON Schema cannot express (counts, alias targets,
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

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
let pass = 0;
const failures = [];

const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

// ── 1. Manifest validates against tokens.json ────────────────────────────────
console.log('\n[1] Manifest → v0.3/tokens.json');
const tokensSchema = read('v0.3/tokens.json');
const manifest = read('examples/expected/tokens.json');
const validateManifest = ajv.compile(tokensSchema);
check(
  'examples/expected/tokens.json validates',
  validateManifest(manifest),
  validateManifest.errors ? ajv.errorsText(validateManifest.errors, { separator: '\n      ' }) : ''
);

// ── 2. DTCG $extensions validate against dtcg-extensions.json ────────────────
console.log('\n[2] DTCG $extensions → v0.3/dtcg-extensions.json');
const extSchema = read('v0.3/dtcg-extensions.json');
const NS = 'recipes.designlasagna';
ajv.addSchema(extSchema);
const EXT_ID = extSchema.$id;
const validateToken = ajv.compile({ $ref: `${EXT_ID}#/definitions/TokenExtensions` });
const validateGroup = ajv.compile({ $ref: `${EXT_ID}#/definitions/GroupExtensions` });

const isToken = (node) => node && typeof node === 'object' && '$value' in node;
const foreignExtensions = [];

function walkExtensions(node, path, sourceFile) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  const ext = node.$extensions?.[NS];
  if (ext) {
    const fn = isToken(node) ? validateToken : validateGroup;
    const kind = isToken(node) ? 'token' : 'group';
    check(
      `${sourceFile}:${path || '<root>'} (${kind})`,
      fn(ext),
      fn.errors ? ajv.errorsText(fn.errors) : ''
    );
  }
  for (const key of Object.keys(node.$extensions ?? {})) {
    if (key !== NS) foreignExtensions.push(`${sourceFile}:${path}:${key}`);
  }
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    walkExtensions(v, path ? `${path}.${k}` : k, sourceFile);
  }
}

const srcDir = 'examples/dtcg-source';
const srcFiles = readdirSync(join(root, srcDir)).filter((f) => f.endsWith('.tokens.json'));
for (const f of srcFiles) walkExtensions(read(join(srcDir, f)), '', f);

// ── 3. Semantic checks ───────────────────────────────────────────────────────
console.log('\n[3] Semantic checks');
const tokens = manifest.tokens;
const byId = new Map(tokens.map((t) => [t.id, t]));

check('token ids are unique', byId.size === tokens.length,
  `${tokens.length} tokens, ${byId.size} unique ids`);

check('counts.total matches tokens.length',
  manifest.counts.total === tokens.length,
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

const declaredConditions = new Set(['base', ...Object.values(manifest.conditions ?? {}).flatMap((c) => c.values)]);
const badKeys = tokens.flatMap((t) =>
  Object.keys(t.resolved).filter((k) => !declaredConditions.has(k)).map((k) => `${t.id}:${k}`));
check('all resolved keys are declared conditions', badKeys.length === 0, badKeys.join(', '));

const badAlias = tokens.flatMap((t) =>
  (Array.isArray(t.aliasChain) ? t.aliasChain : t.aliasChain ? [t.aliasChain] : [])
    .filter((a) => !byId.has(a)).map((a) => `${t.id} → ${a}`));
check('every aliasChain target resolves', badAlias.length === 0, badAlias.join(', '));

const badReplacement = tokens
  .filter((t) => t.deprecated?.replacement && !byId.has(t.deprecated.replacement))
  .map((t) => `${t.id} → ${t.deprecated.replacement}`);
check('every deprecated.replacement resolves', badReplacement.length === 0, badReplacement.join(', '));

const notDeprecated = tokens.filter((t) => t.deprecated && !t.deprecated.message);
check('deprecated entries have a message', notDeprecated.length === 0);

const badRelations = (manifest.tokenRelations ?? []).flatMap((r) =>
  r.tokens.filter((id) => !byId.has(id)));
check('tokenRelations reference existing tokens', badRelations.length === 0, badRelations.join(', '));

const badCollection = tokens.filter((t) => t.collection && !manifest.collections?.[t.collection]);
check('token.collection keys exist in collections', badCollection.length === 0,
  badCollection.map((t) => t.id).join(', '));

// contrast maps must be keyed by declared conditions
const badContrast = [];
for (const t of tokens) {
  const c = t.a11y?.wcagContrast;
  if (c && !('ratio' in c)) {
    for (const k of Object.keys(c)) if (!declaredConditions.has(k)) badContrast.push(`${t.id}:${k}`);
    for (const [k, v] of Object.entries(c)) if (v.against && !byId.has(v.against)) badContrast.push(`${t.id}:${k} against ${v.against}`);
  }
}
check('per-mode wcagContrast keys and targets are valid', badContrast.length === 0, badContrast.join(', '));

// foreign extensions must survive into manifest.metadata
check('foreign $extensions found in source', foreignExtensions.length > 0,
  'fixture should include at least one non-Lasagna extension');
const preserved = tokens.some((t) => t.metadata?.extensions && Object.keys(t.metadata.extensions).some((k) => k !== NS));
check('foreign $extensions preserved in manifest metadata (DTCG 5.2.3 MUST)', preserved);

// ── 4. Negative tests ────────────────────────────────────────────────────────
console.log('\n[4] Negative tests');
const neg = [
  ['manifest missing required `tokens`', validateManifest, { schemaVersion: '0.3.0' }],
  ['token missing required `resolved`', validateManifest,
    { schemaVersion: '0.3.0', tokens: [{ id: 'a.b' }] }],
  ['deprecated without message', validateToken, { deprecated: { removal: '2026-01-01' } }],
  ['unknown key in extensions namespace', validateToken, { notARealField: true }],
  ['priority out of range', validateToken, { priority: 500 }],
  ['group extensions may not carry token-only fields', validateGroup, { since: '1.0.0' }],
];
for (const [name, fn, doc] of neg) check(`rejects: ${name}`, !fn(doc));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
if (failures.length) {
  console.log(`FAILED — ${pass} passed, ${failures.length} failed\n`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log(`PASSED — ${pass} checks\n`);
