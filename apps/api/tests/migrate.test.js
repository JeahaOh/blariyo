const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_MIGRATIONS_DIR,
  checksum,
  discoverMigrations,
  verifyAppliedMigrations,
} = require('../src/db/migrate');

describe('migration file validation', () => {
  it('V001부터 연속된 migration을 읽는다', () => {
    const migrations = discoverMigrations();

    expect(migrations.map(({ version, filename }) => ({ version, filename }))).toEqual([
      { version: 1, filename: 'V001__create_m0_schema.sql' },
      { version: 2, filename: 'V002__seed_m0_reference_data.sql' },
    ]);
    migrations.forEach((migration) => expect(migration.checksum).toMatch(/^[0-9a-f]{64}$/));
  });

  it('파일 이름이 규칙과 다르면 거부한다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blariyo-migration-name-'));
    fs.writeFileSync(path.join(directory, '001-invalid.sql'), 'SELECT 1;');

    try {
      expect(() => discoverMigrations(directory)).toThrow('Invalid migration filename');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('버전이 연속되지 않으면 거부한다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blariyo-migration-gap-'));
    fs.copyFileSync(
      path.join(DEFAULT_MIGRATIONS_DIR, 'V001__create_m0_schema.sql'),
      path.join(directory, 'V001__create_m0_schema.sql')
    );
    fs.writeFileSync(path.join(directory, 'V003__gap.sql'), 'SELECT 1;');

    try {
      expect(() => discoverMigrations(directory)).toThrow('must start at V001 and be consecutive');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('적용된 파일의 checksum 변경을 거부한다', () => {
    const migrations = discoverMigrations();
    const first = migrations[0];
    const applied = [
      {
        version: first.version,
        filename: first.filename,
        checksum: checksum(`${first.source}\n-- modified`),
      },
    ];

    expect(() => verifyAppliedMigrations(migrations, applied)).toThrow(
      `Applied migration was modified: ${first.filename}`
    );
  });
});
