import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
const source = new URL('../packages/contracts/openapi/m0-core.yaml', import.meta.url);
const docs = await readFile(
  new URL('../docs/development-specs/m0-core/openapi/m0-core.yaml', import.meta.url)
);
if (!docs.equals(await readFile(source))) throw new Error('OpenAPI copies differ');
await writeFile(
  new URL('../packages/contracts/src/api.d.ts', import.meta.url),
  astToString(await openapiTS(source))
);

const { parse } = await import('yaml');
await writeFile(
  new URL('../packages/contracts/src/schema.mjs', import.meta.url),
  '// Generated from openapi/m0-core.yaml. Do not edit.\nexport default ' +
    JSON.stringify(parse(docs.toString())) +
    ';\n'
);
