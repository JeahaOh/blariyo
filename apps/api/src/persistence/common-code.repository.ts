import { Inject, Injectable } from '@nestjs/common';
import { CommonCodeRepository, type CommonCodeGroup, type CommonCode } from '../features/common-codes/common-code.repository.js';
import { DatabaseContext } from './database.js';
import { rows } from './rows.js';
function group(row: Record<string, unknown>): CommonCodeGroup {
  if (!(row.updated_at instanceof Date)) throw Error('INVALID_COMMON_CODE_TIMESTAMP');
  return { groupKey: String(row.group_key), displayName: String(row.display_name),
    lockVersion: Number(row.lock_version), updatedAt: row.updated_at.toISOString() };
}
function code(row: Record<string, unknown>): CommonCode {
  return { ...group(row), code: String(row.code), referenceKey: typeof row.reference_key === 'string' ? row.reference_key : null };
}
@Injectable()
export class TypeOrmCommonCodeRepository extends CommonCodeRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async groups() {
    return rows(await this.db.manager.query('SELECT * FROM content.common_code_group ORDER BY group_key')).map(group);
  }
  async group(key: string) {
    const row = rows(await this.db.manager.query('SELECT * FROM content.common_code_group WHERE group_key=$1', [key]))[0];
    return row ? group(row) : null;
  }
  async createGroup(key: string, name: string, actor: string) {
    const row = rows(await this.db.manager.query(`INSERT INTO content.common_code_group(group_key,display_name,created_by,updated_by)
      VALUES($1,$2,$3,$3) ON CONFLICT DO NOTHING RETURNING *`, [key,name,actor]))[0];
    return row ? group(row) : null;
  }
  async updateGroup(key: string, name: string, version: number, actor: string) {
    const row = rows(await this.db.manager.query(`WITH changed AS (
      UPDATE content.common_code_group SET display_name=$2,lock_version=lock_version+1,updated_by=$4,updated_at=clock_timestamp()
      WHERE group_key=$1 AND lock_version=$3 RETURNING *) SELECT * FROM changed`, [key,name,version,actor]))[0];
    return row ? group(row) : null;
  }
  async list(key: string) {
    return rows(await this.db.manager.query('SELECT * FROM content.common_code WHERE group_key=$1 ORDER BY code',[key])).map(code);
  }
  async find(key: string, value: string) {
    const row=rows(await this.db.manager.query('SELECT * FROM content.common_code WHERE group_key=$1 AND code=$2',[key,value]))[0];
    return row ? code(row) : null;
  }
  async findReference(key: string, reference: string) {
    const row=rows(await this.db.manager.query('SELECT * FROM content.common_code WHERE group_key=$1 AND reference_key=$2',[key,reference]))[0];
    return row ? code(row) : null;
  }
  async create(key: string, value: string, name: string, reference: string | null, actor: string) {
    const row=rows(await this.db.manager.query(`INSERT INTO content.common_code(group_key,code,display_name,reference_key,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$5) ON CONFLICT DO NOTHING RETURNING *`,[key,value,name,reference,actor]))[0];
    return row ? code(row) : null;
  }
  async update(key: string, value: string, name: string, version: number, actor: string) {
    const row=rows(await this.db.manager.query(`WITH changed AS (
      UPDATE content.common_code SET display_name=$3,lock_version=lock_version+1,updated_by=$5,updated_at=clock_timestamp()
      WHERE group_key=$1 AND code=$2 AND lock_version=$4 RETURNING *) SELECT * FROM changed`,[key,value,name,version,actor]))[0];
    return row ? code(row) : null;
  }
}
