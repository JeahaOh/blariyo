const { Client } = require('pg');
require('dotenv').config({ path: '.env.test' });

describe('PostgreSQL Connection', () => {
  let client;

  beforeAll(async () => {
    client = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('필수 환경 변수가 설정되어 있어야 함', () => {
    const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    requiredEnvVars.forEach((envVar) => {
      expect(process.env[envVar]).toBeDefined();
      expect(process.env[envVar]).not.toBe('');
    });
  });

  it('잘못된 연결 정보는 거부되어야 함', async () => {
    const invalidClient = new Client({
      host: '127.0.0.1',
      port: Number(process.env.DB_PORT),
      user: 'wrong_user',
      password: 'wrong_password',
      database: 'wrong_database',
      connectionTimeoutMillis: 1000,
    });

    await expect(invalidClient.connect()).rejects.toThrow();
  });

  it('PostgreSQL 버전을 확인할 수 있어야 함', async () => {
    const result = await client.query('SELECT current_setting(\'server_version\') AS version');
    expect(result.rows[0].version).toBeDefined();
  });

  it('기본 쿼리를 실행할 수 있어야 함', async () => {
    const result = await client.query('SELECT 1 AS result');
    expect(result.rows[0].result).toBe(1);
  });

  it('현재 schema의 테이블을 조회할 수 있어야 함', async () => {
    const result = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
       ORDER BY table_name`
    );
    expect(result.rows.map((row) => row.table_name)).toContain('tu_user');
  });

  it('잘못된 쿼리는 거부되어야 함', async () => {
    await expect(client.query('INVALID SQL')).rejects.toThrow();
  });

  it('tu_user 구조를 조회할 수 있어야 함', async () => {
    const result = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'tu_user'
       ORDER BY ordinal_position`
    );
    expect(result.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(['user_no', 'user_id', 'user_pswd', 'status_code'])
    );
  });
});
