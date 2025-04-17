const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.test' });

// 테스트용 데이터베이스 설정
const testPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  testPool
}; 