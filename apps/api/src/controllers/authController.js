const AuthService = require('../services/authService');
// const { ApiError } = require('../middlewares/errorHandler');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  login = async (req, res, next) => {
    try {
      const { user_id, user_pswd } = req.body;
      const result = await this.authService.login(user_id, user_pswd);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      const result = await this.authService.logout();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AuthController();
