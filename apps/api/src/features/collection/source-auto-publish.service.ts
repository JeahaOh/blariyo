import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { ApiError } from '../../shared/errors.js';
import { SourcePublishPolicyRepository } from './source-publish-policy.repository.js';
import { BatchReviewService } from './batch-review.service.js';
import { ReviewCommandService } from './review-command.service.js';
import { reviewManifest, reviewSelection } from './discord-review-policy.js';
import { collectionDigest } from './collection-url.js';
import { COLLECTION_OPTIONS, type CollectionOptions } from './collection-admin.guard.js';

@Injectable()
export class SourceAutoPublishService {
  constructor(@Inject(SourcePublishPolicyRepository) private readonly policies: SourcePublishPolicyRepository,
    @Inject(ReviewCommandService) private readonly commands: ReviewCommandService,
    @Inject(BatchReviewService) private readonly batches: BatchReviewService,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(COLLECTION_OPTIONS) private readonly options: CollectionOptions) {}
  async run(limit = 5) {
    const counts: Record<string,number> = {};
    if (!this.options.collectBatchReviewEnabled || this.options.maintenance) return counts;
    const count = (name: string) => { counts[name] = (counts[name] ?? 0) + 1; };
    const advance = async (id: string) => {
      let result = await this.commands.advance(id,'source-auto-publish');
      if (result.stage === 'DRAFTED') result = await this.commands.advance(id,'source-auto-publish');
      count(result.stage);
    };
    try {
      await this.work.lock('source-auto-publish',async () => {
        const end = Date.now()+120_000;
        const pending = await this.policies.pending(limit);
        for (const id of pending) { if (Date.now()>=end) return; await advance(id); }
        for (const candidate of await this.policies.candidates(Math.max(0,limit-pending.length))) {
          if (Date.now()>=end) return;
          try {
            const item = (await this.batches.detail(candidate.itemId)).item;
            const selection = reviewSelection(reviewManifest(item.bodyBlocks,item.contentDigest),[]);
            const body = { boardSlug:'meme',sourceKey:candidate.sourceKey,policyVersion:candidate.policyVersion };
            const command = await this.commands.accept({ itemId:item.itemId,origin:'AUTO',action:'APPROVE_PUBLISH',
              actor:'system:collector',operatorId:null,reviewerIds:[],expectedEpoch:0,itemVersion:item.version,
              reviewVersion:0,contentDigest:item.contentDigest,selectionDigest:selection.digest,excludedUnitIds:[],
              evidence:{ reason:'SOURCE_AUTO_PUBLISH', ...body },requestBody:body,
              requestKey:`auto:${item.itemId}:${candidate.policyVersion}`,requestHash:collectionDigest({itemId:item.itemId,...body}).toString('hex') });
            await advance(command.id);
          } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            count(error.code);
          }
        }
      },false);
    } catch (error) {
      if (!(error instanceof ApiError && error.code==='IDEMPOTENCY_IN_PROGRESS')) throw error;
      count('BUSY');
    }
    return counts;
  }
}
