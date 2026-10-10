export const keywordGroups = ['LIFE','HUMOR','REACTION','POLITICS_OR_CONFLICT','NEWS_OR_ENTERTAINMENT','HEALTH_OR_FINANCE','PROMOTION_OR_POINTS','ADULT_OR_HARM'] as const;
export type KeywordGroup = typeof keywordGroups[number];
export interface AutoPublishKeyword {
  keywordId: string;
  keyword: string;
  group: KeywordGroup;
  scope: 'TITLE' | 'BODY' | 'BOTH';
  matchMode: 'CONTAINS' | 'WORD';
  enabled: boolean;
}
export type KeywordInput = Omit<AutoPublishKeyword,'keywordId'>;
export type KeywordMutation = {action:'SAVE';items:AutoPublishKeyword[]} | {action:'DELETE';keywordIds:string[]};
export interface AutoPublishRules {
  ruleVersion: string;
  items: AutoPublishKeyword[];
  updatedAt: string;
}
export abstract class AutoPublishKeywordRepository {
  abstract current(): Promise<AutoPublishRules>;
  abstract save(input: KeywordInput, version: string, actor: string, keywordId?: string): Promise<AutoPublishRules>;
  abstract bulk(input: KeywordMutation, version: string, actor: string): Promise<AutoPublishRules>;
}
