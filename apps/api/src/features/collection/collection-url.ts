import { createHash } from 'node:crypto';
import { canonical } from '../../shared/canonical.js';
import { fail } from '../../shared/errors.js';
export function collectionDigest(value: unknown): Buffer {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(canonical(value)))
    .digest();
}
export function normalizeCollectionUrl(value: unknown): string {
  try {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid URL');
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes('.')
    )
      throw new Error('Invalid URL');
    url.hash = '';
    for (const key of [...url.searchParams.keys()])
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    fail(400, 'VALIDATION_FAILED');
  }
}

/** Source post identity is computed by the server, never trusted from a collector payload. */
export function collectionPostKey(value: string): string | null {
  const u = new URL(value);
  const path = u.pathname;
  if (u.hostname === 'arca.live') return /^\/b\/[A-Za-z0-9_]+\/([0-9]+)$/.exec(path)?.[1] ?? null;
  if (u.hostname === 'www.dogdrip.net') return /^\/(?:dogdrip\/)?([0-9]+)$/.exec(path)?.[1] ?? null;
  if (
    u.hostname === 'www.bobaedream.co.kr' &&
    ['/view', '/board/bulletin/view.php'].includes(path)
  ) {
    const code = u.searchParams.get('code'),
      id = u.searchParams.get('No');
    return code && /^[a-zA-Z0-9_]+$/.test(code) && id && /^[0-9]+$/.test(id)
      ? `${code}:${id}`
      : null;
  }
  if (u.hostname === 'www.inven.co.kr') {
    const match = /^\/board\/([a-zA-Z0-9_]+)\/([0-9]+)\/([0-9]+)$/.exec(path);
    return match ? match.slice(1).join(':') : null;
  }
  return null;
}
