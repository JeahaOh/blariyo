import type { Storage, Bucket, EdgeCache, StoredObject } from '../shared/storage.js';
interface R2Credentials { accessKeyId: string; secretAccessKey: string }
export interface R2Config {
  endpoint: string;
  privateCredentials: R2Credentials;
  publicCredentials: R2Credentials;
  privateBucket: string;
  publicBucket: string;
}
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
export function r2Storage(config: R2Config): Storage {
  for (const key of ['endpoint', 'privateBucket', 'publicBucket'] as const)
    if (!config[key]) throw new Error('R2_CONFIG_REQUIRED');
  for (const credentials of [config.privateCredentials, config.publicCredentials])
    if (!credentials?.accessKeyId || !credentials.secretAccessKey) throw new Error('R2_CONFIG_REQUIRED');
  if (config.privateBucket === config.publicBucket) throw new Error('R2_BUCKETS_MUST_DIFFER');
  if (config.privateCredentials.accessKeyId === config.publicCredentials.accessKeyId)
    throw new Error('R2_CREDENTIALS_MUST_DIFFER');
  const createClient = (credentials: R2Credentials) => new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials,
    forcePathStyle: true,
    maxAttempts: 1,
  });
  const clients = {
    private: createClient(config.privateCredentials),
    public: createClient(config.publicCredentials),
  };
  const bucket = (kind: Bucket) => {
    if (!['private', 'public'].includes(kind)) throw new Error('Invalid bucket');
    return kind === 'private' ? config.privateBucket : config.publicBucket;
  };
  return {
    async put(kind, key, bytes) {
      const mime = new Map([['jpg','image/jpeg'], ['png','image/png'], ['gif','image/gif'], ['webp','image/webp']]).get(key.split('.').at(-1) ?? '');
      const name = bucket(kind);
      await clients[kind].send(new PutObjectCommand({ Bucket: name, Key: key, Body: bytes, ...(mime ? { ContentType: mime } : {}) }));
    },
    async get(kind, key) {
      const name = bucket(kind);
      const response = await clients[kind].send(new GetObjectCommand({ Bucket: name, Key: key }));
      if (!response.Body) throw new Error('STORAGE_BODY_REQUIRED');
      return Buffer.from(await response.Body.transformToByteArray());
    },
    async promote(source, target) {
      // Each credential remains scoped to one bucket; never widen it for CopyObject.
      const response = await clients.private.send(new GetObjectCommand({ Bucket: bucket('private'), Key: source }));
      if (!response.Body) throw new Error('STORAGE_BODY_REQUIRED');
      const bytes = await response.Body.transformToByteArray();
      await clients.public.send(
        new PutObjectCommand({
          Bucket: bucket('public'),
          Key: target,
          Body: bytes,
          ContentType: response.ContentType,
          CacheControl: response.CacheControl,
          ContentDisposition: response.ContentDisposition,
          ContentEncoding: response.ContentEncoding,
          ContentLanguage: response.ContentLanguage,
          Expires: response.Expires,
          Metadata: response.Metadata,
        })
      );
    },
    async delete(kind, key) {
      const name = bucket(kind);
      await clients[kind].send(new DeleteObjectCommand({ Bucket: name, Key: key }));
    },
    async inventory(kind) {
      const name = bucket(kind);
      const items: StoredObject[] = [];
      let token: string | undefined;
      do {
        const response = await clients[kind].send(
          new ListObjectsV2Command({ Bucket: name, ...(token ? { ContinuationToken: token } : {}) })
        );
        items.push(
          ...(response.Contents || []).map((o) => { if (!o.Key || !o.LastModified || !Number.isFinite(o.LastModified.getTime())) throw new Error('INVALID_STORAGE_INVENTORY'); return { key: o.Key, createdAt: o.LastModified }; })
        );
        token = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (token);
      return items;
    },
  };
}
export function cloudflareCache({ zoneId, token }: { zoneId: string; token: string }): EdgeCache {
  if (!zoneId || !token) throw new Error('CACHE_CONFIG_REQUIRED');
  return {
    async purge(urls) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: urls }),
          signal: AbortSignal.timeout(10000),
        }
      );
      const body: unknown = await response.json();
      if (!response.ok || typeof body !== 'object' || body === null || !('success' in body) || !body.success) throw new Error('CACHE_PURGE_FAILED');
    },
  };
}
