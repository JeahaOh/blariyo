const legacyChecksums = new Set([
  'acd6d387d5c1bc61e17bf804665d973dbf5cd7f0c61f776ee91a63181fc64dde',
]);

/**
 * @param {string} current
 * @param {unknown} recorded
 */
export function contentMigrationChecksumMatches(current, recorded) {
  return typeof recorded === 'string' && (current === recorded || legacyChecksums.has(recorded));
}
