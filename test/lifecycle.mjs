#!/usr/bin/env node
// Schema conformance, not a downstream lifecycle implementation.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const base = 'https://designlasagna.recipes/schemas/';
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const pkg = read('package.json');
let checks = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  checks++;
};
const validate = (name, fn, value, expected = true) => {
  const actual = fn(value);
  check(`${name}: expected ${expected}; ${ajv.errorsText(fn.errors)}`, actual === expected);
};
const entries = Object.entries(pkg.exports).filter(([k]) => /^\.\/v\d+\.\d+\/.+\.json$/.test(k));
for (const [key, path] of entries) {
  const schema = read(path);
  check(`${key} canonical ID`, schema.$id === base + key.slice(2));
  check(`${key} metaschema`, ajv.validateSchema(schema));
  ajv.addSchema(schema);
}
// Compile every exported root AND definition, including otherwise unused fragments.
for (const [key, path] of entries) {
  const schema = read(path);
  check(`${key} offline root`, typeof ajv.getSchema(schema.$id) === 'function');
  for (const name of Object.keys(schema.definitions ?? {})) {
    check(`${key}#${name} offline`, typeof ajv.getSchema(`${schema.$id}#/definitions/${name}`) === 'function');
  }
}
for (const file of readdirSync(join(root, 'v0.4')).filter(f => f.endsWith('.json'))) {
  check(`${file} exported`, pkg.exports[`./v0.4/${file}`] === `./v0.4/${file}`);
}
const fragment = shorthand => {
  const [file, definition] = shorthand.split('#');
  return ajv.getSchema(`${base}v0.4/${file}.json#/definitions/${definition}`);
};
for (const fixture of read('examples/lifecycle/schema-cases.json')) {
  validate(fixture.name, fragment(fixture.fragment), fixture.data, fixture.valid);
}

const example = read('examples/lifecycle/v0.4.json');
for (const format of ['tokens', 'utilities', 'icons']) {
  const fn = ajv.getSchema(`${base}v0.4/${format}.json`);
  validate(`${format} authoring example`, fn, example[format]);
  const one = structuredClone(example[format]);
  one[format] = [one[format][0]];
  for (const [label, value, expected] of [
    ['false', false, true], ['null', null, true], ['object', { message: 'Old' }, true],
    ['empty-message', { message: '' }, false], ['missing-message', {}, false],
    ['true', true, false], ['string', 'Old', false],
  ]) {
    one[format][0].deprecated = value;
    validate(`${format}: ${label}`, fn, one, expected);
  }
  delete one[format][0].deprecated;
  validate(`${format}: absent`, fn, one);
  one[format][0].status = 42;
  validate(`${format}: numeric status invalid`, fn, one, false);
  one[format][0].status = 'custom-team-status';
  validate(`${format}: custom status`, fn, one);
  // A conflict is schema-valid: semantic diagnostics belong to consumers.
  one[format][0].deprecated = false;
  one[format][0].status = 'removed';
  validate(`${format}: conflict is structurally valid`, fn, one);
}
const nested = { schemaVersion: '0.4.0', categories: [{ name: 'spacing', utilities: example.utilities.utilities }] };
validate('nested utilities lifecycle', ajv.getSchema(`${base}v0.4/utilities.json`), nested);

// Historical contracts: no new false/nonempty rule is imposed on old versions.
for (const version of ['v0.2', 'v0.3']) {
  for (const format of version === 'v0.2' ? ['tokens', 'utilities'] : ['tokens', 'utilities', 'icons']) {
    const id = `${base}${version}/${format}.json`;
    const entity = { tokens: 'Token', utilities: 'UtilityClass', icons: 'Icon' }[format];
    const schema = read(`${version}/${format}.json`);
    const deprecated = schema.definitions[entity].properties.deprecated;
    const fn = ajv.compile({ $id: `${base}test/${version}/${format}`, definitions: schema.definitions, ...deprecated });
    validate(`${id} legacy null`, fn, null);
    validate(`${id} legacy empty message`, fn, { message: '' });
    validate(`${id} does not acquire false`, fn, false, false);
  }
}

// Standard DTCG source + closed Lasagna namespace are separate validations.
const dtcg = ajv.compile(read('dtcg/2025.10/format.json'));
validate('standard DTCG example', dtcg, example.dtcg);
function namespaceResults(node, out = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  const block = node.$extensions?.['recipes.designlasagna'];
  if (block !== undefined) {
    const kind = '$value' in node || '$ref' in node ? 'Token' : 'Group';
    out.push(fragment(`dtcg-extensions#${kind}Extensions`)(block));
  }
  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith('$') || key === '$root') namespaceResults(value, out);
  }
  return out;
}
check('DTCG example namespaces', namespaceResults(example.dtcg).every(Boolean));
for (const form of ['root', 'ref']) {
  const token = form === 'root' ? { $value: { value: 1, unit: 'px' } } : { $ref: '#/base/$value' };
  token.$extensions = { 'recipes.designlasagna': { since: '1.0.0', deprecated: { message: 'Old' } } };
  const document = form === 'root' ? { space: { $type: 'dimension', $root: token } }
    : { base: { $type: 'dimension', $value: { value: 1, unit: 'px' } }, alias: token };
  validate(`DTCG ${form} standard source`, dtcg, document);
  check(`DTCG ${form} token-only metadata`, JSON.stringify(namespaceResults(document)) === '[true]');
  token.$extensions['recipes.designlasagna'].deprecated = false;
  check(`DTCG ${form} invalid payload detected`, JSON.stringify(namespaceResults(document)) === '[false]');
}
for (const value of [false, true, 'Old']) {
  validate(`standard DTCG ${value}`, dtcg, { gap: { $type: 'dimension', $value: { value: 1, unit: 'px' }, $deprecated: value } });
}
validate('standard DTCG rejects object', dtcg, { gap: { $type: 'dimension', $value: { value: 1, unit: 'px' }, $deprecated: { message: 'Old' } } }, false);

