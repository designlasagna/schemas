import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const schemaExports = Object.entries(packageJson.exports)
  .filter(([key, target]) => /^\.\/v\d+(?:\.\d+)*\/.+\.json$/.test(key) && typeof target === 'string')
  .map(([key, target]) => ({ relativePath: key.slice(2), path: join(root, target) }))
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
const ajv = new Ajv({ strict: true, allErrors: true });
const baseUrl = 'https://designlasagna.recipes';

let valid = true;
for (const { relativePath, path } of schemaExports) {
  let schema;
  try {
    schema = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    valid = false;
    console.error(`${relativePath}: invalid JSON:`, error instanceof Error ? error.message : error);
    continue;
  }

  const expectedId = `${baseUrl}/schemas/${relativePath}`;
  if (schema.$id !== expectedId) {
    valid = false;
    console.error(`${relativePath}: invalid $id:\n  actual:   ${JSON.stringify(schema.$id)}\n  expected: ${expectedId}`);
  }

  if (!ajv.validateSchema(schema)) {
    valid = false;
    console.error(`${relativePath}: invalid JSON Schema:`);
    console.error(ajv.errorsText(ajv.errors, { separator: '\n  ' }));
  } else {
    console.log(`✓ ${relativePath}`);
  }
}

if (schemaExports.length === 0) {
  valid = false;
  console.error('No exported Design Lasagna v0.x schemas found in package.json.');
}

if (!valid) process.exitCode = 1;
