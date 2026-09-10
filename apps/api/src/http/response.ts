import {
  Catch,
  Injectable,
  StreamableFile,
  type ArgumentsHost,
  type CallHandler,
  type ExceptionFilter,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { map, type Observable } from 'rxjs';
import { validateResponse } from '@blariyo/contracts';
import { ApiError } from '../shared/errors.js';
import type { CoreRequest } from './contracts.js';

export class PlainResult {
  constructor(
    readonly data: unknown,
    readonly status = 200
  ) {}
}
export class HttpResult {
  constructor(
    readonly data: unknown,
    readonly meta: Record<string, unknown> = {},
    readonly status = 200,
    readonly cache = 'no-store'
  ) {}
}
export class BinaryResult {
  constructor(
    readonly bytes: Buffer,
    readonly mime: string,
    readonly cache = 'private, no-store',
    readonly nosniff = true
  ) {}
}
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor<unknown, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const request = context.switchToHttp().getRequest<CoreRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((result) => {
        if (result instanceof PlainResult) {
          response.status(result.status);
          return result.data;
        }
        if (result instanceof BinaryResult) {
          response.status(200).set({
            'Cache-Control': result.cache,
            'Content-Type': result.mime,
            ...(result.nosniff ? { 'X-Content-Type-Options': 'nosniff' } : {}),
          });
          return new StreamableFile(result.bytes);
        }
        if (!(result instanceof HttpResult)) return result;
        response.status(result.status).setHeader('Cache-Control', result.cache);
        if (result.status === 204) return undefined;
        const envelope = {
          success: true,
          data: result.data,
          meta: { requestId: request.requestId, ...result.meta },
        };
        if (!request.operation || !validateResponse(request.operation, result.status, envelope))
          throw new ApiError(500, 'INTERNAL_ERROR');
        return envelope;
      })
    );
  }
}
function property(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? Reflect.get(value, key)
    : undefined;
}
@Catch()
export class CoreExceptionFilter implements ExceptionFilter<unknown> {
  catch(error: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<CoreRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500,
      code = 'INTERNAL_ERROR';
    const type = property(error, 'type');
    const rawCode = property(error, 'code');
    const errorCode = typeof rawCode === 'string' ? rawCode : '';
    const message = error instanceof Error ? error.message : '';
    if (error instanceof ApiError) {
      status = error.status;
      code = error.code;
    } else if (type === 'entity.too.large') {
      status = 413;
      code = 'REQUEST_TOO_LARGE';
    } else if (type === 'entity.parse.failed' || errorCode.startsWith('23')) {
      status = 400;
      code = 'VALIDATION_FAILED';
    } else if (
      /^(08|53|57P|ECONN|ETIMEDOUT|ENOTFOUND)/.test(errorCode) ||
      /connection.*(terminated|closed)/i.test(message)
    ) {
      status = 503;
      code = 'DEPENDENCY_UNAVAILABLE';
    } else if (property(error, 'status') === 404) {
      status = 404;
      const path = request.originalUrl.split('?')[0] ?? request.originalUrl;
      code = /^(?:\/api\/v1\/admin\/collect|\/internal\/collect)(?:\/|$)/.test(path)
        ? 'CANDIDATE_NOT_FOUND'
        : 'POST_NOT_FOUND';
    }
    if (code === 'IDEMPOTENCY_IN_PROGRESS') response.setHeader('Retry-After', '1');
    if (error instanceof ApiError && error.retryAfterSeconds)
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(status).setHeader('Cache-Control', 'no-store');
    response.json({
      success: false,
      error: {
        code,
        message: code.endsWith('NOT_FOUND')
          ? '요청한 내용을 찾을 수 없습니다.'
          : '요청을 처리하지 못했습니다. 다시 확인해 주세요.',
        ...(error instanceof ApiError && error.fields ? { fields: error.fields } : {}),
      },
      meta: { requestId: request.requestId ?? randomUUID() },
    });
  }
}
