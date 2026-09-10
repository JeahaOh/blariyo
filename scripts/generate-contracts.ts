import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import { parse } from 'yaml';
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('OpenAPI document must contain objects');
  return Object.fromEntries(Object.entries(value));
}
interface Specification extends Record<string, unknown> {
  paths: Record<string, unknown>;
  components: Record<string, Record<string, unknown>>;
}
function specification(input: unknown): Specification {
  const value = record(input);
  return {
    ...value,
    paths: record(value.paths),
    components: Object.fromEntries(Object.entries(record(value.components)).map(([kind, entries]) => [kind, record(entries)])),
  };
}
let combined: Specification | undefined;
for (const name of ['m0-core', 'm0-collection-assist']) {
  const source = new URL(`../packages/contracts/openapi/${name}.yaml`, import.meta.url);
  const docs = await readFile(
    new URL(`../docs/development-specs/${name}/openapi/${name}.yaml`, import.meta.url)
  );
  if (!docs.equals(await readFile(source))) throw new Error(`${name}: OpenAPI copies differ`);
  await writeFile(
    new URL(
      `../packages/contracts/src/${name === 'm0-core' ? 'api' : 'collection-api'}.d.ts`,
      import.meta.url
    ),
    astToString(await openapiTS(source))
  );
  const document = specification(parse(docs.toString()));
  if (!combined) combined = document;
  else {
    for (const path of Object.keys(document.paths))
      if (combined.paths[path]) throw new Error('Duplicate API path');
    Object.assign(combined.paths, document.paths);
    for (const [kind, entries] of Object.entries(document.components))
      combined.components[kind] = { ...combined.components[kind], ...entries };
  }
}
if (!combined) throw new Error('No OpenAPI documents generated');
await writeFile(
  new URL('../packages/contracts/src/schema.mjs', import.meta.url),
  '// Generated from openapi/*.yaml. Do not edit.\nexport default ' +
    JSON.stringify(combined) +
    ';\n'
);
