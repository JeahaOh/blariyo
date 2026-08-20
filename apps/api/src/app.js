require('dotenv').config();
const pool = require('./config/database');
const createApp = require('./core/createApp');

const app = createApp({ pool });

// 테스트 환경이 아닐 때만 서버 시작
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Blariyo Core API listening on ${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
