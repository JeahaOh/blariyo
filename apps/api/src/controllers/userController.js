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
      const { user_id } = req.params;
      const user = await userService.getUser(user_id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('사용자 조회 에러:', error);
      res.status(500).json({
        success: false,
        message: '사용자 조회 중 오류가 발생했습니다.'
      });
    }
  }

  async updateUser(req, res) {
    try {
      const { user_id } = req.params;
      console.log('user_id : ', user_id);
      await userService.updateUser(user_id, req.body);
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
      const { user_id } = req.params;
      await userService.deleteUser(user_id);
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