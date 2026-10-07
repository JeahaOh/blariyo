import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { DiscordDeleteClient, DiscordTransportError } from '../features/collection/discord-cleanup.js';

type DiscordFetch = (url: string, init: RequestInit) => Promise<Response>;
export interface DiscordDeleteOptions {
  tokenFile: string;
  channelId: string;
  guildId: string;
}
function tokenFromFile(path: string): string {
  let fd: number | undefined;
  try {
    if (!isAbsolute(path)) throw new Error();
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 512 || (stat.mode & 0o177) !== 0) throw new Error();
    const token = readFileSync(fd, 'utf8').replace(/\r?\n$/, '');
    if (!/^[A-Za-z0-9_.-]{40,200}$/.test(token)) throw new Error();
    return token;
  } catch { throw new Error('DISCORD_TOKEN_FILE_INVALID'); }
  finally { if (fd !== undefined) closeSync(fd); }
}
const snowflake = /^[0-9]{17,20}$/;
async function json(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16_384) throw new DiscordTransportError('DISCORD_RESPONSE_INVALID');
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return Object.fromEntries(Object.entries(parsed));
  } catch { throw new DiscordTransportError('DISCORD_RESPONSE_INVALID'); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Fixed Discord origin, private file credential and configured-channel scope only. */
export class RestDiscordDeleteClient extends DiscordDeleteClient {
  private readonly token: string;
  constructor(private readonly options: DiscordDeleteOptions, private readonly request: DiscordFetch = fetch) {
    super();
    if (!snowflake.test(options.channelId) || !snowflake.test(options.guildId)) throw new Error('DISCORD_SCOPE_INVALID');
    this.token = tokenFromFile(options.tokenFile);
  }
  private scope(channelId: string, resourceId: string) {
    if (channelId !== this.options.channelId || !snowflake.test(resourceId))
      throw new DiscordTransportError('DISCORD_SCOPE_INVALID', true);
  }
  private async call(path: string, method: 'GET' | 'DELETE', signal: AbortSignal, missingCode: number) {
    let response: Response;
    try {
      response = await this.request(`https://discord.com/api/v10${path}`, {
        method, signal, redirect: 'error', headers: { Authorization: `Bot ${this.token}` },
      });
    } catch { throw new DiscordTransportError(signal.aborted ? 'DISCORD_TIMEOUT' : 'DISCORD_UNAVAILABLE'); }
    if (response.status === 204 && method === 'DELETE') return null;
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      throw new DiscordTransportError(response.status === 401 ? 'DISCORD_UNAUTHORIZED' : 'DISCORD_FORBIDDEN', true);
    }
    const body = await json(response);
    if (response.status === 404 && body.code === missingCode) return null;
    if (response.status === 429) {
      const seconds = typeof body.retry_after === 'number' ? body.retry_after : Number(response.headers.get('retry-after'));
      throw new DiscordTransportError('DISCORD_RATE_LIMITED', false,
        Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 60_000);
    }
    if (response.status !== 200 || method !== 'GET') throw new DiscordTransportError('DISCORD_UNAVAILABLE');
    return body;
  }
  async deleteHead(channelId: string, messageId: string, signal: AbortSignal) {
    this.scope(channelId, messageId);
    await this.call(`/channels/${channelId}/messages/${messageId}`, 'DELETE', signal, 10008);
  }
  async deleteThread(channelId: string, threadId: string, signal: AbortSignal) {
    this.scope(channelId, threadId);
    const thread = await this.call(`/channels/${threadId}`, 'GET', signal, 10003);
    if (!thread) return;
    if (thread.id !== threadId || thread.parent_id !== channelId || thread.guild_id !== this.options.guildId || thread.type !== 11)
      throw new DiscordTransportError('DISCORD_THREAD_SCOPE_INVALID', true);
    await this.call(`/channels/${threadId}`, 'DELETE', signal, 10003);
  }
}
