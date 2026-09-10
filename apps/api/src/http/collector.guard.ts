import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { matchOperation } from '@blariyo/contracts';
import {
  COLLECTION_OPTIONS,
  type CollectionOptions,
} from '../features/collection/collection-admin.guard.js';
import { CollectionOperationsService } from '../features/collection/collection-operations.service.js';
import { ApiError, fail } from '../shared/errors.js';
import type { CoreRequest } from './contracts.js';
export interface CollectorCredential {
  collectorId: string;
  tokenSha256: string;
  scopes?: string[];
  contractVersion?: string;
}
@Injectable()
export class CollectorGuard implements CanActivate {
  private readonly limits = new Map<string, { count: number; expires: number }>();
  constructor(
    @Inject(COLLECTION_OPTIONS) private readonly options: CollectionOptions,
    @Inject(CollectionOperationsService) private readonly operations: CollectionOperationsService
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CoreRequest>();
    if (!this.options.collectManualUrlEnabled && !this.options.collectDiscordCommandEnabled)
      fail(404, 'CANDIDATE_NOT_FOUND');
    const path = (request.originalUrl.split('?')[0] ?? request.originalUrl).replace(
      '/internal/collect',
      '/api/collector/v1'
    );
    const operation = matchOperation(request.method, path);
    if (!operation) fail(404, 'CANDIDATE_NOT_FOUND');
    request.contractPath = path;
    request.operation = operation;
    const token = /^Bearer ([^\s]+)$/.exec(request.get('authorization') ?? '')?.[1];
    if (!token || token.length < 32) fail(401, 'COLLECTOR_AUTH_REQUIRED');
    const hash = createHash('sha256').update(token).digest();
    const collector = this.options.collectorTokens?.find(
      (item) =>
        /^[a-f0-9]{64}$/.test(item.tokenSha256) &&
        timingSafeEqual(hash, Buffer.from(item.tokenSha256, 'hex'))
    );
    if (!collector) fail(401, 'COLLECTOR_AUTH_REQUIRED');
    const spring = collector.contractVersion === 'SPRING_V2';
    if (
      !(spring
        ? collector.scopes?.some((scope) =>
            ['collector:run', 'collector:read', 'collector:event'].includes(scope)
          )
        : collector.scopes?.includes('collect')) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(collector.collectorId)
    )
      fail(403, 'COLLECTOR_FORBIDDEN');
    const contract = collector.contractVersion ?? 'LEGACY_V1';
    if (contract !== 'LEGACY_V1' && contract !== 'SPRING_V2') fail(403, 'COLLECTOR_FORBIDDEN');
    if (request.method !== 'GET' && contract !== (this.options.collectContractMode ?? 'LEGACY_V1'))
      fail(403, 'COLLECTOR_CONTRACT_DISABLED');
    if (spring) {
      const scope =
        request.method === 'GET'
          ? 'collector:read'
          : operation.operationId === 'collectorOperationalEvent'
            ? 'collector:event'
            : 'collector:run';
      if (!collector.scopes?.includes(scope)) fail(403, 'COLLECTOR_FORBIDDEN');
      await this.operations.assertSpringReady(request.method !== 'GET');
    }
    request.collector = collector;
    const now = Date.now();
    for (const [key, rate] of this.limits) if (rate.expires <= now) this.limits.delete(key);
    const rate = this.limits.get(collector.collectorId) ?? { count: 0, expires: now + 60000 };
    rate.count++;
    this.limits.set(collector.collectorId, rate);
    if (rate.count > 120) throw new ApiError(429, 'RATE_LIMITED', undefined, 60);
    if (
      operation.operationId === 'collectorCreateCandidate' &&
      !this.options.collectDiscordCommandEnabled
    )
      fail(404, 'CANDIDATE_NOT_FOUND');
    if (request.maintenance && request.method !== 'GET')
      throw new ApiError(503, 'MAINTENANCE_READ_ONLY', undefined, 60);
    return true;
  }
}
