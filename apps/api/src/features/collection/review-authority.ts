import { Inject, Injectable } from '@nestjs/common';
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createHmac } from 'node:crypto';
import { fail } from '../../shared/errors.js';
import type { ReviewCommandRecord } from './review-command.repository.js';

export const DISCORD_REVIEW_SETTINGS = Symbol('DISCORD_REVIEW_SETTINGS');
export interface DiscordReviewSettings {
  environment: 'local_test' | 'production';
  guildId: string;
  channelId: string;
  exportSince: string;
  botTokenFile: string;
  workerTokenFile: string;
  reviewersFile: string;
  adminOperatorsFile: string;
  actorSecretFile: string;
}
export function privateReviewFile(path: string): string {
  let fd: number | undefined;
  try {
    if (!isAbsolute(path)) throw new Error();
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 65536 || (stat.mode & 0o177) !== 0) throw new Error();
    return readFileSync(fd,'utf8');
  } catch { throw new Error('DISCORD_PRIVATE_FILE_INVALID'); }
  finally { if (fd !== undefined) closeSync(fd); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('DISCORD_REGISTRY_INVALID');
  return Object.fromEntries(Object.entries(value));
}
function list(path: string): Record<string, unknown>[] {
  try {
    const data: unknown = JSON.parse(privateReviewFile(path));
    if (!Array.isArray(data)) throw new Error();
    return data.map(object);
  } catch { throw new Error('DISCORD_REGISTRY_INVALID'); }
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) throw new Error('DISCORD_REGISTRY_INVALID');
  return value;
}
export function discordReviewSettings(env: Readonly<Record<string,string|undefined>>): DiscordReviewSettings | undefined {
  if (env.DISCORD_REVIEW_ENABLED !== 'true') return undefined;
  try {
    const value = object(JSON.parse(privateReviewFile(env.DISCORD_REVIEW_CONFIG_FILE ?? '')));
    const environment = value.environment;
    if (environment !== (env.NODE_ENV === 'production' ? 'production' : 'local_test')) throw new Error();
    if (environment !== 'production' && environment !== 'local_test') throw new Error();
    const guildId = string(value.guildId), channelId = string(value.channelId), exportSince = string(value.exportSince);
    if (!/^[0-9]{17,20}$/.test(guildId) || !/^[0-9]{17,20}$/.test(channelId) || !Number.isFinite(Date.parse(exportSince))) throw new Error();
    const paths = Object.fromEntries(['botTokenFile','workerTokenFile','reviewersFile','adminOperatorsFile','actorSecretFile']
      .map(key => { const path = string(value[key]); if (!isAbsolute(path)) throw new Error(); return [key,path]; }));
    return { environment,guildId,channelId,exportSince,botTokenFile: string(paths.botTokenFile),
      workerTokenFile: string(paths.workerTokenFile),reviewersFile: string(paths.reviewersFile),
      adminOperatorsFile: string(paths.adminOperatorsFile),actorSecretFile: string(paths.actorSecretFile) };
  } catch { throw new Error('DISCORD_REVIEW_CONFIG_INVALID'); }
}
export interface ReviewOperator { operatorId: string; actor: string; role: 'OWNER' | 'EDITOR' }
@Injectable()
export class ReviewAuthority {
  constructor(@Inject(DISCORD_REVIEW_SETTINGS) private readonly settings: DiscordReviewSettings) {}
  private operators(): Map<string,ReviewOperator> {
    const secret = privateReviewFile(this.settings.actorSecretFile).replace(/\r?\n$/, '');
    if (Buffer.byteLength(secret) < 32) throw new Error('DISCORD_ACTOR_SECRET_INVALID');
    const result = new Map<string,ReviewOperator>(), identities = new Set<string>(), ids = new Set<string>();
    for (const row of list(this.settings.adminOperatorsFile)) {
      const operatorId = string(row.operatorId), identity = string(row.identity), role = row.role;
      if (ids.has(operatorId) || identities.has(identity) || typeof row.active !== 'boolean' || (role !== 'OWNER' && role !== 'EDITOR'))
        throw new Error('DISCORD_REGISTRY_INVALID');
      ids.add(operatorId); identities.add(identity);
      if (row.active) result.set(operatorId,{ operatorId, role, actor: `admin:v1:${createHmac('sha256',secret).update(operatorId).digest('base64url')}` });
    }
    return result;
  }
  reviewers(): Map<string,ReviewOperator> {
    const operators = this.operators(), result = new Map<string,ReviewOperator>(), seen = new Set<string>();
    for (const row of list(this.settings.reviewersFile)) {
      const id = string(row.discordUserId), operatorId = string(row.operatorId);
      if (!/^[0-9]{17,20}$/.test(id) || seen.has(id)) throw new Error('DISCORD_REGISTRY_INVALID');
      seen.add(id);
      const operator = operators.get(operatorId);
      if (operator) result.set(id,operator);
    }
    return result;
  }
  admin(actor: string): ReviewOperator {
    const operator = [...this.operators().values()].find(value => value.actor === actor);
    if (!operator) fail(403,'ADMIN_FORBIDDEN');
    return operator;
  }
  assertCommand(command: ReviewCommandRecord): void {
    if (command.origin === 'SYSTEM' && command.action === 'REJECT' && command.actor === 'system:discord-review-expiry') return;
    const operator = this.admin(command.actor);
    if (operator.operatorId !== command.operatorId) fail(403,'ADMIN_FORBIDDEN');
    if (command.origin === 'DISCORD') {
      const reviewers = this.reviewers();
      const bindings = command.requestBody.reviewerBindings;
      if (bindings !== undefined) {
        for (const [id,operatorId] of Object.entries(object(bindings)))
          if (typeof operatorId !== 'string' || reviewers.get(id)?.operatorId !== operatorId) fail(403,'ADMIN_FORBIDDEN');
      }
      if (!command.reviewerIds.some(id => reviewers.get(id)?.actor === command.actor)) fail(403,'ADMIN_FORBIDDEN');
    }
  }
}
