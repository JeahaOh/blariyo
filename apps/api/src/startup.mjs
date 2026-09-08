import { readFile } from 'node:fs/promises';

export function isCollectionEnabled(settings) {
  return Boolean(settings.collectManualUrlEnabled || settings.collectDiscordCommandEnabled);
}

export async function loadCollectorTokens(settings, env = process.env, reader = readFile) {
  if (!isCollectionEnabled(settings) || !env.COLLECTOR_TOKENS_FILE) return [];
  return JSON.parse(await reader(env.COLLECTOR_TOKENS_FILE, 'utf8'));
}
