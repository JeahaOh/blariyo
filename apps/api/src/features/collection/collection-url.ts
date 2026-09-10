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
