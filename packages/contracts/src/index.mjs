import specification from './schema.mjs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
/** @typedef {import('./index.d.mts').Operation} Operation */
/** @param {unknown} value @returns {Record<string, unknown>} */
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_CONTRACT_OBJECT');
  return Object.fromEntries(Object.entries(value));
}
/** @param {unknown} value @returns {unknown[]} */
function array(value) {
  if (!Array.isArray(value)) throw new Error('INVALID_CONTRACT_ARRAY');
  return value;
}
/** @param {unknown} value @returns {string} */
function string(value) {
  if (typeof value !== 'string') throw new Error('INVALID_CONTRACT_STRING');
  return value;
}
const document = object(specification);
export const contract = {
  ...document,
  paths: object(document.paths),
  components: document.components,
};
const ajv = addFormats.default(new Ajv2020({ strict: false, allErrors: true }));
ajv.addSchema({ $id: 'contract', components: contract.components });
/** @type {Map<string | undefined, import('ajv').ValidateFunction<unknown>>} */
const validators = new Map();
/** @param {unknown} value @returns {unknown} */
export function deref(value) {
  if (!value || typeof value !== 'object' || !('$ref' in value) || !value.$ref) return value;
  return string(value.$ref)
    .slice(2)
    .split('/')
    .reduce((/** @type {unknown} */ current, key) => object(current)[key], contract);
}
/** @param {unknown} schema @returns {import('ajv').ValidateFunction<unknown>} */
export function schemaValidator(schema) {
  const key = JSON.stringify(schema);
  const cached = validators.get(key);
  if (cached) return cached;
  const validator = ajv.compile({ ...object(schema), components: contract.components });
  validators.set(key, validator);
  return validator;
}
/** @param {string} method @param {string} path @returns {Operation | undefined} */
export function matchOperation(method, path) {
  for (const [pattern, rawItem] of Object.entries(contract.paths)) {
    const item = object(rawItem);
    /** @type {string[]} */
    const names = [];
    const regex = new RegExp(
      '^' +
        pattern.replace(/\{(\w+)\}/g, (_, name) => {
          names.push(string(name));
          return '([^/]+)';
        }) +
        '$'
    );
    const match = path.match(regex);
    if (match && item[method.toLowerCase()]) {
      const operation = object(item[method.toLowerCase()]);
      return {
        ...operation,
        operationId: string(operation.operationId),
        responses: object(operation.responses),
        ...(operation.parameters ? { parameters: array(operation.parameters) } : {}),
        pattern,
        params: Object.fromEntries(
          names.map((name, index) => [name, decodeURIComponent(string(match[index + 1]))])
        ),
      };
    }
  }
}
/**
 * @param {Operation} operation
 * @param {{query?: Record<string,unknown>, headers?: Record<string,unknown>, body: unknown}} request
 */
export function validateRequest(operation, { query = {}, headers = {}, body }) {
  const parameters = (operation.parameters || []).map((value) => object(deref(value)));
  if (
    Object.keys(query).some(
      (key) => !parameters.some((parameter) => parameter.in === 'query' && parameter.name === key)
    )
  )
    return false;
  for (const parameter of parameters) {
    if (parameter.in === 'path') continue;
    const name = string(parameter.name),
      input = parameter.in === 'query' ? query : headers;
    let value = input[name.toLowerCase()] ?? input[name];
    if (value === undefined) {
      if (parameter.required) return false;
      continue;
    }
    const schema = object(parameter.schema);
    if (schema.type === 'integer' && typeof value === 'string' && /^[0-9]+$/.test(value))
      value = Number(value);
    if (!schemaValidator(schema)(value)) return false;
  }
  const requestValue = deref(operation.requestBody);
  if (!requestValue) return body === undefined;
  const request = object(requestValue),
    content = object(request.content);
  if (content['multipart/form-data']) return true;
  if (body === undefined) return !request.required;
  return schemaValidator(object(content['application/json']).schema)(body);
}
/** @param {Operation} operation @param {number} status @param {unknown} body */
export function validateResponse(operation, status, body) {
  const responseValue = deref(operation.responses[String(status)]);
  if (!responseValue) return false;
  const response = object(responseValue),
    content = response.content ? object(response.content) : {};
  const media = content['application/json'] ? object(content['application/json']) : {};
  return media.schema ? schemaValidator(media.schema)(body) : body === undefined;
}
/** @param {unknown} value @returns {unknown} */
export function normalizeInput(value) {
  if (Array.isArray(value)) return array(value).map(normalizeInput);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(object(value)).map(([key, item]) => [
        key,
        typeof item === 'string' && ['url', 'remoteUrl'].includes(key) && /^https?:\/\//.test(item)
          ? normalizeUrl(item)
          : typeof item === 'string' && ['title', 'text', 'alt', 'name', 'titlePrefix'].includes(key)
          ? item.trim()
          : normalizeInput(item),
      ])
    );
  return value;
}
/** Normalize Unicode paths without weakening subsequent URI/HTTPS validation.
 * @param {string} value
 */
function normalizeUrl(value) {
  try { return new URL(value).href; } catch { return value; }
}
/** @param {Operation} operation @param {number} status @param {unknown} value @returns {unknown} */
export function projectResponse(operation, status, value) {
  const responseValue = deref(operation.responses[String(status)]);
  const response = responseValue ? object(responseValue) : {};
  const content = response.content ? object(response.content) : {};
  const media = content['application/json'] ? object(content['application/json']) : {};
  /** @param {unknown} input @param {unknown} schemaValue @returns {unknown} */
  function project(input, schemaValue) {
    const resolved = deref(schemaValue);
    if (input === null || input === undefined || !resolved) return input;
    const schema = object(resolved);
    const variants = schema.oneOf || schema.anyOf;
    const alternative = variants
      ? array(variants).find((candidate) => schemaValidator(candidate)(input))
      : undefined;
    if (alternative) return project(input, alternative);
    if (schema.allOf)
      return Object.assign(
        {},
        ...array(schema.allOf).map((part) => project(input, part)),
        project(input, { ...schema, allOf: undefined })
      );
    if (Array.isArray(input)) return array(input).map((item) => project(item, schema.items));
    if (typeof input === 'object') {
      const record = object(input);
      return Object.fromEntries(
        Object.entries(schema.properties ? object(schema.properties) : {})
          .filter(([key]) => Object.hasOwn(input, key))
          .map(([key, child]) => [key, project(record[key], child)])
      );
    }
    return input;
  }
  return project(value, media.schema);
}
