const previousChecksum = 'acd6d387d5c1bc61e17bf804665d973dbf5cd7f0c61f776ee91a63181fc64dde';
const reformattedChecksum = '98631178cdb44dec312748ba70b15a1ed46b1b4f26a0922c60e88e7ba90e8d6b';

/**
 * @param {string} current
 * @param {unknown} recorded
 */
export function contentMigrationChecksumMatches(current, recorded) {
  return (
    typeof recorded === 'string' &&
    (current === recorded || (recorded === previousChecksum && current === reformattedChecksum))
  );
}
