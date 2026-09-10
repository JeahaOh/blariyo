import type { CollectorCredential } from '../../http/collector.guard.js';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { HttpOptions } from '../../http/auth.guard.js';
import type { CoreRequest } from '../../http/contracts.js';
import { ApiError, fail } from '../../shared/errors.js';
export const COLLECTION_OPTIONS = Symbol('COLLECTION_OPTIONS');
export interface CollectionOptions extends HttpOptions {
  collectorKeySecret?: string;
  collectorTokens?: CollectorCredential[];
  collectContractMode?: 'LEGACY_V1' | 'SPRING_V2';
  collectManualUrlEnabled?: boolean;
  collectDiscordCommandEnabled?: boolean;
}
@Injectable()
export class CollectionEnabledGuard implements CanActivate {
  constructor(@Inject(COLLECTION_OPTIONS) private readonly options: CollectionOptions) {}
  canActivate(): boolean {
    if (!this.options.collectManualUrlEnabled && !this.options.collectDiscordCommandEnabled)
      fail(404, 'CANDIDATE_NOT_FOUND');
    return true;
  }
}
@Injectable()
export class CollectionMaintenanceGuard implements CanActivate {
  constructor(@Inject(COLLECTION_OPTIONS) private readonly options: CollectionOptions) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CoreRequest>();
    if (
      request.method === 'POST' &&
      request.path.replace(/\/$/, '') === '/api/v1/admin/collect/candidates' &&
      !this.options.collectManualUrlEnabled
    )
      fail(404, 'CANDIDATE_NOT_FOUND');
    // Collection historically checks maintenance after authentication, before request validation/parsing.
    if (request.maintenance && request.method !== 'GET')
      throw new ApiError(503, 'MAINTENANCE_READ_ONLY', undefined, 60);
    return true;
  }
}
