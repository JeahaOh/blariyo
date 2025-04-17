const { testPool } = require('./setup');

describe('Database Tests', () => {
  afterAll(async () => {
    await testPool.end();
  });

  test('데이터베이스 연결 테스트', async () => {
    const connection = await testPool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT 1');
      expect(rows[0]['1']).toBe(1);
    } finally {
      connection.release();
    }
  });

  test('테이블 정보 확인', async () => {
    const connection = await testPool.getConnection();
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
}); 