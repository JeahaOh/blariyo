import { mkdir, writeFile, readFile, unlink, copyFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
export function localStorage(root, { production = process.env.NODE_ENV === 'production' } = {}) {
  if (production) throw new Error('Local storage is forbidden in production');
  function path(bucket, key) {
    if (!['private', 'public'].includes(bucket)) throw new Error('Invalid bucket');
    const base = resolve(root, bucket);
    const p = resolve(base, key);
    if (!p.startsWith(base + sep)) throw new Error('Invalid key');
    return p;
  }
  return {
    async put(bucket, key, bytes) {
      const p = path(bucket, key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
    },
    async get(bucket, key) {
      return readFile(path(bucket, key));
    },
    async promote(source, target) {
      const p = path('public', target);
      await mkdir(dirname(p), { recursive: true });
      await copyFile(path('private', source), p);
    },
    async delete(bucket, key) {
      try {
        await unlink(path(bucket, key));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    },
    async inventory(bucket) {
      const base = resolve(root, bucket);
      const output = [];
      async function walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true }).catch((e) => {
          if (e.code === 'ENOENT') return [];
          throw e;
        })) {
          const p = resolve(dir, entry.name);
          if (entry.isDirectory()) await walk(p);
          else {
            const info = await stat(p);
            output.push({ key: p.slice(base.length + 1), createdAt: info.mtime });
          }
        }
      }
      await walk(base);
      return output;
    },
  };
}
export function localCache({ production = process.env.NODE_ENV === 'production' } = {}) {
  if (production) throw new Error('Fake cache is forbidden in production');
  return { async purge(_urls) {} };
}
