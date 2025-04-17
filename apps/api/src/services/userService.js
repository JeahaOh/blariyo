const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserService {
  static async hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static async register(userData) {
    const connection = await pool.getConnection();
    try {
      // role_code 기본값 설정
      if (!['USER', 'ADMIN'].includes(userData.role_code)) {
        userData.role_code = 'USER';
      }

      userData.status_code = 'ACTIVE';

      // 필수 필드 검증
      if (!userData.user_id || !userData.user_pswd || !userData.user_nm || !userData.role_code) {
        throw new Error('필수 필드가 누락되었습니다.');
      }

      const hashedPassword = await this.hashPassword(userData.user_pswd);

      console.log('userData : ', userData);
      
      const [result] = await connection.execute(
        `INSERT INTO TU_USER (
          user_id, user_pswd, user_nm, email, role_code, status_code,
          reg_dttm, upd_dttm
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userData.user_id,
          hashedPassword,
          userData.user_nm,
          userData.email || null, // email이 없으면 null로 설정
          userData.role_code,
          userData.status_code
        ]
      );

      return { user_id: userData.user_id };
    } finally {
      connection.release();
    }
  }

  static async login(user_id, user_pswd) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM TU_USER WHERE user_id = ?',
        [user_id]
      );

      console.log('rows : ', rows);

      if (rows.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      const user = rows[0];
      const isPasswordValid = await this.comparePassword(user_pswd, user.user_pswd);

      if (!isPasswordValid) {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }

      const token = jwt.sign(
        { 
          user_id: user.user_id,
          role_code: user.role_code
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return {
        user_id: user.user_id,
        user_nm: user.user_nm,
        email: user.email,
        role_code: user.role_code,
        token
      };
    } finally {
      connection.release();
    }
  }

  static async getUser(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT user_id, user_nm, email, role_code FROM TU_USER WHERE user_id = ? AND del_yn = "N"',
        [userId]
      );

      if (rows.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return rows[0];
    } finally {
      connection.release();
    }
  }

  static async updateUser(userId, updateData) {
    const connection = await pool.getConnection();
    try {
      let updateFields = [];
      let params = [];

      if (updateData.user_pswd) {
        const hashedPassword = await this.hashPassword(updateData.user_pswd);
        updateFields.push('user_pswd = ?');
        params.push(hashedPassword);
      }

      if (updateData.user_nm) {
        updateFields.push('user_nm = ?');
        params.push(updateData.user_nm);
      }

      if (updateData.email) {
        updateFields.push('email = ?');
        params.push(updateData.email);
      }

      if (updateFields.length === 0) {
        throw new Error('수정할 데이터가 없습니다.');
      }

      updateFields.push('mid = ?', 'mdt = NOW()');
      params.push(userId, userId);

      const [result] = await connection.execute(
        `UPDATE TU_USER SET ${updateFields.join(', ')} WHERE user_id = ? AND del_yn = "N"`,
        [...params, userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return { user_id: userId };
    } finally {
      connection.release();
    }
  }

  static async deleteUser(userId) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE TU_USER SET del_yn = "Y", did = ?, ddt = NOW() WHERE user_id = ? AND del_yn = "N"',
        [userId, userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return true;
    } finally {
      connection.release();
    }
  }
}

module.exports = UserService; 