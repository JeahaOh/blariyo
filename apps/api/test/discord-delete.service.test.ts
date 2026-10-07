import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RestDiscordDeleteClient } from '../dist/adapters/discord-delete.js';

await test('Discord cleanup REST stays in channel, checks thread parent, and interprets only known missing resources as deleted', async t => {
  const root = mkdtempSync(join(tmpdir(), 'blariyo-discord-delete-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tokenFile = join(root, 'token');
  const token = 'synthetic-fixture-token-'.repeat(3);
  writeFileSync(tokenFile, token, { mode: 0o600 });
  const channelId = '111111111111111111', guildId = '222222222222222222', threadId = '333333333333333333';
  const options = { tokenFile, channelId, guildId };
  const calls: { url: string; method: string | undefined }[] = [];
  let replies: Response[] = [];
  const client = new RestDiscordDeleteClient(options, async (url, init) => {
    assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).get('Authorization'), `Bot ${token}`);
    calls.push({ url, method: init.method });
    const response = replies.shift(); assert.ok(response); return response;
  });
  const signal = AbortSignal.timeout(10_000);
  replies = [new Response(null, { status: 204 })];
  await client.deleteHead(channelId, threadId, signal);
  assert.deepEqual(calls, [{ url: `https://discord.com/api/v10/channels/${channelId}/messages/${threadId}`, method: 'DELETE' }]);
  replies = [Response.json({ code: 10008 }, { status: 404 })];
  await client.deleteHead(channelId, threadId, signal);
  replies = [Response.json({ code: 50001 }, { status: 404 })];
  await assert.rejects(client.deleteHead(channelId, threadId, signal), /UNAVAILABLE/);
  replies = [Response.json({ retry_after: 600.5 }, { status: 429 })];
  await assert.rejects(client.deleteHead(channelId, threadId, signal), { safeCode: 'DISCORD_RATE_LIMITED', retryAfterMs: 600500 });
  for (const status of [401,403]) {
    replies = [Response.json({ message: 'must not surface token or provider body' }, { status })];
    await assert.rejects(client.deleteHead(channelId, threadId, signal), { blocked: true });
  }
  const previous = calls.length;
  await assert.rejects(client.deleteHead(guildId, threadId, signal), /SCOPE_INVALID/);
  await assert.rejects(client.deleteThread(channelId, '../other', signal), /SCOPE_INVALID/);
  assert.equal(calls.length, previous);
  replies = [Response.json({ id: threadId, guild_id: guildId, parent_id: '444444444444444444', type: 11 })];
  await assert.rejects(client.deleteThread(channelId, threadId, signal), /THREAD_SCOPE_INVALID/);
  assert.equal(calls.at(-1)?.method, 'GET', 'wrong parent is never deleted');
  replies = [Response.json({ id: threadId, guild_id: guildId, parent_id: channelId, type: 11 }), new Response(null, { status: 204 })];
  await client.deleteThread(channelId, threadId, signal);
  assert.equal(calls.at(-1)?.method, 'DELETE');
  replies = [Response.json({ code: 10003 }, { status: 404 })];
  await client.deleteThread(channelId, threadId, signal);
  assert.equal(calls.at(-1)?.method, 'GET');
  replies = [new Response('x'.repeat(17000), { status: 503 })];
  await assert.rejects(client.deleteHead(channelId, threadId, signal), /RESPONSE_INVALID/);
  chmodSync(tokenFile, 0o644);
  assert.throws(() => new RestDiscordDeleteClient(options), /TOKEN_FILE_INVALID/);
  chmodSync(tokenFile, 0o600);
  const link = join(root, 'link'); symlinkSync(tokenFile, link);
  assert.throws(() => new RestDiscordDeleteClient({ ...options, tokenFile: link }), /TOKEN_FILE_INVALID/);
});
