import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
export function r2Storage(config) {
  for (const key of ['endpoint', 'accessKeyId', 'secretAccessKey', 'privateBucket', 'publicBucket'])
    if (!config[key]) throw new Error('R2_CONFIG_REQUIRED');
  if (config.privateBucket === config.publicBucket) throw new Error('R2_BUCKETS_MUST_DIFFER');
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    maxAttempts: 1,
  });
  const bucket = (kind) => {
    if (!['private', 'public'].includes(kind)) throw new Error('Invalid bucket');
    return kind === 'private' ? config.privateBucket : config.publicBucket;
  };
  return {
    put: (kind, key, bytes) =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket(kind),
          Key: key,
          Body: bytes,
          ContentType: {
            jpg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
          }[key.split('.').at(-1)],
        })
      ),
    async get(kind, key) {
      return Buffer.from(
        await (
          await client.send(new GetObjectCommand({ Bucket: bucket(kind), Key: key }))
        ).Body.transformToByteArray()
      );
    },
    promote: (source, target) =>
      client.send(
        new CopyObjectCommand({
          Bucket: bucket('public'),
          Key: target,
          CopySource: bucket('private') + '/' + source.split('/').map(encodeURIComponent).join('/'),
        })
      ),
    delete: (kind, key) => client.send(new DeleteObjectCommand({ Bucket: bucket(kind), Key: key })),
    async inventory(kind) {
      const items = [];
      let token;
      do {
        const response = await client.send(
          new ListObjectsV2Command({ Bucket: bucket(kind), ContinuationToken: token })
        );
        items.push(
          ...(response.Contents || []).map((o) => ({ key: o.Key, createdAt: o.LastModified }))
        );
        token = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (token);
      return items;
    },
  };
}
export function cloudflareCache({ zoneId, token }) {
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
      if (!response.ok || !(await response.json()).success) throw new Error('CACHE_PURGE_FAILED');
    },
  };
}