// Pin actual CEM standard, validate full document and each composed entry.
const cemId = 'urn:designlasagna:test:cem-standard';
ajv.addSchema(read('test/vendor/cem/schema.json'), cemId);
validate('full standard CEM example', ajv.getSchema(cemId), example.cem);
const declaration = example.cem.modules[0].declarations[0];
const composed = (standard, extension) => ajv.compile({ allOf: [
  { $ref: `${cemId}#/definitions/${standard}` },
  { $ref: `${base}v0.4/cem-extensions.json#/definitions/${extension}` },
] });
for (const [standard, extension, entry] of [
  ['CustomElementDeclaration', 'DeclarationExtensions', declaration],
  ['Attribute', 'AttributeExtensions', declaration.attributes[0]],
  ['ClassField', 'MemberExtensions', declaration.members[0]],
  ['ClassMethod', 'MemberExtensions', { kind: 'method', name: 'oldMethod', deprecated: true }],
  ['Slot', 'SlotExtensions', declaration.slots[0]],
  ['CssCustomProperty', 'CssPropertyExtensions', declaration.cssProperties[0]],
  ['CssPart', 'CssPartExtensions', declaration.cssParts[0]],
  ['Event', 'EventExtensions', declaration.events[0]],
]) {
  const fn = composed(standard, extension);
  validate(`composed CEM ${standard}`, fn, entry);
  validate(`composed CEM ${standard} custom status`, fn, { ...entry, status: 'team-preview' });
  validate(`composed CEM ${standard} preserves standard type`, fn, { ...entry, deprecated: { message: 'Old' } }, false);
  validate(`composed CEM ${standard} invalid status`, fn, { ...entry, status: 1 }, false);
  const missingName = { ...entry };
  delete missingName.name;
  validate(`composed CEM ${standard} still requires standard name`, fn, missingName, false);
}

// Fixture replacement resolution is an assertion about examples, not a consumer normalizer.
function validReplacements(entities, key) {
  return entities.every(entity => {
    const target = entity.deprecated?.replacement;
    if (target === undefined) return true;
    const matches = entities.filter(candidate => candidate[key] === target);
    return matches.length === 1 && matches[0] !== entity && matches[0].status !== 'removed';
  });
}
for (const format of ['tokens', 'utilities', 'icons']) {
  const key = format === 'tokens' ? 'id' : 'name';
  const items = example[format][format];
  check(`${format} example replacements resolve`, validReplacements(items, key));
  const broken = structuredClone(items);
  broken[0].deprecated.replacement = 'missing-or-wrong-kind';
  check(`${format} unresolved fixture rejected`, !validReplacements(broken, key));
  const ambiguous = structuredClone(items);
  ambiguous.push(structuredClone(ambiguous[1]));
  check(`${format} ambiguous fixture rejected`, !validReplacements(ambiguous, key));
}

// Deliberately only validate envelope, not claimed consumer conformance.
const vectors = read('examples/lifecycle/consumer-cases.json');
check('consumer vectors select profile', vectors.contract === '0.4');
check('consumer vector IDs unique', new Set(vectors.cases.map(c => c.id)).size === vectors.cases.length);
const vectorEnvelope = ajv.compile({
  type: 'object', required: ['id', 'format', 'input', 'expected'], additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 }, format: { enum: ['native', 'dtcg', 'cem'] },
    input: { type: 'object' }, ancestors: { type: 'array', items: { type: 'object' } },
    context: { type: 'object' },
    expected: {
      type: 'object', minProperties: 1, additionalProperties: false,
      properties: {
        state: { enum: ['active', 'deprecated', 'removed'] },
        attributeState: { enum: ['active', 'deprecated', 'removed'] },
        valueState: { enum: ['active', 'deprecated', 'removed'] },
        assertion: { enum: ['absent', 'explicit-false'] },
        status: { type: 'string' }, message: { type: 'string' },
        messageSource: { enum: ['authored', 'generated'] },
        removal: { type: ['string', 'null'] }, replacement: { type: ['string', 'null'] },
        severity: { enum: ['info', 'warning', 'error'] },
        diagnostics: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
        action: { type: 'null' }, profile: { enum: ['0.4', 'legacy'] }, usesV04Rules: { type: 'boolean' },
      },
    },
  },
});
for (const c of vectors.cases) validate(`vector envelope ${c.id}`, vectorEnvelope, c);
validate('malformed ancestor vector rejected', vectorEnvelope, { ...vectors.cases[0], ancestors: [false] }, false);
validate('malformed expected diagnostics rejected', vectorEnvelope, { ...vectors.cases[0], expected: { diagnostics: 'warning' } }, false);

// npm decides the actual file allowlist; no publication, scripts, or network.
const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: root, encoding: 'utf8' }))[0];
const packed = new Set(pack.files.map(f => f.path));
for (const [key, target] of entries) check(`${key} packaged`, packed.has(target.replace(/^\.\//, '')));
for (const f of ['docs/lifecycle.md', 'examples/lifecycle/v0.4.json', 'examples/lifecycle/schema-cases.json', 'examples/lifecycle/consumer-cases.json']) {
  check(`${f} packaged`, packed.has(f));
}
console.log(`Lifecycle: ${checks} checks passed (consumer semantics NOT executed).`);
