import { Inject, Injectable } from '@nestjs/common';
import {
  PoliciesRepository,
  type PolicyVersion,
  type PolicyPublication,
} from '../features/policies/policies.repository.js';
import { DatabaseContext } from './database.js';
import { LegalPolicyVersionEntity } from './entities.js';
import { requiredRow, decimalId } from './rows.js';
function map(row: LegalPolicyVersionEntity | null): PolicyVersion | null {
  return row ? { title: row.title, bodyHtml: row.body_html, effectiveAt: row.effective_at } : null;
}
@Injectable()
export class TypeOrmPoliciesRepository extends PoliciesRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async version(type: string, version: string) {
    return map(
      await this.db.manager.findOneBy(LegalPolicyVersionEntity, {
        policy_type: type,
        version_label: version,
      })
    );
  }
  async effective(type: string) {
    return map(
      await this.db.manager.findOneBy(LegalPolicyVersionEntity, {
        policy_type: type,
        status: 'EFFECTIVE',
      })
    );
  }
  async retire(type: string, endedAt: Date) {
    await this.db.manager
      .createQueryBuilder()
      .update(LegalPolicyVersionEntity)
      .set({
        status: 'RETIRED',
        ended_at: endedAt,
        updated_by: 'system:policy-publisher',
        updated_at: () => 'now()',
      })
      .where("policy_type=:type AND status='EFFECTIVE'", { type })
      .execute();
  }
  async publish(policy: PolicyPublication) {
    const result = await this.db.manager
      .createQueryBuilder()
      .insert()
      .into(LegalPolicyVersionEntity)
      .values({
        policy_type: policy.type,
        version_label: policy.version,
        title: policy.title,
        body_html: policy.bodyHtml,
        status: 'EFFECTIVE',
        effective_at: policy.effectiveAt,
        created_by: 'system:policy-publisher',
        created_at: () => 'now()',
        updated_by: 'system:policy-publisher',
        updated_at: () => 'now()',
      })
      .returning('id')
      .execute();
    return decimalId(requiredRow(result.raw).id);
  }
  async effectiveTypeCount() {
    const result: unknown = await this.db.manager
      .createQueryBuilder(LegalPolicyVersionEntity, 'policy')
      .select('count(DISTINCT policy.policy_type)', 'count')
      .where("policy.status='EFFECTIVE' AND policy.effective_at<=now()")
      .getRawOne();
    const count = requiredRow([result]).count;
    if (typeof count !== 'string') throw new Error('INVALID_POLICY_COUNT');
    return Number(count);
  }
}
