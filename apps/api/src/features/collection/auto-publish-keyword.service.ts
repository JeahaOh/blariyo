import { Inject, Injectable } from '@nestjs/common';
import { AutoPublishKeywordRepository, type KeywordInput, type KeywordMutation } from './auto-publish-keyword.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail } from '../../shared/errors.js';
@Injectable()
export class AutoPublishKeywordService {
  constructor(@Inject(AutoPublishKeywordRepository) private readonly repository: AutoPublishKeywordRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork) {}
  list() { return this.repository.current(); }
  private normalize<T extends KeywordInput>(input: T): T {
    const keyword = input.keyword.normalize('NFKC').trim();
    if (!keyword.length || keyword.length > 80 || /[\p{Cc}\p{Cf}]/u.test(keyword)) fail(400,'VALIDATION_FAILED');
    return {...input,keyword};
  }
  save(input: KeywordInput, version: string, actor: string, keywordId?: string) {
    const normalized = this.normalize(input);
    return this.work.transaction(() => this.repository.save(normalized,version,actor,keywordId));
  }
  bulk(input: KeywordMutation, version: string, actor: string) {
    const ids = input.action === 'SAVE' ? input.items.map(item=>item.keywordId) : input.keywordIds;
    if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) fail(400,'VALIDATION_FAILED');
    const normalized: KeywordMutation = input.action === 'SAVE' ? {action:'SAVE',items:input.items.map(item=>this.normalize(item))} : input;
    return this.work.transaction(() => this.repository.bulk(normalized,version,actor));
  }
}
