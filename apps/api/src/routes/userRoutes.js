const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validateJoin, validateLogin, validateUpdate } = require('../middlewares/validateMiddleware');

// 회원가입
router.post('/register', validateJoin, userController.register);

// 로그인
router.post('/login', validateLogin, userController.login);

// 사용자 정보 조회
router.get('/me', userController.getUser);

// 사용자 정보 수정
router.put('/me', validateUpdate, userController.updateUser);

// 회원 탈퇴
router.delete('/me', userController.deleteUser);

module.exports = router; 