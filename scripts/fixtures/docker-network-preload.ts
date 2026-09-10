// Docker verification only: real adapters keep their configured contracts, with external HTTP
// terminating on the invocation's isolated mock service. This file is never in runtime images.
const originalFetch = globalThis.fetch;
const mockOrigin = 'http://external:8081';
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (
    url.origin === 'https://api.cloudflare.com' &&
    url.pathname === '/client/v4/zones/fixture-zone/purge_cache'
  ) {
    return originalFetch(new Request(mockOrigin + '/purge_cache', request));
  }
  if (
    url.origin === 'https://access.blariyo.example.com' &&
    url.pathname === '/cdn-cgi/access/certs'
  ) {
    return originalFetch(new Request(mockOrigin + '/jwks', request));
  }
  if (['http://api:3100', 'http://maintenance:3100', 'http://external:8081'].includes(url.origin)) {
    return originalFetch(request);
  }
  throw new Error('DOCKER_FIXTURE_EXTERNAL_FETCH_BLOCKED');
};
