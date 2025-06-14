const { ApiError } = require('../utils/errorHandler');

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, '이메일과 비밀번호는 필수입니다.');
    }

    if (!isValidEmail(email)) {
        throw new ApiError(400, '올바른 이메일 형식이 아닙니다.');
    }

    if (password.length < 8) {
        throw new ApiError(400, '비밀번호는 8자 이상이어야 합니다.');
    }

    next();
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

module.exports = {
    validateLogin
}; 