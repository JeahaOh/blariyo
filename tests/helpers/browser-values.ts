import assert from 'node:assert/strict';
export function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
export function firstRow(result: { rows: Record<string, unknown>[] }) {
  const row = result.rows[0];
  assert.ok(row, 'Expected a database row');
  return row;
}
