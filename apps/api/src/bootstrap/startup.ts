import { readFile } from 'node:fs/promises';
import type { CollectionOptions } from '../features/collection/collection-admin.guard.js';
import type { CollectorCredential } from '../http/collector.guard.js';
import type { Environment } from './config.js';
export function isCollectionEnabled(settings: CollectionOptions) {
  return Boolean(settings.collectManualUrlEnabled || settings.collectDiscordCommandEnabled);
}
export async function loadCollectorTokens(settings: CollectionOptions, env: Environment = process.env, reader: (path: string, encoding: 'utf8') => Promise<string> = readFile): Promise<CollectorCredential[]> {
  if (!isCollectionEnabled(settings) || !env.COLLECTOR_TOKENS_FILE) return [];
  const input: unknown = JSON.parse(await reader(env.COLLECTOR_TOKENS_FILE, 'utf8'));
  if (!Array.isArray(input)) throw new Error('COLLECTOR_TOKENS_INVALID');
  return input.map((value: unknown) => {
    if (typeof value !== 'object' || value === null || !('collectorId' in value) || typeof value.collectorId !== 'string' || !('tokenSha256' in value) || typeof value.tokenSha256 !== 'string') throw new Error('COLLECTOR_TOKENS_INVALID');
    const scopes: unknown = 'scopes' in value ? value.scopes : undefined;
    if (scopes !== undefined && (!Array.isArray(scopes) || !scopes.every((scope: unknown): scope is string => typeof scope === 'string'))) throw new Error('COLLECTOR_TOKENS_INVALID');
    const version: unknown = 'contractVersion' in value ? value.contractVersion : undefined;
    if (version !== undefined && typeof version !== 'string') throw new Error('COLLECTOR_TOKENS_INVALID');
    return { collectorId: value.collectorId, tokenSha256: value.tokenSha256, ...(scopes === undefined ? {} : { scopes }), ...(version === undefined ? {} : { contractVersion: version }) };
  });
}
