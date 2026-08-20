class ScheduledPostPublisher {
  constructor({ adminPostLifecycleRepository, mediaPromotionService, clock = () => new Date() }) {
    this.repository = adminPostLifecycleRepository;
    this.mediaPromotionService = mediaPromotionService;
    this.clock = clock;
  }

  async publishDue({ limit = 100 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('limit must be an integer between 1 and 1000');
    }
    const now = this.clock();
    const candidates = await this.repository.findDuePosts(limit, now);
    let published = 0;
    let skipped = 0;
    let failed = 0;
    for (const candidate of candidates) {
      try {
        const prepared = await this.repository.prepareDue(
          candidate.id,
          candidate.lock_version,
          now
        );
        if (prepared.kind !== 'READY') {
          skipped += 1;
          continue;
        }
        const promoted = await this.mediaPromotionService.promote(candidate.id, prepared.images);
        const result = await this.repository.completeDue(prepared, promoted, now);
        if (result.kind === 'COMPLETED') published += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }
    return { candidates: candidates.length, published, skipped, failed };
  }
}

module.exports = ScheduledPostPublisher;
