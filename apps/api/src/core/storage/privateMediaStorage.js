const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');

class S3PrivateMediaStorage {
  constructor({ endpoint, accessKeyId, secretAccessKey, bucket }) {
    this.bucket = bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key, body, contentType) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  async get(key) {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    if (!response.Body) throw new Error('Private media object body is missing');
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

class S3PublicMediaStorage {
  constructor({ endpoint, accessKeyId, secretAccessKey, bucket }) {
    this.bucket = bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key, body, contentType) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  }

  async delete(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

class UnavailablePrivateMediaStorage {
  async put() {
    throw new Error('Private media storage is not configured');
  }

  async get() {
    throw new Error('Private media storage is not configured');
  }

  async delete() {
    throw new Error('Private media storage is not configured');
  }
}

function createPrivateMediaStorageFromEnv(env = process.env) {
  const config = {
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_PRIVATE_MEDIA_BUCKET,
  };
  if (Object.values(config).every((value) => typeof value === 'string' && value.length > 0)) {
    return new S3PrivateMediaStorage(config);
  }
  return new UnavailablePrivateMediaStorage();
}

function createPublicMediaStorageFromEnv(env = process.env) {
  const config = {
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_PUBLIC_ACCESS_KEY_ID,
    secretAccessKey: env.R2_PUBLIC_SECRET_ACCESS_KEY,
    bucket: env.R2_PUBLIC_MEDIA_BUCKET,
  };
  if (Object.values(config).every((value) => typeof value === 'string' && value.length > 0)) {
    return new S3PublicMediaStorage(config);
  }
  return new UnavailablePrivateMediaStorage();
}

module.exports = {
  S3PrivateMediaStorage,
  S3PublicMediaStorage,
  UnavailablePrivateMediaStorage,
  createPrivateMediaStorageFromEnv,
  createPublicMediaStorageFromEnv,
};
