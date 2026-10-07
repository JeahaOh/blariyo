import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { UnitOfWork } from '../../shared/unit-of-work.js';

export interface CleanupClaim {
  deliveryId: string;
  channelId: string;
  headMessageId: string | null;
  threadId: string | null;
  headDeleted: boolean;
  threadDeleted: boolean;
  leaseToken: string;
  attemptId: string;
}
export interface CleanupResult {
  headDeleted: boolean;
  threadDeleted: boolean;
  error: string | null;
  blocked: boolean;
  retryAfterMs: number;
}
export abstract class DiscordCleanupRepository {
  abstract claim(deliveryId: string, workerId: string): Promise<CleanupClaim | null>;
  abstract acknowledge(claim: CleanupClaim, result: CleanupResult): Promise<boolean>;
}
export abstract class DiscordDeleteClient {
  abstract deleteHead(channelId: string, messageId: string, signal: AbortSignal): Promise<void>;
  abstract deleteThread(channelId: string, threadId: string, signal: AbortSignal): Promise<void>;
}
export class DiscordTransportError extends Error {
  constructor(readonly safeCode: string, readonly blocked = false, readonly retryAfterMs = 0) {
    super(safeCode);
  }
}

@Injectable()
export class DiscordCleanupService {
  constructor(@Inject(DiscordCleanupRepository) private readonly repository: DiscordCleanupRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(DiscordDeleteClient) private readonly discord: DiscordDeleteClient) {}

  async attempt(deliveryId: string, workerId: string): Promise<void> {
    const claim = await this.work.transaction(() => this.repository.claim(deliveryId, workerId));
    if (!claim) return;
    const result: CleanupResult = { headDeleted: claim.headDeleted, threadDeleted: claim.threadDeleted,
      error: null, blocked: false, retryAfterMs: 0 };
    // One total deadline covers both HTTP requests; neither holds a DB transaction.
    const signal = AbortSignal.timeout(3000);
    try {
      if (!result.headDeleted && claim.headMessageId) {
        await this.discord.deleteHead(claim.channelId, claim.headMessageId, signal);
        result.headDeleted = true;
      }
      if (!result.threadDeleted && claim.threadId) {
        await this.discord.deleteThread(claim.channelId, claim.threadId, signal);
        result.threadDeleted = true;
      }
    } catch (error) {
      result.error = error instanceof DiscordTransportError ? error.safeCode : 'DISCORD_DELETE_FAILED';
      result.blocked = error instanceof DiscordTransportError && error.blocked;
      result.retryAfterMs = error instanceof DiscordTransportError ? error.retryAfterMs : 0;
    }
    await this.work.transaction(() => this.repository.acknowledge(claim, result));
  }
}

/** Best-effort wake-up only. Full queues and crashes leave the durable PENDING job for BATCH. */
@Injectable()
export class DiscordCleanupDispatcher implements OnApplicationShutdown {
  private readonly pending = new Set<string>();
  private active: Promise<void> | undefined;
  private closing = false;
  private readonly logger = new Logger(DiscordCleanupDispatcher.name);
  constructor(@Inject(DiscordCleanupService) private readonly cleanup: DiscordCleanupService) {}
  notify(deliveryId: string): void {
    if (this.closing || this.pending.size >= 100) return;
    this.pending.add(deliveryId);
    if (!this.active) {
      this.active = this.drain().finally(() => { this.active = undefined; });
    }
  }
  private async drain(): Promise<void> {
    while (!this.closing && this.pending.size) {
      const id = this.pending.values().next().value;
      if (!id) break;
      this.pending.delete(id);
      try { await this.cleanup.attempt(id, 'api-after-commit'); }
      catch { this.logger.warn('DISCORD_CLEANUP_DEFERRED_TO_BATCH'); }
    }
  }
  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    this.pending.clear();
    // The in-flight request is bounded by the service deadline; new jobs stay in DB.
    await this.active;
  }
}
