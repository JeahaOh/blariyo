const AuthService = require('../services/authService');
const { ApiError } = require('../utils/errorHandler');

class AuthController {
    constructor() {
        this.authService = new AuthService();
    }

    login = async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const result = await this.authService.login(email, password);
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