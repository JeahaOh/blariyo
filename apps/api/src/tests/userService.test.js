const UserService = require('../services/userService');
const pool = require('../config/database');
const bcrypt = require('bcrypt');

// 환경 변수 설정
process.env.JWT_SECRET = 'test_secret_key';
process.env.JWT_EXPIRES_IN = '1h';

// 데이터베이스 연결 모의 객체 생성
jest.mock('../config/database', () => ({
  getConnection: jest.fn(),
  execute: jest.fn()
}));

// bcrypt 모킹
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}));

describe('UserService', () => {
  let mockConnection;

  beforeEach(() => {
    // 연결 모의 객체 초기화
    mockConnection = {
      execute: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('새로운 사용자 등록 성공', async () => {
      const userData = {
        user_id: 'test_user',
        user_pswd: 'Test123!@#',
        user_nm: '테스트 사용자',
        email: 'test@example.com',
        role_code: 'USER',
        status_code: 'ACTIVE'
      };

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await UserService.register(userData);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          userData.user_id,
          expect.any(String), // 해시된 비밀번호
          userData.user_nm,
          userData.email,
          userData.role_code,
          userData.status_code
        ])
      );
      expect(result).toEqual({ user_id: userData.user_id });
    });
  });

  describe('login', () => {
    it('올바른 로그인 정보로 로그인', async () => {
      const loginData = {
        user_id: 'test_user',
        user_pswd: 'Test123!@#'
      };

      mockConnection.execute.mockResolvedValueOnce([[{
        user_id: loginData.user_id,
        user_pswd: 'hashed_password',
        user_nm: '테스트 사용자',
        email: 'test@example.com',
        role_code: 'USER'
      }]]);

      const result = await UserService.login(loginData);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.any(String),
        [loginData.user_id]
      );
      console.log('result : ', result);
      expect(result).toHaveProperty('token');
      delete result.token;
      
      expect(result).toEqual({
        user_id: loginData.user_id,
        user_nm: '테스트 사용자',
        email: 'test@example.com',
        role_code: 'USER'
      });
    });
  });

  describe('getUser', () => {
    it('사용자 정보 조회 성공', async () => {
      const userId = 'test_user';
      const userData = {
        user_id: userId,
        user_nm: '테스트 사용자',
        email: 'test@example.com',
        role_code: 'USER'
      };

      mockConnection.execute.mockResolvedValueOnce([[userData]]);

      const result = await UserService.getUser(userId);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.any(String),
        [userId]
      );
      expect(result).toEqual(userData);
    });
  });

  describe('updateUser', () => {
    it('사용자 정보 수정 성공', async () => {
      const userId = 'test_user';
      const updateData = {
        user_pswd: 'NewPassword123!@#',
        user_nm: '수정된 테스트 사용자',
        email: 'updated_test@example.com'
      };

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await UserService.updateUser(userId, updateData);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String), // 해시된 비밀번호
          updateData.user_nm,
          updateData.email,
          userId
        ])
      );
      expect(result).toEqual({ user_id: userId });
    });
  });

  describe('deleteUser', () => {
    it('사용자 탈퇴 성공', async () => {
      const userId = 'test_user';

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await UserService.deleteUser(userId);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.any(String),
        [userId, userId]
      );
      expect(result).toBe(true);
    });
  });
}); 