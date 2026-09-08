import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createPool } from '../apps/api/src/db.mjs';
const base = process.env.TEST_DATABASE_ADMIN_URL;
if (!base)
  throw new Error('TEST_DATABASE_ADMIN_URL is required; use an isolated local PostgreSQL instance');
const pool = createPool(base),
  suffix = randomBytes(6).toString('hex'),
  names = [
    'public',
    'admin',
    'policy',
    'constraints',
    'failure',
    'bff',
    'review',
    'collection',
  ].map((n) => `m0_${n}_${suffix}`),
  keys = [
    'TEST_DATABASE_URL',
    'TEST_ADMIN_DATABASE_URL',
    'TEST_POLICY_DATABASE_URL',
    'TEST_CONSTRAINT_DATABASE_URL',
    'TEST_FAILURE_DATABASE_URL',
    'TEST_BFF_DATABASE_URL',
    'TEST_REVIEW_DATABASE_URL',
    'TEST_COLLECTION_DATABASE_URL',
  ];
try {
  const env = { ...process.env };
  for (const [i, name] of names.entries()) {
    await pool.query(`CREATE DATABASE ${name}`);
    const url = new URL(base);
    url.pathname = '/' + name;
    env[keys[i]] = url.href;
  }
  const child = spawn(process.execPath, ['--test', 'tests/*.test.mjs'], { stdio: 'inherit', env });
  process.exitCode = await new Promise((r) => child.once('exit', r));
} finally {
  for (const name of names) await pool.query(`DROP DATABASE IF EXISTS ${name}`).catch(() => {});
  await pool.end();
}
