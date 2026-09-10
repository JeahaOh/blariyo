import type { CollectionOptions } from '../features/collection/collection-admin.guard.js';
import type { Environment } from './config.js';
export function collectionSettings(env: Environment = process.env): CollectionOptions {
  const mode = env.COLLECT_CONTRACT_MODE || 'LEGACY_V1';
  if (mode !== 'LEGACY_V1' && mode !== 'SPRING_V2') throw new Error('COLLECT_CONTRACT_MODE_INVALID');
  return {
    collectContractMode: mode,
    ...(env.COLLECTOR_KEY_SECRET === undefined ? {} : { collectorKeySecret: env.COLLECTOR_KEY_SECRET }),
    collectManualUrlEnabled: env.COLLECT_MANUAL_URL_ENABLED === 'true',
    collectDiscordCommandEnabled: env.COLLECT_DISCORD_COMMAND_ENABLED === 'true',
  };
}
