const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validateJoin, validateLogin, validateUpdate } = require('../middlewares/validateMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - user_id
 *         - user_pswd
 *         - user_nm
 *         - role_code
 *       properties:
 *         user_id:
 *           type: string
 *           description: 사용자 ID
 *         user_pswd:
 *           type: string
 *           description: 사용자 비밀번호
 *         user_nm:
 *           type: string
 *           description: 사용자 이름
 *         email:
 *           type: string
 *           description: 이메일
 *         role_code:
 *           type: string
 *           enum: [USER, ADMIN]
 *           description: 사용자 권한 (USER 또는 ADMIN)
 *         status_code:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           description: 사용자 상태
 *     JoinUser:
 *       type: object
 *       required:
 *         - user_id
 *         - user_pswd
 *         - user_nm
 *       properties:
 *         user_id:
 *           type: string
 *           description: 사용자 ID
 *         user_pswd:
 *           type: string
 *           description: 사용자 비밀번호
 *         user_nm:
 *           type: string
 *           description: 사용자 이름
 *     SearchUser:
 *       type: object
 *       required:
 *         - user_id
 *       properties:
 *         user_id:
 *           type: string
 *           description: 사용자 ID
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
 *     UpdateUser:
 *       type: object
 *       properties:
 *         user_pswd:
 *           type: string
 *           description: 사용자 비밀번호
 *         user_nm:
 *           type: string
 *           description: 사용자 이름
 *         email:
 *           type: string
 *           description: 이메일
 *         role_code:
 *           type: string
 *           enum: [USER, ADMIN]
 *           description: 사용자 권한 (USER 또는 ADMIN)
 *         status_code:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           description: 사용자 상태
 *         login_fail_cnt:
 *           type: integer
 *           description: 로그인 시도 실패 횟수
 *         updator_no:
 *           type: integer
 *           description: 수정자 번호
 */

/**
 * @swagger
 * /api/v1/users/register:
 *   post:
 *     summary: 사용자 등록
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JoinUser'
 *     responses:
 *       201:
 *         description: 사용자 등록 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/register', validateJoin, userController.register);

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
router.post('/login', validateLogin, userController.login);

/**
 * @swagger
 * /api/v1/users/{user_id}:
 *   get:
 *     summary: 사용자 정보 조회
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: 사용자 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/:user_id', userController.getUser);

/**
 * @swagger
 * /api/v1/users/{user_id}:
 *   put:
 *     summary: 사용자 정보 수정
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       200:
 *         description: 사용자 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 사용자 없음
 */
router.put('/:user_id', validateUpdate, userController.updateUser);

/**
 * @swagger
 * /api/v1/users/{user_id}:
 *   delete:
 *     summary: 사용자 삭제
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 삭제 성공
 *       404:
 *         description: 사용자 없음
 */
router.delete('/:user_id', userController.deleteUser);

module.exports = router; 