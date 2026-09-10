import type { ImagesRepository } from '../dist/features/images/images.repository.js';
import type { Storage } from '../dist/shared/storage.js';
import type { UnitOfWork } from '../dist/shared/unit-of-work.js';
import type { OutboxRepository } from '../dist/operations/outbox.repository.js';
async function unexpected(): Promise<never> { throw new Error('Unexpected test-double call'); }
export function imageRepository(overrides: Partial<ImagesRepository> = {}): ImagesRepository {
  return { create: unexpected, find: unexpected, byPublicKey: unexpected, transitionStatus: unexpected, attached: unexpected, update: unexpected, markPrivateDelete: unexpected, ...overrides };
}
export function objectStorage(overrides: Partial<Storage> = {}): Storage {
  return { put: unexpected, get: unexpected, promote: unexpected, delete: unexpected, inventory: unexpected, ...overrides };
}
export function outboxRepository(overrides: Partial<OutboxRepository> = {}): OutboxRepository {
  return { recoverExpired: unexpected, claim: unexpected, owns: unexpected, succeed: unexpected, fail: unexpected, enqueue: unexpected, ...overrides };
}
export const immediateWork: UnitOfWork = {
  transaction: <T>(work: () => Promise<T>) => work(),
  transactionLock: unexpected,
  lock: unexpected,
};
