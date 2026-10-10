import { draftTitle } from '@blariyo/contracts/draft-title';
import type { CollectionContentBlock } from './collection.model.js';

import { keywordGroups, type AutoPublishRules } from './auto-publish-keyword.repository.js';
export interface AutoPublishClassification {
  ruleVersion: string;
  decision: 'ELIGIBLE' | 'REVIEW';
  category: 'LIFE' | 'HUMOR' | null;
  reason: string;
}
export interface AutoPublishInput {
  title: string | null;
  sourceKey: string;
  bodyBlocks: CollectionContentBlock[];
  snsLinks: string[];
  media: { kind: string }[];
}
function matches(value: string, keyword: string, mode: 'CONTAINS' | 'WORD'): boolean {
  const text = value.normalize('NFKC').toLocaleLowerCase('en-US');
  const needle = keyword.normalize('NFKC').toLocaleLowerCase('en-US');
  if (mode === 'CONTAINS') return text.includes(needle);
  let position = text.indexOf(needle);
  while (position >= 0) {
    const before = Array.from(text.slice(0,position)).at(-1) ?? '';
    const after = Array.from(text.slice(position+needle.length))[0] ?? '';
    if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) return true;
    position = text.indexOf(needle,position+1);
  }
  return false;
}

/** Conservative text rules, not image/OCR interpretation or learned operator preferences. */
export function classifyAutoPublish(input: AutoPublishInput, rules: AutoPublishRules): AutoPublishClassification {
  const result = (reason: string, category: AutoPublishClassification['category'] = null): AutoPublishClassification =>
    ({ ruleVersion: rules.ruleVersion, decision: category ? 'ELIGIBLE' : 'REVIEW', category, reason });
  const title = draftTitle(input.title ?? '', input.sourceKey).normalize('NFKC');
  if (title.replace(/\s/g, '').length < 8 || !input.bodyBlocks.length) return result('INSUFFICIENT_CONTENT');
  if (input.bodyBlocks.length > 100 || input.media.length > 20) return result('CONTENT_TOO_LARGE');
  if (input.media.some(m => m.kind !== 'IMAGE')) return result('UNSUPPORTED_ATTACHMENT');
  if (input.snsLinks.length || input.bodyBlocks.some(b => b.type === 'LINK')) return result('EXTERNAL_CONTENT');
  const text = input.bodyBlocks.flatMap(b => b.type === 'TEXT' ? [b.text] : []).join('\n').normalize('NFKC');
  if (text.length > 6000) return result('CONTENT_TOO_LARGE');
  const combined = title + '\n' + text;
  if (/https?:\/\/|www\./iu.test(combined)) return result('EXTERNAL_CONTENT');
  const has = (group: string) => rules.items.some(k => k.enabled && k.group === group &&
    matches(k.scope === 'TITLE' ? title : k.scope === 'BODY' ? text : combined,k.keyword,k.matchMode));
  for (const group of keywordGroups.slice(3)) if (has(group)) return result(group);
  // An image must be present in the collected body. Its bytes are still validated by the common publisher.
  if (!input.bodyBlocks.some(b => b.type === 'IMAGE') && text.replace(/\s/g, '').length < 40) return result('INSUFFICIENT_CONTENT');
  if (!has('REACTION')) return result('UNCERTAIN_TOPIC');
  if (has('LIFE')) return result('LIFE_MATCH', 'LIFE');
  if (has('HUMOR')) return result('HUMOR_MATCH', 'HUMOR');
  return result('UNCERTAIN_TOPIC');
}
