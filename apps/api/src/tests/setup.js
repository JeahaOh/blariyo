const mysql = require('mysql2/promise');

// 테스트 환경 설정
process.env.NODE_ENV = 'test';

// 환경 변수 로드
require('dotenv').config({ path: '.env.test' });

// Jest 타임아웃 설정
jest.setTimeout(30000);

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

// 테스트 종료 시 데이터베이스 연결 해제
afterAll(async () => {
  await testPool.end();
});

module.exports = {
  testPool
}; 