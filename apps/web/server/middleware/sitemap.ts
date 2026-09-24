export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!/^\/sitemap(?:-pages|-posts-[0-9]+)?\.xml$/.test(path)) return;
  setHeader(event, 'Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(event.method)) {
    setHeader(event, 'Allow', 'GET, HEAD');
    throw createError({ statusCode: 405 });
  }
  const name = path === '/sitemap.xml' ? 'index.xml' : path.slice('/sitemap-'.length);
  if (
    name !== 'index.xml' &&
    name !== 'pages.xml' &&
    !/^posts-(0|[1-9][0-9]{0,14})\.xml$/.test(name)
  )
    throw createError({ statusCode: 404 });
  const config = useRuntimeConfig(event);
  try {
    const response = await fetch(new URL(`/internal/sitemaps/${name}`, config.coreOrigin), {
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw createError({ statusCode: response.status === 404 ? 404 : 503 });
    }
    if (!response.headers.get('content-type')?.startsWith('application/xml')) {
      await response.body?.cancel();
      throw createError({ statusCode: 503 });
    }
    const body = await response.text();
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    return event.method === 'HEAD' ? '' : body;
  } catch (error) {
    throw createError({
      statusCode: errorStatus(error) === 404 ? 404 : 503,
      message: '사이트맵을 불러올 수 없습니다.',
    });
  }
});
