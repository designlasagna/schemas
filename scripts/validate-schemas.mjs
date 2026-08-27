import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv from 'ajv';

const root = new URL('..', import.meta.url).pathname;
const schemaDir = join(root, 'v0.3');
const files = (await readdir(schemaDir)).filter((file) => file.endsWith('.json')).sort();
const ajv = new Ajv({ strict: true, allErrors: true });

let valid = true;
for (const file of files) {
  const path = join(schemaDir, file);
  let schema;
  try {
    schema = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    valid = false;
    console.error(`${file}: invalid JSON:`, error instanceof Error ? error.message : error);
    continue;
  }

  if (!ajv.validateSchema(schema)) {
    valid = false;
    console.error(`${file}: invalid JSON Schema:`);
    console.error(ajv.errorsText(ajv.errors, { separator: '\n  ' }));
  } else {
    console.log(`✓ ${file}`);
  }
}

if (!valid) process.exitCode = 1;
