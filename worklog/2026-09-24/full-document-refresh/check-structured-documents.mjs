// Read-only syntax and local JSON Pointer checks. No fetch, generation or application startup.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const inventoryPath = path.join(directory, 'inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const cache = new Map();
function read(file) {
  if (!cache.has(file)) {
    const text = fs.readFileSync(file, 'utf8');
    cache.set(file, file.endsWith('.json') ? JSON.parse(text) : parse(text));
  }
  return cache.get(file);
}
function pointer(value, fragment) {
  if (!fragment) return true;
  const decoded = decodeURIComponent(fragment);
  if (!decoded.startsWith('/')) return false;
  for (const token of decoded.slice(1).split('/')) {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return false;
    value = value[key];
  }
  return true;
}
const results = [];
for (const entry of inventory.documents.filter(e => e.path.startsWith('docs/') && /\.(json|ya?ml)$/.test(e.path))) {
  const file = path.join(root, entry.path);
  const result = { path: entry.path, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), localRefs: 0, externalRefs: [], errors: [] };
  try {
    const queue = [read(file)];
    const seen = new Set();
    while (queue.length) {
      const value = queue.pop();
      if (value === null || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (typeof value.$ref === 'string') {
        const ref = value.$ref;
        if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) result.externalRefs.push(ref);
        else {
          result.localRefs++;
          const delimiter = ref.indexOf('#');
          const filename = delimiter < 0 ? ref : ref.slice(0, delimiter);
          const fragment = delimiter < 0 ? '' : ref.slice(delimiter + 1);
          const target = filename ? path.resolve(path.dirname(file), decodeURIComponent(filename)) : file;
          try { if (!pointer(read(target), fragment)) result.errors.push({ ref, error: 'missing-json-pointer' }); }
          catch (error) { result.errors.push({ ref, error: error.message }); }
        }
      }
      queue.push(...Object.values(value));
    }
  } catch (error) { result.errors.push({ error: error.message }); }
  entry.structured_validation = result.errors.length ? 'failed' : 'syntax-and-local-refs-passed';
  entry.structured_validation_sha256 = result.sha256;
  results.push(result);
}
fs.writeFileSync(path.join(directory, 'structured-validation.json'), JSON.stringify({ scope: 'Syntax and direct local $ref targets only; not API conformance or runtime proof', results }, null, 2) + '\n');
fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + '\n');
const errors = results.flatMap(r => r.errors.map(e => ({ path: r.path, ...e })));
console.log(JSON.stringify({ files: results.length, localRefs: results.reduce((n, r) => n + r.localRefs, 0), externalRefsNotFetched: results.reduce((n, r) => n + r.externalRefs.length, 0), errors }));
if (errors.length) process.exitCode = 1;
