const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.test' });

describe('Database Connection Test', () => {
  let connection;

  beforeAll(async () => {
    console.log(`
      DB_HOST : ${process.env.DB_HOST}
      DB_PORT : ${process.env.DB_PORT}
      DB_USER : ${process.env.DB_USER}
      DB_PASSWORD : ${process.env.DB_PASSWORD}
      DB_NAME : ${process.env.DB_NAME}
    `);

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  });

  afterAll(async () => {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('연결 종료 중 에러:', error);
      }
    }
  });

  it('환경 변수가 설정되어 있어야 함', () => {
    const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    requiredEnvVars.forEach(envVar => {
      expect(process.env[envVar]).toBeDefined();
      expect(process.env[envVar]).not.toBe('');
    });
  });

  it('잘못된 연결 정보로 연결 시도 시 에러가 발생해야 함', async () => {
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
  
  it('데이터베이스 연결 성공', () => {
    expect(connection).toBeDefined();
  });
    
  it('데이터베이스 버전 확인', async () => {
    const [rows] = await connection.execute('SELECT VERSION() as version');
    expect(rows[0].version).toBeDefined();
    console.log('MySQL Version:', rows[0].version);
  });
  
  it('데이터베이스 쿼리를 실행할 수 있어야 함', async () => {
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

  it('잘못된 쿼리 실행 시 에러가 발생해야 함', async () => {
    await expect(connection.execute('INVALID SQL')).rejects.toThrow();
  });

  it('테이블 목록 조회', async () => {
    const [rows] = await connection.execute('SHOW TABLES');
    expect(Array.isArray(rows)).toBe(true);
    console.log('Tables:', rows.map(row => Object.values(row)[0]));
  });

  it('테이블 상세 정보 확인', async () => {
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [process.env.DB_NAME]);

    console.log('\n테이블 정보:');
    console.log('-------------------');
    
    for (const table of tables) {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [process.env.DB_NAME, table.TABLE_NAME]);

      console.log(`\n테이블명: ${table.TABLE_NAME}`);
      console.log(`레코드 수: ${table.TABLE_ROWS}`);
      console.log('컬럼 정보:');
      columns.forEach(col => {
        console.log(`- ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : ''}`);
      });
      console.log('-------------------');
    }

    expect(tables.length).toBeGreaterThan(0);
  });
  
  it('TU_USER 테이블 구조 확인', async () => {
    const [rows] = await connection.execute('DESCRIBE TU_USER');
    expect(Array.isArray(rows)).toBe(true);
    console.log('TU_USER Table Structure:', rows);
  });
}); 