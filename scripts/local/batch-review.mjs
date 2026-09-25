// Fixed local BFF entry point. Uses the private session file without printing its cookie.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const origin = 'http://localhost:3000';
const [command, id, ...args] = process.argv.slice(2);
const options = Object.fromEntries(
  args.map((v) => {
    const i = v.indexOf('=');
    if (!v.startsWith('--') || i < 3) throw Error('EXPECTED_NAME_EQUALS_VALUE');
    return [v.slice(2, i), v.slice(i + 1)];
  })
);
if (!['list', 'detail', 'review', 'draft', 'publish', 'hide', 'republish'].includes(command))
  throw Error('EXPECTED_LIST_DETAIL_REVIEW_DRAFT_PUBLISH_HIDE_REPUBLISH');
const session = JSON.parse(await readFile('.local-data/development/session.json', 'utf8'));
if (session.origin !== origin || typeof session.adminToken !== 'string')
  throw Error('LOCAL_SESSION_MISMATCH');
const base = '/api/v1/admin/collect/batch-items';
let path =
    command === 'list' ? base + (id ? '?source=' + encodeURIComponent(id) : '') : base + '/' + id,
  body;
if (['detail', 'review', 'draft'].includes(command) && !/^[0-9a-f-]{36}$/.test(id || ''))
  throw Error('EXPECTED_ITEM_UUID');
if (['review', 'draft'].includes(command)) {
  body = {
    itemVersion: Number(options['item-version']),
    lockVersion: Number(options['lock-version']),
  };
  if (!Number.isSafeInteger(body.itemVersion) || !Number.isSafeInteger(body.lockVersion))
    throw Error('EXPECTED_EXPLICIT_VERSIONS');
  if (command === 'review') {
    body.decision = options.decision;
    path += '/review';
  } else {
    body.boardSlug = options.board || 'meme';
    if (options.title) body.title = options.title;
    path += '/draft';
  }
}
if (['publish', 'hide', 'republish'].includes(command)) {
  if (!/^[1-9][0-9]*$/.test(id || '') || !Number.isSafeInteger(Number(options['lock-version'])))
    throw Error('EXPECTED_POST_ID_AND_VERSION');
  path = `/api/v1/admin/posts/${id}/${command}`;
  body = {
    lockVersion: Number(options['lock-version']),
    ...(command === 'publish'
      ? { mode: 'IMMEDIATE' }
      : command === 'hide'
        ? { reasonCode: 'EDIT' }
        : { pinnedPosition: null }),
  };
}
const response = await fetch(origin + path, {
  method: body ? 'POST' : 'GET',
  headers: {
    Cookie: `BLARIYO_ADMIN_SESSION=${session.adminToken}`,
    Origin: origin,
    'Content-Type': 'application/json',
    'Idempotency-Key': options.key || randomUUID(),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const result = await response.json();
console.log(JSON.stringify({ status: response.status, ...result }, null, 2));
if (!response.ok) process.exitCode = 1;
