const { Pool } = require('pg');
require('dotenv').config({ path: '.env.test' });

const testPool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 5,
  connectionTimeoutMillis: 5000,
  options: '-c timezone=UTC',
});

async function setupTestDB() {
  const client = await testPool.connect();
  try {
    await client.query('TRUNCATE TABLE tu_user RESTART IDENTITY CASCADE');
    await client.query(
      `INSERT INTO tu_user (
        user_id, user_pswd, user_nm, email, role_code, status_code,
        reg_dttm, upd_dttm
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        'testuser',
        '$2b$10$examplehashedpassword',
        '테스트 사용자',
        'test@example.com',
        'USR',
        'ACT',
      ]
    );
  } finally {
    client.release();
  }
}

async function cleanupTestDB() {
  await testPool.query('TRUNCATE TABLE tu_user RESTART IDENTITY CASCADE');
}

async function closeTestDB() {
  await testPool.end();
}

module.exports = {
  testPool,
  setupTestDB,
  cleanupTestDB,
  closeTestDB,
};
