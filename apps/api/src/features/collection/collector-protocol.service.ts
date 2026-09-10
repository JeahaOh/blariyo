import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { COLLECTION_OPTIONS, type CollectionOptions } from './collection-admin.guard.js';
import {
  CollectorReceiptRepository,
  type CollectorReceiptKey,
} from './collector-receipt.repository.js';
import { collectionDigest } from './collection-url.js';
import { fail } from '../../shared/errors.js';
import type { CandidateRecord } from './collection.model.js';
export function assertExecution(
  candidate: CandidateRecord,
  collectorId: string,
  executionId: string
) {
  if (
    candidate.collectorId !== collectorId ||
    candidate.collectorExecutionId !== executionId.toLowerCase()
  )
    fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
}
@Injectable()
export class CollectorProtocolService {
  constructor(
    @Inject(COLLECTION_OPTIONS) private readonly options: CollectionOptions,
    @Inject(CollectorReceiptRepository) private readonly receipts: CollectorReceiptRepository
  ) {}
  keyHash(key: string): Buffer {
    const secret = this.options.collectorKeySecret;
    if (!secret || secret.length < 32) throw new Error('COLLECTOR_KEY_SECRET_REQUIRED');
    return createHmac('sha256', secret).update(key).digest();
  }
  key(collectorId: string, operation: string, key: string, request: unknown): CollectorReceiptKey {
    return {
      collectorId,
      operation,
      keyHash: this.keyHash(key),
      requestHash: collectionDigest(request),
    };
  }
  async replay(key: CollectorReceiptKey) {
    const receipt = await this.receipts.find(key.collectorId, key.operation, key.keyHash);
    if (receipt && !receipt.requestHash.equals(key.requestHash)) fail(409, 'IDEMPOTENCY_CONFLICT');
    return receipt;
  }
}
