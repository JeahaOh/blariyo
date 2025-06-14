const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { validateLogin } = require('../middleware/validation');

const authController = new AuthController();

/**
 * @swagger
 * /api/v1/users/login:
 *   post:
 *     summary: 사용자 로그인
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       200:
 *         description: 로그인 성공
 *       401:
 *         description: 인증 실패
 */
router.post('/login', validateLogin, authController.login);

// 로그아웃
router.post('/logout', authController.logout);

module.exports = router; 