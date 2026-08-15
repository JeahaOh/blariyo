const { generateToken } = require('jsonwebtoken');
const { ApiError } = require('../middlewares/errorHandler');
const userService = require('./userService');
const PasswordUtils = require('../utils/passwordUtils');

class AuthService {
  login = async (user_id, user_pswd) => {
    try {
      const user = await userService.getUser(user_id);
      if (!user) {
        throw new ApiError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      const hashedPassword = await PasswordUtils.hashPassword(user.user_pswd);

      const isPasswordValid = await PasswordUtils.comparePassword(user_pswd, hashedPassword);

      if (!isPasswordValid) {
        throw new ApiError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      const token = generateToken(user);
      return {
        success: true,
        message: '로그인 성공',
        data: {
          token,
          user: {
            user_no: user.user_no,
            user_id: user.user_id,
            user_nm: user.user_nm,
            email: user.email,
            role_code: user.role_code,
            status_code: user.status_code,
          },
        },
      };
    } catch (error) {
      throw error;
    }
  };

  logout = async () => {
    return {
      success: true,
      message: '로그아웃 성공',
    };
  };
}

module.exports = AuthService;
