import { localStorage, localCache } from './storage.mjs';
import { r2Storage, cloudflareCache } from './remote-adapters.mjs';
import { assertLegalConfig } from './policies.mjs';
export function adapters(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (production) {
    assertLegalConfig(JSON.parse(env.LEGAL_CONFIG || '{}'));
    if (env.STORAGE_MODE !== 'r2') throw new Error('PRODUCTION_STORAGE_REQUIRED');
  }
  if (env.STORAGE_MODE === 'r2')
    return {
      storage: r2Storage({
        endpoint: env.R2_ENDPOINT,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        privateBucket: env.R2_PRIVATE_BUCKET,
        publicBucket: env.R2_PUBLIC_BUCKET,
      }),
      cache: cloudflareCache({ zoneId: env.CACHE_ZONE_ID, token: env.CACHE_PURGE_TOKEN }),
    };
  return {
    storage: localStorage(env.STORAGE_ROOT || '.local-data/media', { production }),
    cache: localCache({ production }),
  };
}
