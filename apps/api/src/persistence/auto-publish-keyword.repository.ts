import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { schemaValidator } from '@blariyo/contracts';
import { AutoPublishKeywordRepository, type AutoPublishKeyword, type AutoPublishRules, type KeywordInput, type KeywordMutation } from '../features/collection/auto-publish-keyword.repository.js';
import { DatabaseContext } from './database.js';
import { requiredRow } from './rows.js';
import { fail } from '../shared/errors.js';
const validate = schemaValidator({type:'array',maxItems:500,items:{$ref:'#/components/schemas/AutoPublishKeyword'}});
function keywords(value: unknown): AutoPublishKeyword[] {
  const valid = (v: unknown): v is AutoPublishKeyword[] => validate(v);
  if (!valid(value)) throw new Error('AUTO_PUBLISH_KEYWORDS_INVALID');
  return value;
}
function snapshot(row: Record<string,unknown>): AutoPublishRules {
  if (!(row.updated_at instanceof Date)) throw new Error('AUTO_PUBLISH_KEYWORDS_INVALID');
  return {ruleVersion:String(row.rule_version),items:keywords(row.keywords),updatedAt:row.updated_at.toISOString()};
}
@Injectable()
export class TypeOrmAutoPublishKeywordRepository extends AutoPublishKeywordRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async current() {
    return snapshot(requiredRow(await this.db.manager.query(`SELECT r.* FROM collect.auto_publish_keyword_head h
      JOIN collect.auto_publish_keyword_revision r ON r.rule_version=h.rule_version WHERE h.singleton`)));
  }
  private async locked(version: string) {
    const head = requiredRow(await this.db.manager.query('SELECT rule_version FROM collect.auto_publish_keyword_head WHERE singleton FOR UPDATE'));
    if (head.rule_version !== version) fail(409,'AUTO_PUBLISH_KEYWORD_VERSION_CONFLICT');
    return requiredRow(await this.db.manager.query('SELECT * FROM collect.auto_publish_keyword_revision WHERE rule_version=$1',[head.rule_version]));
  }
  private async commit(current: Record<string,unknown>, items: AutoPublishKeyword[], actor: string) {
    const keys = items.map(k=>JSON.stringify([k.group,k.scope,k.matchMode,k.keyword.normalize('NFKC').toLocaleLowerCase('en-US')]));
    if (new Set(keys).size !== keys.length) fail(409,'AUTO_PUBLISH_KEYWORD_DUPLICATE');
    if (items.length > 500) fail(409,'AUTO_PUBLISH_KEYWORD_LIMIT');
    if (isDeepStrictEqual(keywords(current.keywords),items)) return snapshot(current);
    const revision = Number(current.revision)+1, ruleVersion = 'life-humor-v1-k'+revision;
    const saved = requiredRow(await this.db.manager.query(`INSERT INTO collect.auto_publish_keyword_revision
      (revision,rule_version,keywords,updated_by) VALUES($1,$2,$3,$4) RETURNING *`,[revision,ruleVersion,JSON.stringify(items),actor]));
    await this.db.manager.query('UPDATE collect.auto_publish_keyword_head SET rule_version=$1 WHERE singleton',[ruleVersion]);
    return snapshot(saved);
  }
  async save(input: KeywordInput, version: string, actor: string, keywordId?: string) {
    const current = await this.locked(version);
    const items = [...keywords(current.keywords)];
    const index = keywordId ? items.findIndex(k => k.keywordId === keywordId) : -1;
    if (keywordId && index < 0) fail(404,'AUTO_PUBLISH_KEYWORD_NOT_FOUND');
    const updated = {...input,keywordId:keywordId ?? randomUUID()};
    if (index >= 0) items[index] = updated;
    else items.push(updated);
    return this.commit(current,items,actor);
  }
  async bulk(input: KeywordMutation, version: string, actor: string) {
    const current = await this.locked(version), items = keywords(current.keywords);
    const ids = input.action === 'SAVE' ? input.items.map(item=>item.keywordId) : input.keywordIds;
    if (!ids.length || ids.length>500 || new Set(ids).size !== ids.length) fail(400,'VALIDATION_FAILED');
    const existing = new Set(items.map(item=>item.keywordId));
    if (ids.some(id=>!existing.has(id))) fail(404,'AUTO_PUBLISH_KEYWORD_NOT_FOUND');
    const selected = new Set(ids);
    if (input.action === 'DELETE') return this.commit(current,items.filter(item=>!selected.has(item.keywordId)),actor);
    const updates = new Map(input.items.map(item=>[item.keywordId,item]));
    return this.commit(current,items.map(item=>updates.get(item.keywordId) ?? item),actor);
  }
}
