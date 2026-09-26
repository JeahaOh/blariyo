import { localStorage, localCache } from '../adapters/storage.js';
import { r2Storage, cloudflareCache } from '../adapters/remote-adapters.js';
import { assertLegalConfig } from '../features/policies/policy-artifact.js';
import type { R2Config } from '../adapters/remote-adapters.js';
export type Environment = Readonly<Record<string, string | undefined>>;
export function adapters(env: Environment = process.env) {
  const production = env.NODE_ENV === 'production';
  if (production) {
    const legalConfig: unknown = JSON.parse(env.LEGAL_CONFIG || '{}');
    assertLegalConfig(legalConfig);
    if (env.STORAGE_MODE !== 'r2') throw new Error('PRODUCTION_STORAGE_REQUIRED');
  }
  if (env.STORAGE_MODE === 'r2') {
    const required = (name: string, error: string) => {
      const value = env[name];
      if (!value) throw new Error(error);
      return value;
    };
    const config: R2Config = {
      endpoint: required('R2_ENDPOINT', 'R2_CONFIG_REQUIRED'),
      privateCredentials: {
        accessKeyId: required('R2_PRIVATE_ACCESS_KEY_ID', 'R2_CONFIG_REQUIRED'),
        secretAccessKey: required('R2_PRIVATE_SECRET_ACCESS_KEY', 'R2_CONFIG_REQUIRED'),
      },
      publicCredentials: {
        accessKeyId: required('R2_PUBLIC_ACCESS_KEY_ID', 'R2_CONFIG_REQUIRED'),
        secretAccessKey: required('R2_PUBLIC_SECRET_ACCESS_KEY', 'R2_CONFIG_REQUIRED'),
      },
      privateBucket: required('R2_PRIVATE_BUCKET', 'R2_CONFIG_REQUIRED'),
      publicBucket: required('R2_PUBLIC_BUCKET', 'R2_CONFIG_REQUIRED'),
    };
    return {
      storage: r2Storage(config),
      cache: cloudflareCache({
        zoneId: required('CACHE_ZONE_ID', 'CACHE_CONFIG_REQUIRED'),
        token: required('CACHE_PURGE_TOKEN', 'CACHE_CONFIG_REQUIRED'),
      }),
    };
  }
  return {
    storage: localStorage(env.STORAGE_ROOT || '.local-data/media', { production }),
    cache: localCache({ production }),
  };
}
