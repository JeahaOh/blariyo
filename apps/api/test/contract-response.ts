import assert from 'node:assert/strict';
import { matchOperation, validateResponse, type Operation } from '@blariyo/contracts';
import type { operations as CoreOperations } from '@blariyo/contracts/api';
import type { operations as CollectionOperations } from '@blariyo/contracts/collection-api';

type Operations = CoreOperations & CollectionOperations;
type JsonContent<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;
export type ContractJson<K extends keyof Operations> = JsonContent<
  Operations[K]['responses'][keyof Operations[K]['responses']]
>;
export type ContractData<K extends keyof Operations> =
  Extract<ContractJson<K>, { success: true }> extends { data: infer Data } ? Data : never;

function matches<K extends keyof Operations>(
  value: unknown,
  name: K,
  operation: Operation,
  status: number
): value is ContractJson<K> {
  // The predicate is backed by the canonical runtime OpenAPI validator, not a type assertion.
  return operation.operationId === name && validateResponse(operation, status, value);
}
function matchesData<K extends keyof Operations>(
  value: unknown,
  name: K,
  operation: Operation,
  status: number
): value is { data: ContractData<K> } {
  return (
    matches(value, name, operation, status) &&
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === true &&
    'data' in value
  );
}
export function contractData<K extends keyof Operations>(
  name: K,
  inputPath: string,
  status: number,
  value: unknown,
  method = 'GET'
): ContractData<K> {
  const path = inputPath.replace(/^\/internal\/collect(?=\/|$)/, '/api/collector/v1');
  const operation = matchOperation(method, path);
  assert.ok(operation, method + ' ' + path);
  assert.ok(matchesData(value, name, operation, status), 'Expected successful data for ' + name);
  return value.data;
}
export async function contractJson<K extends keyof Operations>(
  name: K,
  response: Response,
  method = 'GET'
): Promise<ContractJson<K>> {
  return contractBody(
    name,
    new URL(response.url).pathname,
    response.status,
    await response.json(),
    method
  );
}
export function contractBody<K extends keyof Operations>(
  name: K,
  inputPath: string,
  status: number,
  value: unknown,
  method = 'GET'
): ContractJson<K> {
  const path = inputPath.replace(/^\/internal\/collect(?=\/|$)/, '/api/collector/v1');
  const operation = matchOperation(method, path);
  assert.ok(operation, method + ' ' + path);
  assert.ok(
    matches(value, name, operation, status),
    'Response must match ' + name + ' at status ' + String(status)
  );
  return value;
}

function hasSuccess<T, S extends boolean>(
  value: T,
  success: S
): value is Extract<T, { success: S }> {
  return (
    typeof value === 'object' && value !== null && 'success' in value && value.success === success
  );
}
export async function contractSuccess<K extends keyof Operations>(
  name: K,
  response: Response,
  method = 'GET'
): Promise<Extract<ContractJson<K>, { success: true }>> {
  const body = await contractJson(name, response, method);
  assert.ok(hasSuccess(body, true), 'Expected successful ' + name);
  return body;
}
export function contractSuccessBody<K extends keyof Operations>(
  name: K,
  path: string,
  status: number,
  value: unknown,
  method = 'GET'
): Extract<ContractJson<K>, { success: true }> {
  const body = contractBody(name, path, status, value, method);
  assert.ok(hasSuccess(body, true), 'Expected successful ' + name);
  return body;
}
export async function contractError<K extends keyof Operations>(
  name: K,
  response: Response,
  method = 'GET'
): Promise<Extract<ContractJson<K>, { success: false }>> {
  const body = await contractJson(name, response, method);
  assert.ok(hasSuccess(body, false), 'Expected rejected ' + name);
  return body;
}
