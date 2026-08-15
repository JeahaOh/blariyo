// apps/api/src/utils/passwordUtils.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

class PasswordUtils {
  /**
   * 비밀번호를 해시화합니다.
   * @param {string} password - 해시화할 비밀번호
   * @returns {Promise<string>} 해시화된 비밀번호
   */
  static async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * 비밀번호를 검증합니다.
   * @param {string} password - 검증할 비밀번호
   * @param {string} hashedPassword - 해시화된 비밀번호
   * @returns {Promise<boolean>} 비밀번호 일치 여부
   */
  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
}

module.exports = PasswordUtils;
