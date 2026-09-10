import { mkdir, writeFile, readFile, unlink, copyFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import type { Bucket, Storage, EdgeCache, StoredObject } from '../shared/storage.js';
function missing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
export function localStorage(
  root: string,
  { production = process.env.NODE_ENV === 'production' } = {}
): Storage {
  if (production) throw new Error('Local storage is forbidden in production');
  function path(bucket: Bucket, key: string) {
    const base = resolve(root, bucket),
      target = resolve(base, key);
    if (!['private', 'public'].includes(bucket) || !target.startsWith(base + sep))
      throw new Error('Invalid key');
    return target;
  }
  return {
    async put(bucket, key, bytes) {
      const target = path(bucket, key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    },
    get(bucket, key) {
      return readFile(path(bucket, key));
    },
    async promote(source, target) {
      const destination = path('public', target);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(path('private', source), destination);
    },
    async delete(bucket, key) {
      try {
        await unlink(path(bucket, key));
      } catch (error) {
        if (!missing(error)) throw error;
      }
    },
    async inventory(bucket) {
      const base = resolve(root, bucket),
        output: StoredObject[] = [];
      async function walk(directory: string): Promise<void> {
        const entries = await readdir(directory, { withFileTypes: true }).catch(
          (error: unknown) => {
            if (missing(error)) return [];
            throw error;
          }
        );
        for (const entry of entries) {
          const target = resolve(directory, entry.name);
          if (entry.isDirectory()) await walk(target);
          else {
            const info = await stat(target);
            output.push({ key: target.slice(base.length + 1), createdAt: info.mtime });
          }
        }
      }
      await walk(base);
      return output;
    },
  };
}
export function localCache({ production = process.env.NODE_ENV === 'production' } = {}): EdgeCache {
  if (production) throw new Error('Fake cache is forbidden in production');
  return { async purge(_urls: string[]) {} };
}
