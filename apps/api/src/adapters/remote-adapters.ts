import type { Storage, Bucket, EdgeCache, StoredObject } from '../shared/storage.js';
export interface R2Config { endpoint: string; accessKeyId: string; secretAccessKey: string; privateBucket: string; publicBucket: string }
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
export function r2Storage(config: R2Config): Storage {
  for (const key of ['endpoint', 'accessKeyId', 'secretAccessKey', 'privateBucket', 'publicBucket'] as const)
    if (!config[key]) throw new Error('R2_CONFIG_REQUIRED');
  if (config.privateBucket === config.publicBucket) throw new Error('R2_BUCKETS_MUST_DIFFER');
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    maxAttempts: 1,
  });
  const bucket = (kind: Bucket) => {
    if (!['private', 'public'].includes(kind)) throw new Error('Invalid bucket');
    return kind === 'private' ? config.privateBucket : config.publicBucket;
  };
  return {
    async put(kind, key, bytes) {
      const mime = new Map([['jpg','image/jpeg'], ['png','image/png'], ['gif','image/gif'], ['webp','image/webp']]).get(key.split('.').at(-1) ?? '');
      await client.send(new PutObjectCommand({ Bucket: bucket(kind), Key: key, Body: bytes, ...(mime ? { ContentType: mime } : {}) }));
    },
    async get(kind, key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket(kind), Key: key }));
      if (!response.Body) throw new Error('STORAGE_BODY_REQUIRED');
      return Buffer.from(await response.Body.transformToByteArray());
    },
    async promote(source, target) {
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket('public'),
          Key: target,
          CopySource: bucket('private') + '/' + source.split('/').map(encodeURIComponent).join('/'),
        })
      );
    },
    async delete(kind, key) { await client.send(new DeleteObjectCommand({ Bucket: bucket(kind), Key: key })); },
    async inventory(kind) {
      const items: StoredObject[] = [];
      let token: string | undefined;
      do {
        const response = await client.send(
          new ListObjectsV2Command({ Bucket: bucket(kind), ...(token ? { ContinuationToken: token } : {}) })
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
