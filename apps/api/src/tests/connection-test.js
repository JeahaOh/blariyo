const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.test' });

async function testConnection() {
  try {
    console.log({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('데이터베이스 연결 성공!');
    
    const [rows] = await connection.execute('SELECT 1');
    console.log('쿼리 실행 결과:', rows);

    await connection.end();
  } catch (error) {
    console.error('데이터베이스 연결 실패:', error);
  }
}

testConnection(); 