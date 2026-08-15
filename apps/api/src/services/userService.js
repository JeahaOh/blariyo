const pool = require('../config/database');
const PasswordUtils = require('../utils/passwordUtils');

const USER_COLUMNS = [
  'user_no',
  'user_id',
  'user_pswd',
  'user_nm',
  'email',
  'role_code',
  'status_code',
  'pwd_rst_tkn',
  'login_fail_cnt',
  'reg_dttm',
  'updator_no',
  'upd_dttm',
  'lst_accss_dttm',
].join(', ');

class UserService {
  static async register(userData) {
    const client = await pool.connect();
    try {
      if (!['USR', 'ADM'].includes(userData.role_code)) {
        userData.role_code = 'USR';
      }
      userData.status_code = 'ACT';

      if (!userData.user_id || !userData.user_pswd || !userData.user_nm) {
        throw new Error('필수 필드가 누락되었습니다.');
      }

      const existingUser = await client.query(
        'SELECT user_id FROM tu_user WHERE user_id = $1',
        [userData.user_id]
      );

      if (existingUser.rowCount > 0) {
        throw new Error('사용할 수 없는 ID입니다.');
      }

      const hashedPassword = await PasswordUtils.hashPassword(userData.user_pswd);

      await client.query(
        `INSERT INTO tu_user (
          user_id, user_pswd, user_nm, email, role_code, status_code,
          reg_dttm, upd_dttm
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          userData.user_id,
          hashedPassword,
          userData.user_nm,
          userData.email || null,
          userData.role_code,
          userData.status_code,
        ]
      );

      return userData.user_id;
    } finally {
      client.release();
    }
  }

  static async getUser(userId) {
    try {
      const result = await pool.query(
        `SELECT ${USER_COLUMNS} FROM tu_user WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('사용자 조회 서비스 에러:', error);
      throw error;
    }
  }

  static async updateUser(userId, updateData) {
    const client = await pool.connect();
    try {
      const updateFields = [];
      const params = [];
      const addUpdate = (column, value) => {
        params.push(value);
        updateFields.push(`${column} = $${params.length}`);
      };

      const allowedFields = [
        'user_pswd',
        'user_nm',
        'email',
        'role_code',
        'status_code',
        'login_fail_cnt',
        'updator_no',
      ];

      if (!allowedFields.some((field) => updateData[field] !== undefined)) {
        throw new Error('수정할 데이터가 없습니다.');
      }

      if (updateData.user_pswd !== undefined) {
        addUpdate('user_pswd', await PasswordUtils.hashPassword(updateData.user_pswd));
      }
      if (updateData.user_nm !== undefined) {
        addUpdate('user_nm', updateData.user_nm);
      }
      if (updateData.email !== undefined) {
        addUpdate('email', updateData.email || null);
      }
      if (updateData.role_code !== undefined) {
        if (!['GST', 'USR', 'ADM', 'SAD'].includes(updateData.role_code)) {
          throw new Error('유효하지 않은 권한 코드입니다.');
        }
        addUpdate('role_code', updateData.role_code);
      }
      if (updateData.status_code !== undefined) {
        if (!['ACT', 'DOR', 'LCK', 'WDR', 'FWD'].includes(updateData.status_code)) {
          throw new Error('유효하지 않은 상태 코드입니다.');
        }
        addUpdate('status_code', updateData.status_code);
      }
      if (updateData.login_fail_cnt !== undefined) {
        addUpdate('login_fail_cnt', updateData.login_fail_cnt);
      }
      if (updateData.updator_no !== undefined) {
        addUpdate('updator_no', updateData.updator_no);
      }

      params.push(userId);
      const result = await client.query(
        `UPDATE tu_user
         SET ${updateFields.join(', ')}, upd_dttm = NOW()
         WHERE user_id = $${params.length}`,
        params
      );

      if (result.rowCount === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return { user_id: userId };
    } finally {
      client.release();
    }
  }

  static async deleteUser(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT ${USER_COLUMNS} FROM tu_user WHERE user_id = $1`,
        [userId]
      );

      if (result.rowCount === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      const user = result.rows[0];
      switch (user.status_code) {
        case 'DOR':
          throw new Error('휴면 상태의 사용자는 탈퇴할 수 없습니다.');
        case 'LCK':
          throw new Error('잠금 상태의 사용자는 탈퇴할 수 없습니다.');
        case 'WDR':
          throw new Error('사용자를 찾을 수 없습니다.');
      }

      const updateResult = await client.query(
        `UPDATE tu_user
         SET status_code = 'WDR', updator_no = $1, upd_dttm = NOW()
         WHERE user_id = $2`,
        [user.updator_no, userId]
      );

      if (updateResult.rowCount === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return true;
    } finally {
      client.release();
    }
  }
}

module.exports = UserService;
