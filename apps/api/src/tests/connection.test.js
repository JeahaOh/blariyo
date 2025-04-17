const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env.test' });

describe('Database Connection Tests', () => {
  let connection;

  beforeAll(() => {
    // 환경 변수 기본값 설정
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    console.log('DB_HOST: ' + process.env.DB_HOST);
    process.env.DB_PORT = process.env.DB_PORT || '43306';
    console.log('DB_PORT: ' + process.env.DB_PORT);
    process.env.DB_USER = process.env.DB_USER || 'blariyo_test';
    console.log('DB_USER: ' + process.env.DB_USER);
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test1020';
    console.log('DB_PASSWORD: ' + process.env.DB_PASSWORD);
    process.env.DB_NAME = process.env.DB_NAME || 'blariyo_test';
    console.log('DB_NAME: ' + process.env.DB_NAME);
  });

  afterEach(async () => {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('연결 종료 중 에러:', error);
      }
    }
  });

  test('환경 변수가 설정되어 있어야 합니다', () => {
    const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    requiredEnvVars.forEach(envVar => {
      expect(process.env[envVar]).toBeDefined();
      expect(process.env[envVar]).not.toBe('');
    });
  });

  test('데이터베이스에 연결할 수 있어야 합니다', async () => {
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectTimeout: 10000 // 10초 타임아웃 설정
      });

      expect(connection).toBeDefined();
      expect(connection.connection).toBeDefined();
      
      // 연결 상태 확인
      const [rows] = await connection.execute('SELECT 1 as result');
      expect(rows[0].result).toBe(1);
    } catch (error) {
      console.error('연결 실패:', error);
      throw error;
    }
  });

  test('데이터베이스 쿼리를 실행할 수 있어야 합니다', async () => {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000
    });

    // 간단한 쿼리 실행
    const [rows] = await connection.execute('SELECT 1 as result');
    expect(rows[0].result).toBe(1);

    // 테이블 조회 쿼리 실행
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [process.env.DB_NAME]);
    
    expect(Array.isArray(tables)).toBe(true);
  });

  test('잘못된 연결 정보로 연결 시도 시 에러가 발생해야 합니다', async () => {
    await expect(
      mysql.createConnection({
        host: 'wrong_host',
        port: 3306,
        user: 'wrong_user',
        password: 'wrong_password',
        database: 'wrong_database',
        connectTimeout: 5000
      })
    ).rejects.toThrow();
  });

  test('잘못된 쿼리 실행 시 에러가 발생해야 합니다', async () => {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000
    });

    await expect(connection.execute('INVALID SQL')).rejects.toThrow();
  });
}); 