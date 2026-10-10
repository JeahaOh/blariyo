import { AutoPublishKeywordRepository, type AutoPublishRules } from './auto-publish-keyword.repository.js';
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { ApiError } from '../../shared/errors.js';
import { SourcePublishPolicyRepository } from './source-publish-policy.repository.js';
import { BatchReviewService } from './batch-review.service.js';
import { ReviewCommandService } from './review-command.service.js';
import { reviewManifest, reviewSelection } from './discord-review-policy.js';
import { collectionDigest } from './collection-url.js';
import { COLLECTION_OPTIONS, type CollectionOptions } from './collection-admin.guard.js';
import { classifyAutoPublish, type AutoPublishClassification } from './auto-publish-classifier.js';
import { AutoPublishClassificationRepository } from './auto-publish-classification.repository.js';
import { draftTitle } from '@blariyo/contracts/draft-title';

@Injectable()
export class SourceAutoPublishService {
  constructor(@Inject(AutoPublishKeywordRepository) private readonly keywords: AutoPublishKeywordRepository,
    @Inject(SourcePublishPolicyRepository) private readonly policies: SourcePublishPolicyRepository,
    @Inject(ReviewCommandService) private readonly commands: ReviewCommandService,
    @Inject(BatchReviewService) private readonly batches: BatchReviewService,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(COLLECTION_OPTIONS) private readonly options: CollectionOptions,
    @Inject(AutoPublishClassificationRepository) private readonly classifications: AutoPublishClassificationRepository) {}
  private async classified(itemId: string, rules: AutoPublishRules) {
    const item = (await this.batches.detail(itemId)).item;
    const title = draftTitle(item.title ?? '',item.sourceKey);
    let classification = classifyAutoPublish(item,rules);
    if (classification.decision === 'ELIGIBLE' && await this.classifications.duplicateTitle(title))
      classification = { ...classification,decision:'REVIEW',category:null,reason:'DUPLICATE_TITLE' };
    return { item,title,classification };
  }
  async preview(limit = 20) {
    this.assertLimit(limit);
    const decisions: ({ itemId: string } & AutoPublishClassification)[] = [];
    if (!this.options.collectBatchReviewEnabled || this.options.maintenance) return decisions;
    const rules = await this.keywords.current();
    for (const candidate of await this.policies.candidates(limit)) {
      const { classification } = await this.classified(candidate.itemId,rules);
      decisions.push({ itemId:candidate.itemId,...classification });
    }
    return decisions;
  }
  async run(limit = 5) {
    this.assertLimit(limit);
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
        const rules = await this.keywords.current();
        const pending = await this.policies.pending(limit);
        for (const id of pending) { if (Date.now()>=end) return; await advance(id); }
        let remaining = limit-pending.length;
        if (remaining <= 0) return;
        for (const candidate of await this.policies.candidates(20)) {
          if (Date.now()>=end) return;
          try {
            const { item,title,classification } = await this.classified(candidate.itemId,rules);
            await this.work.transaction(() => this.classifications.record({ ...classification,itemId:item.itemId,
              itemVersion:item.version,policyVersion:candidate.policyVersion,contentDigest:item.contentDigest,title }));
            if (classification.decision !== 'ELIGIBLE') { count(classification.reason); continue; }
            const selection = reviewSelection(reviewManifest(item.bodyBlocks,item.contentDigest),[]);
            const body = { boardSlug:'meme',sourceKey:candidate.sourceKey,policyVersion:candidate.policyVersion,
              classificationVersion:classification.ruleVersion,classificationDigest:item.contentDigest };
            const command = await this.commands.accept({ itemId:item.itemId,origin:'AUTO',action:'APPROVE_PUBLISH',
              actor:'system:collector',operatorId:null,reviewerIds:[],expectedEpoch:0,itemVersion:item.version,
              reviewVersion:0,contentDigest:item.contentDigest,selectionDigest:selection.digest,excludedUnitIds:[],
              evidence:{ reason:'SOURCE_AUTO_PUBLISH',classification, ...body },requestBody:body,
              requestKey:`auto:${item.itemId}:${candidate.policyVersion}`,requestHash:collectionDigest({itemId:item.itemId,...body}).toString('hex') });
            await advance(command.id);
            if (--remaining <= 0) break;
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
  private assertLimit(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ApiError(400,'AUTO_PUBLISH_LIMIT_INVALID');
  }
}
