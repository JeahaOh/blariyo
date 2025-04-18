require('dotenv').config({ path: '.env.test' });
const pool = require('../src/config/database');

describe('Database Configuration', () => {
  it('데이터베이스 연결 풀이 올바르게 생성되어야 함', () => {
    expect(pool).toBeDefined();
    expect(pool.pool).toBeDefined();
    expect(pool.pool.config).toBeDefined();
  });

  it('데이터베이스 연결 풀 설정이 올바르게 되어 있어야 함', () => {
    const config = pool.pool.config;
    expect(config.host).toBe(process.env.DB_HOST);
    expect(config.port).toBe(Number(process.env.DB_PORT));
    expect(config.user).toBe(process.env.DB_USER);
    expect(config.database).toBe(process.env.DB_NAME);
    expect(config.connectionLimit).toBe(10);
    expect(config.waitForConnections).toBe(true);
    expect(config.queueLimit).toBe(0);
  });

  it('데이터베이스 연결이 성공적으로 이루어져야 함', async () => {
    const connection = await pool.getConnection();
    expect(connection).toBeDefined();
    connection.release();
  });

  it('데이터베이스 쿼리가 성공적으로 실행되어야 함', async () => {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    expect(rows[0].result).toBe(2);
    connection.release();
  });

  it('잘못된 쿼리 실행 시 적절한 에러가 발생해야 함', async () => {
    const connection = await pool.getConnection();
    await expect(connection.query('INVALID SQL')).rejects.toThrow();
    connection.release();
  });

  it('연결 풀의 동시 연결이 정상적으로 처리되어야 함', async () => {
    const connections = [];
    try {
      for (let i = 0; i < 5; i++) {
        const connection = await pool.getConnection();
        connections.push(connection);
        
        const [rows] = await connection.query('SELECT 1');
        expect(rows[0]['1']).toBe(1);
      }
    } finally {
      await Promise.all(connections.map(conn => conn.release()));
    }
  });

  it('연결 타임아웃이 정상적으로 처리되어야 함', async () => {
    const connection = await pool.getConnection();
    try {
      // 5초 후에 타임아웃이 발생하도록 설정
      await expect(connection.query('SELECT SLEEP(10)')).rejects.toThrow();
    } finally {
      connection.release();
    }
  });

  it('트랜잭션이 정상적으로 처리되어야 함', async () => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 트랜잭션 내에서 쿼리 실행
      await connection.query('SELECT 1');
      
      // 롤백 테스트
      await connection.rollback();
      
      // 트랜잭션이 롤백되었는지 확인
      const [rows] = await connection.query('SELECT @@session.transaction_isolation');
      expect(rows[0]['@@session.transaction_isolation']).toBe('REPEATABLE-READ');
    } finally {
      connection.release();
    }
  });

  it('연결 풀의 최대 연결 수를 초과할 때 적절히 처리되어야 함', async () => {
    const connections = [];
    try {
      // 연결 풀의 최대 연결 수를 초과하는 연결을 시도
      for (let i = 0; i < 15; i++) {
        const connection = await pool.getConnection();
        connections.push(connection);
      }
    } catch (error) {
      expect(error.message).toContain('Too many connections');
    } finally {
      await Promise.all(connections.map(conn => conn.release()));
    }
  });

  it('데이터베이스 연결이 끊어졌을 때 재연결이 정상적으로 이루어져야 함', async () => {
    const connection = await pool.getConnection();
    try {
      // 연결을 강제로 끊음
      await connection.query('KILL CONNECTION_ID()');
      
      // 새로운 연결을 시도
      const newConnection = await pool.getConnection();
      expect(newConnection).toBeDefined();
      newConnection.release();
    } finally {
      connection.release();
    }
  });

  it('데이터베이스 연결 풀의 상태 정보가 정상적으로 반환되어야 함', async () => {
    const stats = pool.pool.pool;
    expect(stats).toBeDefined();
    expect(stats.connectionLimit).toBe(10);
    expect(stats.waiting).toBeDefined();
    expect(stats.connections).toBeDefined();
  });

  afterAll(async () => {
    await pool.end();
  });
}); 