import http from 'node:http';
const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      hostname: process.env.PROXY_UPSTREAM || 'web',
      port: 3000,
      ...(request.url ? { path: request.url } : {}),
      ...(request.method ? { method: request.method } : {}),
      headers: request.headers,
    },
    (reply) => {
      response.writeHead(reply.statusCode || 502, reply.headers);
      reply.pipe(response);
    }
  );
  upstream.on('error', () => {
    response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
});
server.listen(8080, '0.0.0.0');
