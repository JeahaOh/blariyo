import { readFile } from 'node:fs/promises';
import { privateJson } from './drive-store.mjs';

const name = /^[A-Z0-9_-]{1,80}$/;
const uuid = /^[a-f0-9-]{36}$/;
const delays = [60000, 300000, 1800000, 3600000];

/** Persistent notification state is independent of backup receipts and never triggers a new dump. */
export class Incidents {
  constructor({ path, webhook, fetcher = fetch, now = Date.now }) {
    if (webhook) {
      const url = new URL(webhook);
      if (url.origin !== 'https://discord.com' || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash)
        throw Error('ALERT_WEBHOOK_INVALID');
    }
    this.path = path; this.webhook = webhook; this.fetcher = fetcher; this.now = now;
  }
  async load() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { incidents: {}, pending: [] }; throw Error('ALERT_STATE_INVALID'); }
  }
  async observe({ job, stage, errorCode, backupId, lastSuccessAt }) {
    if (![job, stage].every(v => name.test(v)) || (errorCode && !name.test(errorCode)) || (backupId && !uuid.test(backupId)) ||
        (lastSuccessAt && !Number.isFinite(Date.parse(lastSuccessAt)))) throw Error('ALERT_FIELDS_INVALID');
    const state = await this.load(), now = this.now(), prefix = job + ':' + stage + ':';
    for (const [key, incident] of Object.entries(state.incidents)) {
      if (!key.startsWith(prefix) || !incident.active || key === prefix + errorCode) continue;
      incident.active = false;
      // A recovery supersedes delayed failure notices for the same incident.
      state.pending = state.pending.filter(p => p.key !== key);
      state.pending.push({ key, type: 'RECOVERED', job, stage, errorCode: incident.errorCode, backupId, lastSuccessAt, attempt: 0, nextAt: now });
    }
    if (errorCode) {
      const key = prefix + errorCode, existing = state.incidents[key];
      if (!existing?.active || now - existing.notifiedAt >= 6 * 3600000) {
        state.incidents[key] = { active: true, errorCode, notifiedAt: now };
        if (!state.pending.some(p => p.key === key)) state.pending.push({ key, type: 'FAILED', job, stage, errorCode,
          backupId, lastSuccessAt, attempt: 0, nextAt: now });
      }
    }
    await privateJson(this.path, state); return this.flush();
  }
  async flush() {
    const state = await this.load(), now = this.now(); let sent = 0;
    for (const pending of [...state.pending]) {
      if (pending.nextAt > now) continue;
      let success = false;
      if (this.webhook) {
        try {
          const message = { state: pending.type, job: pending.job, stage: pending.stage, errorCode: pending.errorCode,
            backupId: pending.backupId, lastSuccessAt: pending.lastSuccessAt,
            ageHours: pending.lastSuccessAt ? Math.floor((now - Date.parse(pending.lastSuccessAt)) / 3600000) : null,
            notificationAttempt: pending.attempt + 1 };
          const response = await this.fetcher(this.webhook + '?wait=true', { method: 'POST', redirect: 'error',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: JSON.stringify(message), allowed_mentions: { parse: [] } }),
            signal: AbortSignal.timeout(15000) });
          success = response.ok && typeof (await response.json()).id === 'string';
        } catch { /* Secret URL and provider response must never be logged. */ }
      }
      if (success) { state.pending = state.pending.filter(p => p !== pending); sent++; }
      else {
        pending.lastError = this.webhook ? 'ALERT_DELIVERY_FAILED' : 'ALERT_NOT_CONFIGURED';
        pending.nextAt = now + delays[Math.min(pending.attempt, delays.length - 1)]; pending.attempt++;
      }
    }
    await privateJson(this.path, state); return { sent, pending: state.pending.length };
  }
}
