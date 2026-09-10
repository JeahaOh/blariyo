import { env } from 'node:process';
export default defineEventHandler(async (event) => {
  if (env.NODE_ENV === 'production') throw createError({ statusCode: 404 });
  const path = getRouterParam(event, 'path') || '';
  if (!/^posts\/[1-9][0-9]*\/[1-9][0-9]*-[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(path))
    throw createError({ statusCode: 404 });
  const response = await fetch(
    `${useRuntimeConfig(event).coreOrigin}/internal/local-media/${path}`
  );
  if (!response.ok) throw createError({ statusCode: 404 });
  setHeader(
    event,
    'Content-Type',
    response.headers.get('content-type') || 'application/octet-stream'
  );
  setHeader(event, 'Cache-Control', 'no-store');
  return sendStream(event, response.body!);
});
