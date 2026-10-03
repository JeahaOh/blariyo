const paths = new Set(['/admin', '/admin/batch', '/admin/collect', '/admin/collect/sources']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Only known local admin routes and non-secret identifiers survive a login round trip. */
export function adminReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return '/admin';
  try {
    const url = new URL(value, 'http://admin.invalid');
    if (url.origin !== 'http://admin.invalid' || !paths.has(url.pathname)) return '/admin';
    const query = new URLSearchParams();
    for (const key of ['postId', 'batchItemId', 'itemId']) {
      const id = url.searchParams.get(key);
      if (id && (key === 'postId' ? /^[1-9][0-9]*$/.test(id) : uuid.test(id))) query.set(key, id);
    }
    return url.pathname + (query.size ? '?' + query.toString() : '');
  } catch {
    return '/admin';
  }
}
