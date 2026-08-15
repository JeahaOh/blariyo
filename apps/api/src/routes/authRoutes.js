const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin } = require('../middlewares/loginValidator');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 인증 관련 API
 * components:
 *   schemas:
 *     Login:
 *       type: object
 *       required:
 *         - user_id
 *         - user_pswd
 *       properties:
 *         user_id:
 *           type: string
 *           description: 사용자 ID
 *         user_pswd:
 *           type: string
 *           description: 사용자 비밀번호
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 사용자 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - user_pswd
 *             properties:
 *               user_id:
 *                 type: string
 *               user_pswd:
 *                 type: string
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
