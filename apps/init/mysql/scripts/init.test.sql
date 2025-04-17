-- 문자셋 설정
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_client = utf8mb4;
SET character_set_results = utf8mb4;
SET collation_connection = utf8mb4_unicode_ci;

-- 테스트 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS blariyo_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테스트 사용자 생성 및 권한 부여
DROP USER IF EXISTS 'blariyo_test'@'localhost';
DROP USER IF EXISTS 'blariyo_test'@'%';
CREATE USER 'blariyo_test'@'%' IDENTIFIED BY 'test1020';
GRANT ALL PRIVILEGES ON blariyo_test.* TO 'blariyo_test'@'%';
FLUSH PRIVILEGES;

-- 데이터베이스 선택
USE blariyo_test;

-- 공통 코드 그룹 테이블 생성
CREATE TABLE IF NOT EXISTS TC_CODE_GROUP (
    code_group VARCHAR(20) NOT NULL PRIMARY KEY COMMENT '코드 그룹',
    code_group_nm VARCHAR(100) NOT NULL COMMENT '코드 그룹명',
    code_group_desc VARCHAR(500) COMMENT '코드 그룹 설명',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    sort_ord INT NOT NULL DEFAULT 0 COMMENT '정렬 순서',
    creator_no BIGINT COMMENT '생성자 번호',
    reg_dttm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    updator_no BIGINT COMMENT '수정자 번호',
    upd_dttm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 공통 코드 테이블 생성
CREATE TABLE IF NOT EXISTS TC_CODE (
    code_group VARCHAR(20) NOT NULL COMMENT '코드 그룹',
    code VARCHAR(20) NOT NULL COMMENT '코드',
    code_nm VARCHAR(100) NOT NULL COMMENT '코드명',
    code_desc VARCHAR(500) COMMENT '코드 설명',
    parent_code VARCHAR(20) COMMENT '상위 코드',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    sort_ord INT NOT NULL DEFAULT 0 COMMENT '정렬 순서',
    creator_no BIGINT COMMENT '생성자 번호',
    reg_dttm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    updator_no BIGINT COMMENT '수정자 번호',
    upd_dttm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    PRIMARY KEY (code_group, code),
    FOREIGN KEY (code_group) REFERENCES TC_CODE_GROUP(code_group),
    FOREIGN KEY (code_group, parent_code) REFERENCES TC_CODE(code_group, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS TU_USER (
    user_no BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '사용자 번호',
    user_id VARCHAR(50) NOT NULL UNIQUE COMMENT '사용자 ID',
    user_pswd VARCHAR(255) NOT NULL COMMENT '비밀번호',
    user_nm VARCHAR(100) NOT NULL COMMENT '사용자 이름',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '이메일',
    role_code VARCHAR(20) NOT NULL COMMENT '권한 코드',
    status_code VARCHAR(20) NOT NULL COMMENT '상태 코드',
    pwd_rst_tkn VARCHAR(100) COMMENT '비밀번호 재설정 토큰',
    login_attempts TINYINT UNSIGNED DEFAULT 0 COMMENT '로그인 시도 횟수',
    reg_dttm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    updator_no BIGINT COMMENT '수정자 번호',
    upd_dttm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    lst_accss_dttm DATETIME DEFAULT NULL COMMENT '최근 접속일',
    INDEX idx_user_id (user_id),
    INDEX idx_email (email),
    INDEX idx_status (status_code),
    INDEX idx_pwd_rst_tkn (pwd_rst_tkn),
    FOREIGN KEY (updator_no) REFERENCES TU_USER(user_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 코드 그룹 데이터 삽입
INSERT INTO TC_CODE_GROUP (code_group, code_group_nm, code_group_desc) VALUES
('USR_ROLE', '사용자 권한', '사용자의 권한을 나타내는 코드'),
('USR_STAT', '사용자 상태', '사용자의 상태를 나타내는 코드');

-- 기본 코드 데이터 삽입
INSERT INTO TC_CODE (code_group, code, code_nm, code_desc) VALUES
('USR_ROLE', 'GST', '비회원', '비회원 사용자'),
('USR_ROLE', 'USR', '일반 사용자', '일반 사용자'),
('USR_ROLE', 'ADM', '관리자', '시스템 관리자'),
('USR_ROLE', 'SAD', '슈퍼 관리자', '최고 관리자'),
('USR_STAT', 'ACT', '활성', '정상 사용 중인 상태'),
('USR_STAT', 'DOR', '휴면', '장기간 미접속 상태'),
('USR_STAT', 'WDR', '탈퇴', '사용자가 직접 탈퇴한 상태'),
('USR_STAT', 'FWD', '강제 탈퇴', '관리자가 강제로 탈퇴시킨 상태'); 