/** Runtime narrowing for the driver boundary, including parameterized PostgreSQL-only queries. */
export function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('INVALID_DATABASE_RESULT');
  return value.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row))
      throw new Error('INVALID_DATABASE_ROW');
    return Object.fromEntries(Object.entries(row));
  });
}
export function requiredRow(value: unknown): Record<string, unknown> {
  const first = rows(value)[0];
  if (!first) throw new Error('MISSING_DATABASE_ROW');
  return first;
}
export function decimalId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value))
    throw new Error('INVALID_DATABASE_ID');
  return value;
}
