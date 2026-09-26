export interface PolicyVersion {
  title: string;
  bodyHtml: string;
  effectiveAt: Date | null;
}
export interface PolicyPublication {
  type: 'TERMS' | 'PRIVACY';
  version: string;
  title: string;
  bodyHtml: string;
  effectiveAt: Date;
}
export abstract class PoliciesRepository {
  abstract version(type: string, version: string): Promise<PolicyVersion | null>;
  abstract effective(type: string): Promise<PolicyVersion | null>;
  abstract retire(type: string, endedAt: Date): Promise<void>;
  abstract publish(policy: PolicyPublication): Promise<string>;
  abstract effectiveTypeCount(): Promise<number>;
}
