const userService = require('../services/userService');

class UserController {
  async register(req, res) {
    try {
      const userId = await userService.register(req.body);
      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: { user_id: userId }
      });
    } catch (error) {
      console.log('error : ', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async login(req, res) {
    try {
      console.log('req.body : ', req.body);
      const { user_id, user_pswd } = req.body;
      const result = await userService.login(user_id, user_pswd);
      
      res.json({
        success: true,
        message: '로그인 성공',
        data: result
      });
    } catch (error) {
      console.log('error : ', error);
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUser(req, res) {
    try {
      const user = await userService.getUserById(req.user.user_id);
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateUser(req, res) {
    try {
      await userService.updateUser(req.user.user_id, req.body);
      res.json({
        success: true,
        message: '사용자 정보가 수정되었습니다.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteUser(req, res) {
    try {
      await userService.deleteUser(req.user.user_id);
      res.json({
        success: true,
        message: '회원 탈퇴가 완료되었습니다.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new UserController(); 