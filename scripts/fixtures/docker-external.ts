import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const jwks: unknown = JSON.parse(process.env.FIXTURE_JWKS || 'null');
assert.ok(jwks && typeof jwks === 'object' && 'keys' in jwks && Array.isArray(jwks.keys));
const observations = { jwks: 0, purge: 0, inventory: 0, rejected: 0 };
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://external:8081');
  if (request.method === 'GET' && url.pathname === '/jwks') {
    observations.jwks++;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(jwks));
  } else if (request.method === 'GET' && url.pathname === '/observations') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(observations));
  } else if (
    request.method === 'POST' &&
    url.pathname === '/purge_cache' &&
    request.headers.authorization === 'Bearer ' + process.env.CACHE_PURGE_TOKEN
  ) {
    observations.purge++;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ success: true }));
  } else if (
    request.method === 'GET' &&
    ['/fixture-private/', '/fixture-public/'].includes(url.pathname) &&
    url.searchParams.get('list-type') === '2' &&
    request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')
  ) {
    observations.inventory++;
    response.setHeader('Content-Type', 'application/xml');
    response.end(
      '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>' +
        url.pathname.slice(1, -1) +
        '</Name><KeyCount>0</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated></ListBucketResult>'
    );
  } else {
    observations.rejected++;
    response.writeHead(400);
    response.end('UNEXPECTED_FIXTURE_REQUEST');
  }
});
server.listen(8081, '0.0.0.0');
