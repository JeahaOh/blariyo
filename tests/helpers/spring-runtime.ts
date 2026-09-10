import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
export async function freePort(): Promise<number> {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return address.port;
}
export async function until<T>(check: () => Promise<T>, timeout = 60000): Promise<NonNullable<T>> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Runtime condition timed out');
}

// Local Collector job identifiers enter fixture SQL only after the UUID shape is checked.
export function uuid(value: unknown): string {
  assert.ok(typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value));
  return value;
}
