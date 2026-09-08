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
const created = [];
let primaryError;
try {
  const env = { ...process.env };
  for (const [i, name] of names.entries()) {
    await pool.query(`CREATE DATABASE ${name}`);
    created.push(name);
    console.log(`Integration database created: ${name}`);
    const url = new URL(base);
    url.pathname = '/' + name;
    env[keys[i]] = url.href;
  }
  const child = spawn(process.execPath, ['--test', 'tests/*.test.mjs'], { stdio: 'inherit', env });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Integration test child failed: ${signal || `exit ${code}`}`));
    });
  });
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  for (const name of created.reverse())
    try {
      await pool.query(`DROP DATABASE ${name} WITH (FORCE)`);
      console.log(`Integration database dropped: ${name}`);
    } catch (error) {
      cleanupErrors.push(new Error(`Failed to drop owned integration database ${name}`, { cause: error }));
    }
  try {
    await pool.end();
  } catch (error) {
    cleanupErrors.push(new Error('Failed to close integration database admin pool', { cause: error }));
  }
  if (primaryError && cleanupErrors.length)
    throw new AggregateError([primaryError, ...cleanupErrors], 'Integration tests and cleanup failed');
  if (primaryError) throw primaryError;
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Integration cleanup failed');
}
