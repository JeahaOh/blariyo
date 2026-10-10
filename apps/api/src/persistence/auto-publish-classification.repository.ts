import { Inject, Injectable } from '@nestjs/common';
import { AutoPublishClassificationRepository, type ClassificationRecord } from '../features/collection/auto-publish-classification.repository.js';
import { DatabaseContext } from './database.js';
import { rows } from './rows.js';

@Injectable()
export class TypeOrmAutoPublishClassificationRepository extends AutoPublishClassificationRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async record(input: ClassificationRecord) {
    await this.db.manager.query(`INSERT INTO collect.batch_auto_publish_classification
      (item_id,item_version,policy_version,content_digest,title_key,rule_version,decision,category,reason)
      VALUES($1,$2,$3,$4,collect.auto_publish_title_key($5),$6,$7,$8,$9)
      ON CONFLICT(item_id) DO UPDATE SET item_version=$2,policy_version=$3,content_digest=$4,
        title_key=EXCLUDED.title_key,rule_version=$6,decision=$7,category=$8,reason=$9,classified_at=clock_timestamp()`,
    [input.itemId,input.itemVersion,input.policyVersion,Buffer.from(input.contentDigest,'hex'),input.title,input.ruleVersion,input.decision,input.category,input.reason]);
  }
  async duplicateTitle(title: string) {
    return rows(await this.db.manager.query(`SELECT 1 FROM content.board_post
      WHERE status<>'REMOVED' AND collect.auto_publish_title_key(title)=collect.auto_publish_title_key($1) LIMIT 1`,[title])).length > 0;
  }
}
