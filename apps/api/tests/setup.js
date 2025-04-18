const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.test' });

// 테스트 환경 설정
process.env.NODE_ENV = 'test';

// Jest 타임아웃 설정
jest.setTimeout(30000);

// 전역 데이터베이스 연결 풀 설정
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

// 전역 설정
global.console = {
  ...console,
  // 테스트 중에 불필요한 로그 출력 방지
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// 테스트 데이터베이스 생성
async function createTestDatabase() {
  const rootPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    // 데이터베이스가 없으면 생성
    await rootPool.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // init.sql 파일 읽기
    const initSqlPath = path.join(__dirname, '../../init/mysql/scripts/init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    // SQL 문장 분리 및 실행
    const sqlStatements = initSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    // 각 SQL 문장 실행
    for (const statement of sqlStatements) {
      try {
        await testPool.query(statement);
      } catch (error) {
        console.error('SQL 실행 중 에러:', error.message);
        console.error('실패한 SQL:', statement);
      }
    }
  } finally {
    await rootPool.end();
  }
}

// 테스트 시작 전 데이터베이스 생성
beforeAll(async () => {
  await createTestDatabase();
});

// 테스트 종료 시 데이터베이스 연결 해제
afterAll(async () => {
  await testPool.end();
});

async function setupTestDB() {
  const connection = await testPool.getConnection();
  try {
    // 테이블 초기화
    await connection.query('TRUNCATE TABLE TU_USER');
    
    // 테스트 데이터 삽입
    await connection.query(
      `INSERT INTO TU_USER (
        user_id, user_pswd, user_nm, email, role_code, status_code,
        reg_dttm, upd_dttm
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'testuser',
        '$2b$10$examplehashedpassword',
        '테스트 사용자',
        'test@example.com',
        'USER',
        'ACTIVE'
      ]
    );
  } finally {
    connection.release();
  }
}

async function cleanupTestDB() {
  const connection = await testPool.getConnection();
  try {
    await connection.query('TRUNCATE TABLE TU_USER');
  } finally {
    connection.release();
  }
}

// 전역 변수로 설정
global.testPool = testPool;

module.exports = {
  setupTestDB,
  cleanupTestDB
}; 