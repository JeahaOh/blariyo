import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CollectionRepository } from './collection.repository.js';
import { CollectionService } from './collection.service.js';
import { CollectorLeaseService, type ClaimedCandidate } from './collector-lease.service.js';
import { CollectorResultService } from './collector-result.service.js';
import { CollectorPreviewService } from './collector-preview.service.js';
import { CollectorStateRepository } from './collector-state.repository.js';
import { CollectorProtocolService, assertExecution } from './collector-protocol.service.js';
import { CollectorReceiptRepository } from './collector-receipt.repository.js';
import { IdempotencyRepository } from '../../shared/idempotency.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { collectionDigest } from './collection-url.js';
import { sourceDto } from './collection.dto.js';
import { fail } from '../../shared/errors.js';
import type { CollectorCommand } from './collector-command.model.js';
function claimDto(candidate: ClaimedCandidate) {
  const source = candidate.source;
  return {
    candidateId: Number(candidate.candidateId),
    sourceId: Number(source.id),
    sourceHost: source.host,
    originUrl: candidate.originUrl,
    discoveryMode: candidate.discoveryMode,
    attemptCount: candidate.attemptCount,
    lockVersion: candidate.lockVersion,
    leaseUntil: candidate.leaseUntil.toISOString(),
    requestIntervalMs: source.requestIntervalMs,
    dailyFetchLimit: source.dailyFetchLimit,
    robotsAllowed: source.robotsAllowed,
    robotsCheckedAt: source.robotsCheckedAt?.toISOString() ?? null,
    isActive: source.isActive,
    ...(candidate.collectorExecutionId === undefined
      ? {}
      : { collectorExecutionId: candidate.collectorExecutionId }),
  };
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('INVALID_COLLECTOR_RECEIPT');
  return Object.fromEntries(Object.entries(value));
}
@Injectable()
export class CollectorCommandsService {
  constructor(
    @Inject(CollectionRepository) private readonly repository: CollectionRepository,
    @Inject(CollectionService) private readonly collection: CollectionService,
    @Inject(CollectorLeaseService) private readonly leases: CollectorLeaseService,
    @Inject(CollectorResultService) private readonly results: CollectorResultService,
    @Inject(CollectorPreviewService) private readonly previews: CollectorPreviewService,
    @Inject(CollectorStateRepository) private readonly state: CollectorStateRepository,
    @Inject(CollectorProtocolService) private readonly protocol: CollectorProtocolService,
    @Inject(CollectorReceiptRepository) private readonly receipts: CollectorReceiptRepository,
    @Inject(IdempotencyRepository) private readonly legacyReceipts: IdempotencyRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async legacy(
    command: CollectorCommand,
    collectorId: string,
    key: string
  ): Promise<{ status: number; data: unknown }> {
    switch (command.action) {
      case 'claim':
        return {
          status: 200,
          data: { items: (await this.leases.claim(command.body)).map(claimDto) },
        };
      case 'heartbeat': {
        const data = await this.leases.heartbeat(command.params.candidateId, command.body);
        return {
          status: 200,
          data: {
            candidateId: Number(data.candidateId),
            status: 'RUNNING',
            lockVersion: data.lockVersion,
            leaseUntil: data.leaseUntil.toISOString(),
            source: sourceDto(data.source),
          },
        };
      }
      case 'preview':
        return {
          status: 200,
          data: await this.previews.upload(
            command.params.candidateId,
            command.params.candidateImageId,
            command.body,
            command.file
          ),
        };
      case 'create':
        return this.collection.command(
          { action: 'create', params: command.params, body: command.body },
          'system:collector',
          key,
          'collector:' +
            createHash('sha256')
              .update(collectorId + ':' + command.operation)
              .digest('hex')
        );
      case 'result': {
        const actor = 'system:collector';
        const scope =
          'collector:' +
          createHash('sha256')
            .update(collectorId + ':' + command.operation)
            .digest('hex');
        const hash = collectionDigest({ params: command.params, body: command.body });
        return this.work.lock(
          `collect:key:${actor}:${scope}:${key}`,
          async () => {
            const previous = await this.legacyReceipts.find(actor, scope, key, true);
            if (previous) {
              if (!previous.hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
              return { status: previous.status, data: previous.data };
            }
            return this.work.lock(`collect:candidate:${command.params.candidateId}`, () =>
              this.work.transaction(async () => {
                const result = await this.results.submit(command.params.candidateId, command.body);
                const data = this.resultDto(result);
                await this.legacyReceipts.save(
                  {
                    actor,
                    scope,
                    key,
                    hash,
                    data,
                    status: 200,
                    resourceType: 'CANDIDATE',
                    resourceId: command.params.candidateId,
                  },
                  true
                );
                return { status: 200, data };
              })
            );
          },
          false
        );
      }
    }
  }
  private resultDto(result: Awaited<ReturnType<CollectorResultService['submit']>>) {
    return {
      candidateId: Number(result.candidateId),
      status: result.status,
      lockVersion: result.lockVersion,
      imageCandidates: result.images.map((image) => ({
        candidateImageId: Number(image.id),
        position: image.position,
      })),
    };
  }
  async spring(
    command: CollectorCommand,
    collectorId: string,
    key: string
  ): Promise<{ status: number; data: unknown }> {
    const request = {
      params: command.params,
      body: command.body,
      ...(command.action === 'preview'
        ? { fileHash: createHash('sha256').update(command.file.bytes).digest('hex') }
        : {}),
    };
    const receipt = this.protocol.key(collectorId, command.operation, key, request);
    const executionId =
      'collectorExecutionId' in command.body &&
      typeof command.body.collectorExecutionId === 'string'
        ? command.body.collectorExecutionId
        : '';
    return this.work.lock(
      `collect:v2:${collectorId}:${command.operation}:${receipt.keyHash.toString('hex')}`,
      async () => {
        const old = await this.protocol.replay(receipt);
        if (old) {
          const id = command.params.candidateId;
          if (id) {
            const candidate = await this.repository.find(id);
            if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
            assertExecution(candidate, collectorId, executionId);
            if (['APPROVED', 'REJECTED', 'PENDING'].includes(candidate.status))
              fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
            if (
              command.action === 'heartbeat' &&
              (candidate.status !== 'RUNNING' ||
                !candidate.leaseUntil ||
                candidate.leaseUntil <= new Date())
            )
              fail(409, 'CANDIDATE_LEASE_CONFLICT');
          }
          return {
            status: old.status,
            data:
              command.action === 'claim'
                ? await this.replayClaim(
                    old.data,
                    collectorId,
                    executionId,
                    'mode' in command.body && command.body.mode === 'PREVIEW_REFRESH'
                  )
                : old.data,
          };
        }
        if (command.action === 'preview')
          return {
            status: 200,
            data: await this.previews.upload(
              command.params.candidateId,
              command.params.candidateImageId,
              command.body,
              command.file,
              { executionId, receipt }
            ),
          };
        const execute = () =>
          this.work.transaction(async () => {
            let status = 200;
            let data: unknown;
            if (command.action === 'claim') {
              if ('mode' in command.body && command.body.mode === 'PREVIEW_REFRESH') {
                const id = String(command.body.candidateId);
                const candidate = await this.repository.find(id, true);
                if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
                if (
                  candidate.status !== 'NEW' ||
                  candidate.lockVersion !== command.body.lockVersion
                )
                  fail(409, 'CANDIDATE_VERSION_CONFLICT');
                await this.state.refreshOwnership(id, collectorId, executionId);
                const source = await this.repository.source(candidate.sourceId);
                if (!source) fail(404, 'SOURCE_NOT_FOUND');
                data = {
                  items: [
                    {
                      candidateId: Number(id),
                      sourceId: Number(source.id),
                      sourceHost: source.host,
                      collectorExecutionId: executionId,
                      lockVersion: candidate.lockVersion + 1,
                      leaseUntil: null,
                      attemptCount: candidate.attemptCount,
                      discoveryMode: candidate.discoveryMode,
                      requestIntervalMs: source.requestIntervalMs,
                      dailyFetchLimit: source.dailyFetchLimit,
                      robotsAllowed: source.robotsAllowed,
                      robotsCheckedAt: source.robotsCheckedAt?.toISOString() ?? null,
                      isActive: source.isActive,
                    },
                  ],
                };
                await this.receipts.save(receipt, status, data);
                return {
                  status,
                  data: await this.replayClaim(data, collectorId, executionId, true),
                };
              }
              const items = (
                await this.leases.claim({ ...command.body, maxItems: 1 }, executionId)
              ).map(claimDto);
              data = { items };
              await this.receipts.save(receipt, status, {
                items: items.map(({ originUrl: _url, ...item }) => item),
              });
              return { status, data };
            }
            if (command.action === 'heartbeat') {
              const result = await this.leases.heartbeat(
                  command.params.candidateId,
                  command.body,
                  executionId
                ),
                source = result.source;
              data = {
                candidateId: Number(result.candidateId),
                status: 'RUNNING',
                lockVersion: result.lockVersion,
                leaseUntil: result.leaseUntil.toISOString(),
                source: {
                  sourceId: Number(source.id),
                  host: source.host,
                  lockVersion: source.lockVersion,
                  isActive: source.isActive,
                  robotsAllowed: source.robotsAllowed,
                  robotsCheckedAt: source.robotsCheckedAt?.toISOString() ?? null,
                  requestIntervalMs: source.requestIntervalMs,
                  dailyFetchLimit: source.dailyFetchLimit,
                },
              };
            } else if (command.action === 'result')
              data = this.resultDto(
                await this.results.submit(command.params.candidateId, command.body, executionId)
              );
            else {
              data = await this.collection.createCandidateInTransaction(
                command.body.originUrl,
                'system:collector',
                command.body.discoveryMode
              );
              status = 202;
            }
            await this.receipts.save(receipt, status, data);
            return { status, data };
          });
        if (
          command.action === 'claim' &&
          'mode' in command.body &&
          command.body.mode === 'PREVIEW_REFRESH'
        )
          return this.work.lock(`collect:candidate:${command.body.candidateId}`, execute);
        if (command.action === 'create' || command.action === 'result')
          return this.work.lock(
            `collect:key:system:collector:spring:${collectorId}:${command.operation}:${receipt.keyHash.toString('hex')}`,
            () =>
              command.action === 'result'
                ? this.work.lock(`collect:candidate:${command.params.candidateId}`, execute)
                : execute(),
            false
          );
        return execute();
      },
      false
    );
  }
  private async replayClaim(
    saved: unknown,
    collectorId: string,
    executionId: string,
    refresh: boolean
  ) {
    const data = record(saved);
    if (!Array.isArray(data.items)) throw new Error('INVALID_CLAIM_RECEIPT');
    const items: Record<string, unknown>[] = [];
    for (const value of data.items) {
      const item = record(value);
      if (
        typeof item.candidateId !== 'number' ||
        !Number.isSafeInteger(item.candidateId) ||
        item.candidateId < 1 ||
        typeof item.lockVersion !== 'number'
      )
        throw new Error('INVALID_CLAIM_RECEIPT');
      const candidate = await this.repository.find(String(item.candidateId));
      if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
      assertExecution(candidate, collectorId, executionId);
      if (refresh) {
        if (candidate.status !== 'NEW' || candidate.lockVersion !== item.lockVersion)
          fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
        item.images = (await this.state.missingPreviews(candidate.id)).map((image) => ({
          candidateImageId: Number(image.id),
          position: image.position,
          remoteUrl: image.remoteUrl,
        }));
      } else {
        if (
          candidate.status !== 'RUNNING' ||
          !candidate.leaseUntil ||
          candidate.leaseUntil <= new Date()
        )
          fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
        item.originUrl = candidate.originUrl;
      }
      items.push(item);
    }
    return { ...data, items };
  }
}
