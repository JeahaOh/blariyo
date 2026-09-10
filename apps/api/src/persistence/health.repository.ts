import { Inject,Injectable } from '@nestjs/common';
import { HealthRepository } from '../features/health/health.repository.js';
import { DatabaseContext } from './database.js';
import { requiredRow } from './rows.js';
@Injectable()
export class TypeOrmHealthRepository extends HealthRepository {
 constructor(@Inject(DatabaseContext) private readonly database:DatabaseContext){super();}
 async ready(collectionEnabled:boolean):Promise<boolean> {
  const version:unknown = await this.database.manager.query(
    "SELECT ops.is_schema_ready('V005') OR ops.is_schema_ready('V004') OR (NOT $1::boolean AND ops.is_schema_ready('V003')) AS ready",
    [collectionEnabled]
  );
  if (!requiredRow(version).ready) return false;
  if (!collectionEnabled) return true;
  const access:unknown = await this.database.manager.query(`SELECT
    has_schema_privilege(current_user,'collect','USAGE')
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='collect' AND c.relkind IN ('r','p') AND NOT (
        has_table_privilege(current_user,c.oid,'SELECT')
        AND has_table_privilege(current_user,c.oid,'INSERT')
        AND has_table_privilege(current_user,c.oid,'UPDATE')
        AND has_table_privilege(current_user,c.oid,'DELETE')
      )
    )
    AND has_table_privilege(current_user,'collect.source','SELECT')
    AND has_table_privilege(current_user,'collect.source','INSERT')
    AND has_table_privilege(current_user,'collect.source','UPDATE')
    AND has_table_privilege(current_user,'collect.source','DELETE')
    AND has_table_privilege(current_user,'collect.candidate','SELECT')
    AND has_table_privilege(current_user,'collect.candidate','INSERT')
    AND has_table_privilege(current_user,'collect.candidate','UPDATE')
    AND has_table_privilege(current_user,'collect.candidate','DELETE')
    AND has_table_privilege(current_user,'collect.candidate_image','SELECT')
    AND has_table_privilege(current_user,'collect.candidate_image','INSERT')
    AND has_table_privilege(current_user,'collect.candidate_image','UPDATE')
    AND has_table_privilege(current_user,'collect.candidate_image','DELETE')
    AND has_sequence_privilege(current_user,'collect.source_id_seq','USAGE')
    AND has_sequence_privilege(current_user,'collect.source_id_seq','SELECT')
    AND has_sequence_privilege(current_user,'collect.candidate_id_seq','USAGE')
    AND has_sequence_privilege(current_user,'collect.candidate_id_seq','SELECT')
    AND has_sequence_privilege(current_user,'collect.candidate_image_id_seq','USAGE')
    AND has_sequence_privilege(current_user,'collect.candidate_image_id_seq','SELECT') AS accessible`);
  return Boolean(requiredRow(access).accessible);
}
}
