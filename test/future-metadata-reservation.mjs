#!/usr/bin/env node
// Schema-only tests for an unversioned FUTURE candidate. No released contract is changed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const lifecycleSchema = read('v0.4/lifecycle.json');
const extensionSchema = read('v0.4/dtcg-extensions.json');
const manifestSchema = read('v0.4/tokens.json');
const dtcgSchema = read('dtcg/2025.10/format.json');
const draftNarrowing = read('test/fixtures/FUTURE-dtcg-metadata-reservation.schema.json');
ajv.addSchema(lifecycleSchema);
ajv.addSchema(extensionSchema);
ajv.addSchema(draftNarrowing);

const tokenExtensionsId = `${extensionSchema.$id}#/definitions/TokenExtensions`;
const releasedTokenExtensions = ajv.getSchema(tokenExtensionsId);
const futureTokenExtensions = ajv.compile({
  allOf: [
    { $ref: tokenExtensionsId },
    { $ref: draftNarrowing.$id },
  ],
});
const validateDtcg = ajv.compile(dtcgSchema);
const validateManifest = ajv.compile(manifestSchema);
let checks = 0;
const check = (name, condition, errors) => {
  assert.ok(condition, `${name}${errors ? `: ${ajv.errorsText(errors)}` : ''}`);
  checks++;
};

check('released v0.4 TokenExtensions fragment is available', typeof releasedTokenExtensions === 'function');
for (const [label, value] of [
  ['null', null],
  ['empty object', {}],
  ['populated value', { 'com.figma': { variableId: 'VariableID:1' } }],
]) {
  const authorBlock = { metadata: { extensions: value } };
  check(`released v0.4 still accepts metadata.extensions (${label})`, releasedTokenExtensions(authorBlock), releasedTokenExtensions.errors);
  check(`future candidate rejects metadata.extensions (${label})`, !futureTokenExtensions(authorBlock));
}

for (const metadata of [
  { owner: 'design-systems' },
  { custom: { nested: true }, note: null },
]) {
  check('future candidate permits other custom metadata', futureTokenExtensions({ metadata }), futureTokenExtensions.errors);
}

const sourceWithSiblingNamespace = {
  color: {
    $type: 'color',
    $value: { colorSpace: 'srgb', components: [0, 0, 0] },
    $extensions: {
      'recipes.designlasagna': { metadata: { owner: 'design-systems' } },
      'com.figma': { variableId: 'VariableID:1' },
    },
  },
};
check('standard DTCG permits a sibling foreign namespace', validateDtcg(sourceWithSiblingNamespace), validateDtcg.errors);
check(
  'future candidate permits the Lasagna block beside a foreign namespace',
  futureTokenExtensions(sourceWithSiblingNamespace.color.$extensions['recipes.designlasagna']),
  futureTokenExtensions.errors,
);

const generatedManifest = {
  schemaVersion: '0.4.0',
  tokens: [{
    id: 'color.black',
    resolved: { base: '#000000' },
    metadata: {
      owner: 'design-systems',
      extensions: { 'com.figma': { variableId: 'VariableID:1' } },
    },
  }],
};
check('generated v0.4 manifest envelope with metadata.extensions remains valid', validateManifest(generatedManifest), validateManifest.errors);

const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
  cwd: root,
  encoding: 'utf8',
}))[0];
const packed = new Set(pack.files.map(file => file.path));
check(
  'unversioned draft fixture is excluded from the npm package',
  !packed.has('test/fixtures/FUTURE-dtcg-metadata-reservation.schema.json'),
);

console.log(`Future metadata reservation draft: ${checks} schema/package checks passed (NOT production-enabled).`);
