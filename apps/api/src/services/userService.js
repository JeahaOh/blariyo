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

      userData.status_code = 'ACT';

      // 필수 필드 검증
      if (!userData.user_id || !userData.user_pswd || !userData.user_nm || !userData.role_code || !userData.status_code) {
        throw new Error('필수 필드가 누락되었습니다.');
      }

      // 중복 사용자 확인
      const [existingUser] = await connection.execute(
        'SELECT user_id FROM TU_USER WHERE user_id = ?',
        [userData.user_id]
      );

      if (existingUser.length > 0) {
        throw new Error('사용할 수 없는 ID입니다..');
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
          userData.email || null,
          userData.role_code,
          userData.status_code
        ]
      );

      return userData.user_id;
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

      if (rows[0].status_code !== 'LCK' || user.login_fail_cnt >= 5) {
        throw new Error('비밀번호 5회 이상 실패로 인한 계정 잠금 상태입니다.');
      }

      const user = rows[0];
      const isPasswordValid = await this.comparePassword(user_pswd, user.user_pswd);

      if (!isPasswordValid) {

        await connection.execute(
          'UPDATE TU_USER SET login_fail_cnt = login_fail_cnt + 1 WHERE user_no = ?',
          [user.user_no]
        );

        if (user.login_fail_cnt >= 5) {
          await connection.execute(
            'UPDATE TU_USER SET status_code = "LCK" WHERE user_no = ?',
            [user.user_no]
          );
          throw new Error('비밀번호 5회 이상 실패로 인한 계정 잠금 상태입니다.');
        }

        throw new Error('사용자를 찾을 수 없습니다.');
      }

      await connection.execute(
        'UPDATE TU_USER SET lst_accss_dttm = NOW(), login_fail_cnt = 0 WHERE user_no = ?',
        [user.user_no]
      );

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

  static async getUser(user_id) {
    console.log('user_id : ', user_id);
    try {
      const [rows] = await pool.execute(
        'SELECT user_no, user_id, user_nm, email, role_code, status_code, pwd_rst_tkn, login_fail_cnt, reg_dttm, updator_no, upd_dttm, lst_accss_dttm FROM TU_USER WHERE user_id = ?',
        [user_id]
      );
      
      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      console.error('사용자 조회 서비스 에러:', error);
      throw error;
    }
  }

  static async updateUser(user_id, updateData) {
    const connection = await pool.getConnection();
    try {
      let updateFields = [];
      let params = [];

      // 수정 가능한 필드들
      const allowedFields = [
        'user_pswd',
        'user_nm',
        'email',
        'role_code',
        'status_code',
        'login_fail_cnt',
        'updator_no'
      ];

      // 수정할 필드가 있는지 확인
      const hasUpdates = allowedFields.some(field => updateData[field] !== undefined);
      if (!hasUpdates) {
        throw new Error('수정할 데이터가 없습니다.');
      }

      // 각 필드에 대한 업데이트 처리
      if (updateData.user_pswd !== undefined) {
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

      if (updateData.role_code) {
        if (!['GST', 'USR', 'ADM', 'SAD'].includes(updateData.role_code)) {
          throw new Error('유효하지 않은 권한 코드입니다.');
        }
        updateFields.push('role_code = ?');
        params.push(updateData.role_code);
      }

      if (updateData.status_code !== undefined) {
        if (!['ACT','DOR','LCK','WDR','FWD'].includes(updateData.status_code)) {
          throw new Error('유효하지 않은 상태 코드입니다.');
        }
        updateFields.push('status_code = ?');
        params.push(updateData.status_code);
      }

      if (updateData.login_fail_cnt) {
        updateFields.push('login_fail_cnt = ?');
        params.push(updateData.login_fail_cnt);
      }

      if (updateData.updator_no) {
        updateFields.push('updator_no = ?');
        params.push(updateData.updator_no);
      }

      // 수정 시간 업데이트
      updateFields.push('upd_dttm = NOW()');
      
      // 쿼리 실행
      const [result] = await connection.execute(
        `UPDATE TU_USER SET ${updateFields.join(', ')} WHERE user_id = ?`,
        [...params, user_id]
      );

      if (result.affectedRows === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return { user_id };
    } finally {
      connection.release();
    }
  }

  static async deleteUser(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await pool.execute(
        'SELECT user_no, user_id, user_nm, email, role_code, status_code, pwd_rst_tkn, login_fail_cnt, reg_dttm, updator_no, upd_dttm, lst_accss_dttm FROM TU_USER WHERE user_id = ?',
        [userId]
      );

      if (rows.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      const user = rows[0];
      console.log('user : ', user);

      switch (user.status_code) {
        case 'DOR':
          throw new Error('휴면 상태의 사용자는 탈퇴할 수 없습니다.');
        case 'LCK':
          throw new Error('잠금 상태의 사용자는 탈퇴할 수 없습니다.');
        case 'WDR':
          throw new Error('탈퇴 상태의 사용자는 탈퇴할 수 없습니다.');
      }

      // @TODO 탈퇴 요청자 user_no 가져오는 로직 필요.
      const [result] = await connection.execute(
        'UPDATE TU_USER SET status_code = "WDR", updator_no = ?, upd_dttm = NOW() WHERE user_id = ?',
        [user.updator_no, userId]
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