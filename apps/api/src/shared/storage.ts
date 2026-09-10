export type Bucket = 'private' | 'public';
export interface StoredObject {
  key: string;
  createdAt: Date;
}
export abstract class Storage {
  abstract put(bucket: Bucket, key: string, bytes: Buffer): Promise<void>;
  abstract get(bucket: Bucket, key: string): Promise<Buffer>;
  abstract promote(source: string, target: string): Promise<void>;
  abstract delete(bucket: Bucket, key: string): Promise<void>;
  abstract inventory(bucket: Bucket): Promise<StoredObject[]>;
}
export abstract class EdgeCache {
  abstract purge(urls: string[]): Promise<void>;
}
