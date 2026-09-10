import {
  createParamDecorator,
  Injectable,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { normalizeInput, validateRequest } from '@blariyo/contracts';
import type { operations } from '@blariyo/contracts/collection-api';
import { ContractPipe, stringField, type CoreRequest, type RequestInput } from './contracts.js';
import type { CollectorCredential } from './collector.guard.js';
import type {
  CollectorCommand,
  CollectorBodies,
} from '../features/collection/collector-command.model.js';
import type { ImageFile } from '../features/images/image-validation.js';
import { fail } from '../shared/errors.js';
export interface CollectorInputValue {
  input: RequestInput;
  collector: CollectorCredential;
  key: string;
  file?: ImageFile;
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}
@Injectable()
export class CollectorInputPipe implements PipeTransform<
  CoreRequest,
  Promise<CollectorInputValue>
> {
  async transform(request: CoreRequest) {
    const collector = request.collector,
      operation = request.operation;
    if (!collector || !operation) fail(401, 'COLLECTOR_AUTH_REQUIRED');
    const spring = collector.contractVersion === 'SPRING_V2';
    let body: unknown = normalizeInput(request.body);
    let file: ImageFile | undefined;
    const multipart = operation.operationId === 'collectorUploadPreview';
    if (multipart) {
      if (Number(request.get('content-length') ?? 0) > 11 * 1024 * 1024)
        fail(413, 'UPLOAD_TOO_LARGE');
      const chunks: Buffer[] = [];
      let length = 0;
      for await (const chunk of request) {
        const bytes: unknown = chunk;
        if (!Buffer.isBuffer(bytes)) fail(400, 'VALIDATION_FAILED');
        length += bytes.length;
        if (length > 11 * 1024 * 1024) fail(413, 'UPLOAD_TOO_LARGE');
        chunks.push(bytes);
      }
      let form: FormData;
      try {
        form = await new Response(Buffer.concat(chunks), {
          headers: { 'content-type': request.get('content-type') ?? '' },
        }).formData();
      } catch {
        fail(400, 'VALIDATION_FAILED');
      }
      if (
        [...form.entries()].length !== (spring ? 4 : 3) ||
        (spring && form.getAll('collectorExecutionId').length !== 1) ||
        !['collectorId', 'lockVersion', 'file'].every((key) => form.getAll(key).length === 1)
      )
        fail(400, 'VALIDATION_FAILED');
      const version = form.get('lockVersion'),
        value = form.get('file');
      if (
        typeof version !== 'string' ||
        !/^\d+$/.test(version) ||
        !Number.isSafeInteger(Number(version)) ||
        Number(version) < 1 ||
        !(value instanceof File)
      )
        fail(400, 'VALIDATION_FAILED');
      body = {
        collectorId: form.get('collectorId'),
        lockVersion: Number(version),
        ...(spring ? { collectorExecutionId: form.get('collectorExecutionId') } : {}),
      };
      file = { bytes: Buffer.from(await value.arrayBuffer()), mime: value.type };
    }
    const input = new ContractPipe().transform({
      method: request.method,
      path: request.contractPath,
      query: request.query,
      headers: request.headers,
      body,
      hasBody: request.hasBody || multipart,
      maintenance: request.maintenance,
    });
    const values = record(body);
    if (request.method !== 'GET' && values.collectorId !== collector.collectorId)
      fail(403, 'COLLECTOR_FORBIDDEN');
    const key = request.get('idempotency-key') ?? '';
    if (spring) {
      if (request.method !== 'GET' && !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
        fail(400, 'VALIDATION_FAILED');
      if (
        [
          'collectorClaim',
          'collectorHeartbeat',
          'collectorResult',
          'collectorUploadPreview',
        ].includes(operation.operationId) &&
        (typeof values.collectorExecutionId !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
            values.collectorExecutionId
          ))
      )
        fail(400, 'VALIDATION_FAILED');
      if (
        file &&
        request.get('x-content-sha256') !== createHash('sha256').update(file.bytes).digest('hex')
      )
        fail(400, 'VALIDATION_FAILED');
    } else if (
      request.method === 'GET' ||
      values.collectorExecutionId ||
      values.jobRequestId ||
      ['collectorReservation', 'collectorOperationalEvent'].includes(operation.operationId)
    )
      fail(403, 'COLLECTOR_FORBIDDEN');
    return { input, collector, key, ...(file ? { file } : {}) };
  }
}
export const CollectorInput = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<CoreRequest>()
);
export function collectorCommand(value: CollectorInputValue): CollectorCommand {
  const { input, file } = value,
    body = input.body;
  const names = {
    create: 'collectorCreateCandidate',
    claim: 'collectorClaim',
    heartbeat: 'collectorHeartbeat',
    result: 'collectorResult',
  } as const;
  function isBody<K extends keyof typeof names>(
    body: unknown,
    action: K
  ): body is CollectorBodies[K] {
    return (
      input.operation.operationId === names[action] &&
      validateRequest(input.operation, { query: input.query, headers: input.headers, body })
    );
  }
  if (isBody(body, 'create'))
    return { action: 'create', operation: 'collectorCreateCandidate', params: input.params, body };
  if (isBody(body, 'claim'))
    return { action: 'claim', operation: 'collectorClaim', params: input.params, body };
  const params = { candidateId: stringField(input.params, 'candidateId') };
  if (isBody(body, 'heartbeat'))
    return { action: 'heartbeat', operation: 'collectorHeartbeat', params, body };
  if (isBody(body, 'result'))
    return { action: 'result', operation: 'collectorResult', params, body };
  const data = record(body);
  if (
    input.operation.operationId === 'collectorUploadPreview' &&
    file &&
    typeof data.collectorId === 'string' &&
    typeof data.lockVersion === 'number'
  ) {
    return {
      action: 'preview',
      operation: 'collectorUploadPreview',
      params: { ...params, candidateImageId: stringField(input.params, 'candidateImageId') },
      body: {
        collectorId: data.collectorId,
        lockVersion: data.lockVersion,
        ...(typeof data.collectorExecutionId === 'string'
          ? { collectorExecutionId: data.collectorExecutionId }
          : {}),
      },
      file,
    };
  }
  fail(400, 'VALIDATION_FAILED');
}
export function collectorBody<K extends 'collectorReservation' | 'collectorOperationalEvent'>(
  input: RequestInput,
  operationId: K
): operations[K]['requestBody']['content']['application/json'] {
  const value = input.body;
  function valid(
    body: unknown
  ): body is operations[K]['requestBody']['content']['application/json'] {
    return (
      input.operation.operationId === operationId &&
      validateRequest(input.operation, { body, query: input.query, headers: input.headers })
    );
  }
  if (!valid(value)) fail(400, 'VALIDATION_FAILED');
  return value;
}
