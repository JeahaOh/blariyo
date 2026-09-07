import specification from './schema.mjs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
export const contract = specification;
const ajv = addFormats(new Ajv({ strict: false, allErrors: true }));
ajv.addSchema({ $id: 'contract', components: contract.components });
const validators = new Map();
export const deref = (value) =>
  value?.$ref
    ? value.$ref
        .slice(2)
        .split('/')
        .reduce((v, k) => v[k], contract)
    : value;
// Compile schemas with the same local reference root as the OpenAPI document.
export function schemaValidator(schema) {
  const key = JSON.stringify(schema);
  if (!validators.has(key))
    validators.set(key, ajv.compile({ ...schema, components: contract.components }));
  return validators.get(key);
}
export function matchOperation(method, path) {
  for (const [pattern, item] of Object.entries(contract.paths)) {
    const names = [];
    const regex = new RegExp(
      '^' +
        pattern.replace(/\{(\w+)\}/g, (_, n) => {
          names.push(n);
          return '([^/]+)';
        }) +
        '$'
    );
    const match = path.match(regex);
    if (match && item[method.toLowerCase()])
      return {
        ...item[method.toLowerCase()],
        pattern,
        params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(match[i + 1])])),
      };
  }
}
export function validateRequest(operation, { query = {}, headers = {}, body }) {
  const parameters = (operation.parameters || []).map(deref);
  if (Object.keys(query).some((k) => !parameters.some((p) => p.in === 'query' && p.name === k)))
    return false;
  for (const p of parameters) {
    if (p.in === 'path') continue; // Path errors have resource-specific 404 semantics.
    let value =
      (p.in === 'query' ? query : headers)[p.name.toLowerCase()] ??
      (p.in === 'query' ? query : headers)[p.name];
    if (value === undefined) {
      if (p.required) return false;
      continue;
    }
    if (p.schema.type === 'integer' && typeof value === 'string' && /^[0-9]+$/.test(value))
      value = Number(value);
    if (!schemaValidator(p.schema)(value)) return false;
  }
  const request = deref(operation.requestBody);
  if (!request) return body === undefined;
  if (request.content['multipart/form-data']) return true;
  if (body === undefined) return !request.required;
  return schemaValidator(request.content['application/json'].schema)(body);
}
export function validateResponse(operation, status, body) {
  const response = deref(operation.responses[String(status)]);
  if (!response) return false;
  const schema = response.content?.['application/json']?.schema;
  return schema ? schemaValidator(schema)(body) : body === undefined;
}

export function normalizeInput(value) {
  if (Array.isArray(value)) return value.map(normalizeInput);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        typeof v === 'string' && ['title', 'text', 'alt', 'name', 'titlePrefix'].includes(k)
          ? v.trim()
          : normalizeInput(v),
      ])
    );
  return value;
}
export function projectResponse(operation, status, value) {
  const schema = deref(operation.responses[String(status)])?.content?.['application/json']?.schema;
  function project(input, s) {
    s = deref(s);
    if (input === null || input === undefined || !s) return input;
    const alternative = (s.oneOf || s.anyOf)?.find((candidate) =>
      schemaValidator(candidate)(input)
    );
    if (alternative) return project(input, alternative);
    if (s.allOf)
      return Object.assign(
        {},
        ...s.allOf.map((part) => project(input, part)),
        project(input, { ...s, allOf: undefined })
      );
    if (Array.isArray(input)) return input.map((v) => project(v, s.items));
    if (typeof input === 'object')
      return Object.fromEntries(
        Object.entries(s.properties || {})
          .filter(([k]) => Object.hasOwn(input, k))
          .map(([k, child]) => [k, project(input[k], child)])
      );
    return input;
  }
  return project(value, schema);
}
