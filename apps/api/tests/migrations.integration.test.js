const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
const { DEFAULT_MIGRATIONS_DIR, migrate } = require('../src/db/migrate');

const describeIntegration = process.env.RUN_MIGRATION_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('M0 PostgreSQL migrations', () => {
  let client;

  beforeAll(async () => {
    process.env.MIGRATION_DB_HOST = process.env.MIGRATION_DB_HOST || '127.0.0.1';
    process.env.MIGRATION_DB_PORT = process.env.MIGRATION_DB_PORT || '45434';
    process.env.MIGRATION_DB_NAME = process.env.MIGRATION_DB_NAME || 'blariyo_migration_test';
    process.env.MIGRATION_DB_USER = process.env.MIGRATION_DB_USER || 'blariyo_migration_test';
    process.env.MIGRATION_DB_PASSWORD =
      process.env.MIGRATION_DB_PASSWORD || 'blariyo_migration_test';

    client = new Client({
      host: process.env.MIGRATION_DB_HOST,
      port: Number(process.env.MIGRATION_DB_PORT),
      database: process.env.MIGRATION_DB_NAME,
      user: process.env.MIGRATION_DB_USER,
      password: process.env.MIGRATION_DB_PASSWORD,
    });
    await client.connect();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it('동시 실행해도 V001과 V002를 한 번만 적용한다', async () => {
    const results = await Promise.all([migrate(), migrate()]);
    const appliedVersions = results.flatMap((result) => result.appliedVersions).sort();

    expect(appliedVersions).toEqual([1, 2]);

    const history = await client.query(
      'SELECT version, filename FROM ops.schema_migration ORDER BY version'
    );
    expect(history.rows).toEqual([
      { version: 1, filename: 'V001__create_m0_schema.sql' },
      { version: 2, filename: 'V002__seed_m0_reference_data.sql' },
    ]);
  });

  it('M0 schema, table과 meme seed를 생성한다', async () => {
    const schemas = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('content', 'legal', 'analytics', 'ops')
      ORDER BY schema_name
    `);
    expect(schemas.rows.map((row) => row.schema_name)).toEqual([
      'analytics',
      'content',
      'legal',
      'ops',
    ]);

    const tables = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('content', 'legal', 'analytics', 'ops')
        AND table_name <> 'schema_migration'
      ORDER BY table_schema, table_name
    `);
    expect(tables.rows).toHaveLength(10);

    const board = await client.query(`
      SELECT slug, display_name, is_active, posting_policy, display_order, created_by, updated_by
      FROM content.board
    `);
    expect(board.rows).toEqual([
      {
        slug: 'meme',
        display_name: '짤',
        is_active: true,
        posting_policy: 'ADMIN',
        display_order: 10,
        created_by: 'system:migration',
        updated_by: 'system:migration',
      },
    ]);
  });

  it('재실행하면 이미 적용된 migration을 건너뛴다', async () => {
    await expect(migrate()).resolves.toEqual({ appliedVersions: [], currentVersion: 2 });
  });

  it('게시판 slug와 잘못된 감사 actor를 DB 제약으로 차단한다', async () => {
    await expect(client.query("UPDATE content.board SET slug = 'renamed' WHERE slug = 'meme'"))
      .rejects.toMatchObject({ code: '23514' });

    await expect(
      client.query(`
        INSERT INTO content.board (
          slug, display_name, is_active, posting_policy, display_order, created_by, updated_by
        ) VALUES ('invalid-actor', '잘못된 게시판', TRUE, 'ADMIN', 20, 'admin:raw-sub', 'admin:raw-sub')
      `)
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('실패한 migration 전체를 rollback하고 version을 기록하지 않는다', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blariyo-migration-rollback-'));
    for (const filename of ['V001__create_m0_schema.sql', 'V002__seed_m0_reference_data.sql']) {
      fs.copyFileSync(path.join(DEFAULT_MIGRATIONS_DIR, filename), path.join(directory, filename));
    }
    fs.writeFileSync(
      path.join(directory, 'V003__broken.sql'),
      'CREATE TABLE content.should_rollback (id BIGINT PRIMARY KEY);\nSELECT missing_function();\n'
    );

    try {
      await expect(migrate({ migrationsDir: directory })).rejects.toThrow(
        'Migration failed: V003__broken.sql'
      );
      const rollbackTable = await client.query(
        "SELECT to_regclass('content.should_rollback') AS relation"
      );
      expect(rollbackTable.rows[0].relation).toBeNull();
      const history = await client.query(
        'SELECT COUNT(*)::INTEGER AS count FROM ops.schema_migration WHERE version = 3'
      );
      expect(history.rows[0].count).toBe(0);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
