import { Inject, Injectable } from '@nestjs/common';
import { CollectionOperationsRepository } from './collection-operations.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail } from '../../shared/errors.js';

@Injectable()
export class CollectionOperationsService {
  constructor(
    @Inject(CollectionOperationsRepository)
    private readonly repository: CollectionOperationsRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async assertSpringReady(mutation: boolean): Promise<void> {
    if (!(await this.repository.schemaReady())) fail(503, 'DEPENDENCY_UNAVAILABLE');
    if (!mutation) return;
    if (await this.repository.hasLegacyMutationData()) fail(503, 'LEGACY_DRAIN_REQUIRED');
    if (!(await this.repository.inspectTransition()).strict)
      fail(503, 'SPRING_TRANSITION_REQUIRED');
  }
  inspectTransition() {
    return this.repository.inspectTransition();
  }
  applyTransition() {
    return this.work.transaction(async () => {
      await this.repository.lockTransitionTables();
      const before = await this.repository.inspectTransition();
      if (before.legacyRunning || before.legacyPreviews) throw new Error('LEGACY_DRAIN_REQUIRED');
      await this.repository.enforceTransitionConstraints();
      return this.repository.inspectTransition();
    });
  }
  async events() {
    return {
      items: (await this.repository.eventsAvailable())
        ? await this.repository.unacknowledgedEvents()
        : [],
    };
  }
  async acknowledge(eventId: string) {
    const event = await this.repository.acknowledge(eventId);
    if (!event) fail(404, 'EVENT_NOT_FOUND');
    return event;
  }
}
