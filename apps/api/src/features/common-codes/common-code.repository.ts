export interface CommonCodeGroup {
  groupKey: string;
  displayName: string;
  lockVersion: number;
  updatedAt: string;
}
export interface CommonCode extends CommonCodeGroup {
  code: string;
  referenceKey: string | null;
}
export abstract class CommonCodeRepository {
  abstract groups(): Promise<CommonCodeGroup[]>;
  abstract group(key: string): Promise<CommonCodeGroup | null>;
  abstract createGroup(key: string, name: string, actor: string): Promise<CommonCodeGroup | null>;
  abstract updateGroup(key: string, name: string, version: number, actor: string): Promise<CommonCodeGroup | null>;
  abstract list(group: string): Promise<CommonCode[]>;
  abstract find(group: string, code: string): Promise<CommonCode | null>;
  abstract findReference(group: string, reference: string): Promise<CommonCode | null>;
  abstract create(group: string, code: string, name: string, reference: string | null, actor: string): Promise<CommonCode | null>;
  abstract update(group: string, code: string, name: string, version: number, actor: string): Promise<CommonCode | null>;
}
