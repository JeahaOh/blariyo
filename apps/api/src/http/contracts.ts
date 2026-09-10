import type { CollectorCredential } from './collector.guard.js';
import {
  createParamDecorator,
  Injectable,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import {
  matchOperation,
  normalizeInput,
  validateRequest,
  type Operation,
} from '@blariyo/contracts';
import type { Request } from 'express';
import { fail, ApiError } from '../shared/errors.js';

export interface CoreRequest extends Request<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, unknown>
> {
  requestId?: string;
  contractPath?: string;
  collector?: CollectorCredential;
  actor?: string;
  maintenance?: boolean;
  hasBody?: boolean;
  operation?: Operation;
}
export interface RequestInput {
  method: string;
  operation: Operation;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}
export function stringField(input: Record<string, unknown>, key: string, fallback = ''): string {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail(400, 'VALIDATION_FAILED');
  return value;
}
function record(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    fail(400, 'VALIDATION_FAILED');
  return Object.fromEntries(Object.entries(input));
}
@Injectable()
export class ContractPipe implements PipeTransform<unknown, RequestInput> {
  transform(input: unknown): RequestInput {
    const fields = record(input);
    if (typeof fields.method !== 'string' || typeof fields.path !== 'string')
      fail(400, 'VALIDATION_FAILED');
    const operation = matchOperation(fields.method, fields.path);
    if (!operation) fail(404, 'POST_NOT_FOUND');
    const query = record(fields.query);
    const headers = record(fields.headers);
    const body = normalizeInput(fields.body);
    if (!validateRequest(operation, { query, headers, body: fields.hasBody ? body : undefined }))
      fail(400, 'VALIDATION_FAILED');
    if (fields.maintenance && fields.method !== 'GET')
      throw new ApiError(503, 'MAINTENANCE_READ_ONLY', undefined, 60);
    return { method: fields.method, operation, params: operation.params, query, headers, body };
  }
}
export const Input = createParamDecorator((_data: unknown, context: ExecutionContext): unknown => {
  const request = context.switchToHttp().getRequest<CoreRequest>();
  const path = request.contractPath ?? request.originalUrl.split('?')[0] ?? request.originalUrl;
  const operation = matchOperation(request.method, path);
  if (operation) request.operation = operation;
  return {
    method: request.method,
    path,
    query: request.query,
    headers: request.headers,
    body: request.body,
    hasBody: request.hasBody,
    maintenance: request.maintenance,
  };
});
