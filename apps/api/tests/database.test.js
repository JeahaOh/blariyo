require('dotenv').config({ path: '.env.test' });
const pool = require('../src/config/database');

describe('PostgreSQL Pool Configuration', () => {
  it('연결 풀이 환경 변수 기준으로 생성되어야 함', () => {
    expect(pool).toBeDefined();
    expect(pool.options.host).toBe(process.env.DB_HOST);
    expect(pool.options.port).toBe(Number(process.env.DB_PORT));
    expect(pool.options.user).toBe(process.env.DB_USER);
    expect(pool.options.database).toBe(process.env.DB_NAME);
    expect(pool.options.max).toBe(10);
  });

  it('연결을 획득하고 반환할 수 있어야 함', async () => {
    const client = await pool.connect();
    try {
      expect(client).toBeDefined();
    } finally {
      client.release();
    }
  });

  it('pool query를 실행할 수 있어야 함', async () => {
    const result = await pool.query('SELECT 1 + 1 AS result');
    expect(result.rows[0].result).toBe(2);
  });

  it('statement timeout을 적용할 수 있어야 함', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '100ms'");
      await expect(client.query('SELECT pg_sleep(1)')).rejects.toThrow();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('트랜잭션 rollback 후 연결을 재사용할 수 있어야 함', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1');
      await client.query('ROLLBACK');

      const isolation = await client.query('SHOW transaction_isolation');
      expect(isolation.rows[0].transaction_isolation).toBe('read committed');
    } finally {
      client.release();
    }
  });

  it('연결 풀 상태를 확인할 수 있어야 함', () => {
    expect(pool.totalCount).toBeGreaterThanOrEqual(0);
    expect(pool.idleCount).toBeGreaterThanOrEqual(0);
    expect(pool.waitingCount).toBeGreaterThanOrEqual(0);
  });

  afterAll(async () => {
    await pool.end();
  });
});
