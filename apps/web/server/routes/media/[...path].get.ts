import { env } from 'node:process';

function localCore(origin: string) {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function mediaPath(value: unknown) {
  if (Array.isArray(value)) return value.join('/');
  return typeof value === 'string' ? value : '';
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (env.NODE_ENV === 'production' && !localCore(config.coreOrigin))
    throw createError({ statusCode: 404 });
  const path = mediaPath(getRouterParam(event, 'path'));
  if (!/^(?:posts|content\/published\/posts)\/[1-9][0-9]*\/[1-9][0-9]*-[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(path))
    throw createError({ statusCode: 404 });
  const response = await fetch(`${config.coreOrigin}/internal/local-media/${path}`);
  if (!response.ok) throw createError({ statusCode: 404 });
  setHeader(
    event,
    'Content-Type',
    response.headers.get('content-type') || 'application/octet-stream'
  );
  setHeader(event, 'Cache-Control', 'no-store');
  return sendStream(event, response.body!);
});
