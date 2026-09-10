import {
  Inject,
  Injectable,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { matchOperation } from '@blariyo/contracts';
import { fail } from '../shared/errors.js';
import type { CoreRequest } from './contracts.js';
export const HTTP_OPTIONS = Symbol('HTTP_OPTIONS');
export interface HttpOptions {
  localMedia?: boolean;
  serviceToken?: string;
  maintenance?: boolean;
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(HTTP_OPTIONS) private readonly options: HttpOptions) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CoreRequest>();
    // Express also dispatches HEAD to GET handlers. The public contract accepts only explicit methods.
    const path = request.originalUrl.split('?')[0] ?? request.originalUrl;
    if (!matchOperation(request.method, path))
      fail(
        404,
        /^\/api\/v1\/admin\/collect(?:\/|$)/.test(path) ? 'CANDIDATE_NOT_FOUND' : 'POST_NOT_FOUND'
      );
    const token = this.options.serviceToken,
      given = request.get('X-Blariyo-Service-Token') ?? '';
    if (
      !token ||
      Buffer.byteLength(token) < 32 ||
      Buffer.byteLength(given) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(token))
    )
      fail(401, 'ADMIN_AUTH_REQUIRED');
    const actor = request.get('X-Blariyo-Admin-Actor') ?? '';
    if (!/^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$/.test(actor)) fail(403, 'ADMIN_FORBIDDEN');
    request.actor = actor;
    return true;
  }
}
export const Actor = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const actor = context.switchToHttp().getRequest<CoreRequest>().actor;
  if (!actor) fail(401, 'ADMIN_AUTH_REQUIRED');
  return actor;
});
