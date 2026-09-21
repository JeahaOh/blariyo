import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
export async function fetchPublic(url, limit = 20 * 1024 * 1024) {
  const { stdout } = await execute(
    'python3',
    [fileURLToPath(new URL('./fetch-public.py', import.meta.url)), url, String(limit)],
    {
      encoding: 'buffer',
      maxBuffer: limit + 65536,
      timeout: 45000,
    }
  );
  const end = stdout.indexOf(10);
  if (end < 0) throw new Error('INVALID_FETCH_PROTOCOL');
  return { ...JSON.parse(stdout.subarray(0, end).toString()), body: stdout.subarray(end + 1) };
}
