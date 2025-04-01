// apps/api/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const requestLogger = require('./src/middlewares/loggerMiddleware');
const errorHandler = require('./src/middlewares/errorHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(errorHandler);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Hello, API!');
});

app.get('/test-error', (req, res) => {
  throw new Error('This is a test error');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
