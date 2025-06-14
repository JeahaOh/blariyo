const UserService = require('./userService');
const { generateToken, verifyToken } = require('../utils/jwt');
const { ApiError } = require('../utils/errorHandler');

class AuthService {
    constructor() {
        this.userService = new UserService();
    }

    login = async (email, password) => {
        try {
            const user = await this.userService.getUserByEmail(email);
            if (!user) {
                throw new ApiError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
            }

            const isPasswordValid = await this.userService.verifyPassword(password, user.password);
            if (!isPasswordValid) {
                throw new ApiError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
            }

            const token = generateToken(user);
            return {
                success: true,
                message: '로그인 성공',
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name
                    }
                }
            };
        } catch (error) {
            throw error;
        }
    };

    logout = async () => {
        return {
            success: true,
            message: '로그아웃 성공'
        };
    };
}

module.exports = AuthService; 