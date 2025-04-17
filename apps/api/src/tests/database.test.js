const pool = require('../config/database');

describe('Database Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('데이터베이스 연결 테스트', async () => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT 1');
      expect(rows[0]['1']).toBe(1);
    } finally {
      connection.release();
    }
  });

  test('테이블 정보 확인', async () => {
    const connection = await pool.getConnection();
    try {
      // 테이블 목록 조회
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME, TABLE_ROWS 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
      `, [process.env.DB_NAME]);

      console.log('\n테이블 정보:');
      console.log('-------------------');
      
      // 각 테이블의 상세 정보 조회
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

      // 테이블이 존재하는지 확인
      expect(tables.length).toBeGreaterThan(0);
    } finally {
      connection.release();
    }
  });

  describe('Database Configuration Tests', () => {
    test('연결 풀 설정 확인', async () => {
      const connection = await pool.getConnection();
      try {
        // 연결 풀 설정 확인
        expect(pool.pool.config.connectionLimit).toBe(10);
        expect(pool.pool.config.waitForConnections).toBe(true);
        expect(pool.pool.config.queueLimit).toBe(0);

        // 데이터베이스 연결 확인
        const [rows] = await connection.execute('SELECT 1');
        expect(rows[0]['1']).toBe(1);

        // 데이터베이스 이름 확인
        const [dbInfo] = await connection.execute('SELECT DATABASE() as db');
        expect(dbInfo[0].db).toBe(process.env.DB_NAME);
      } finally {
        connection.release();
      }
    });

    test('연결 풀 동시 연결 테스트', async () => {
      const connections = [];
      try {
        // 여러 연결을 동시에 시도
        for (let i = 0; i < 5; i++) {
          const connection = await pool.getConnection();
          connections.push(connection);
          
          // 각 연결이 정상적으로 작동하는지 확인
          const [rows] = await connection.execute('SELECT 1');
          expect(rows[0]['1']).toBe(1);
        }
      } finally {
        // 모든 연결 해제
        await Promise.all(connections.map(conn => conn.release()));
      }
    });

    test('연결 풀 에러 처리', async () => {
      // 잘못된 쿼리 실행 시 에러 처리 확인
      const connection = await pool.getConnection();
      try {
        await expect(connection.execute('INVALID SQL')).rejects.toThrow();
      } finally {
        connection.release();
      }
    });
  });
}); 