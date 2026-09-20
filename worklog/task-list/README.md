# Task List

작업 기록과 검증 산출물은 다음 구조로 관리한다.

```text
worklog/task-list/MM/DD/<업무>/
├── TASK.md
├── TASK-02.md        # 추가 검수 기록이 있을 때
└── artifacts/        # 패치, 핸드오프, 검토 초안 등 보조 산출물
```

`staging`, 저장소 이름, `worklog/task-list`를 다시 포함한 중첩 디렉터리는 만들지 않는다.
제품·법무·아키텍처 정본은 각각 해당 문서 영역에 두며, 이 디렉터리는 작업 범위와
검증 결과를 보관하는 비정본 작업 기록이다.

## 2026-09-20

- [Lightsail·Cloudflare 운영 준비와 실제 앱 R2 연동](09/20/infrastructure-setup/TASK-01.md) — task별 수행 내용·증거·미검증 범위·다음 시작점
- [Access 설정 확인과 운영자 매핑 연결 준비](09/20/infrastructure-setup/TASK-02.md) — INFRA-14 후속, 설정·공개키 확인 및 활성 운영자 목록 구현
- [Access 설정 검사 결과와 내부 인증키 준비](09/20/infrastructure-setup/TASK-03.md) — 활성 운영자 설정 검사 통과, 내부 키 생성 도구 검증 및 실제 생성 대기
- [내부 인증키 생성 확인과 DB 비밀번호 파일 입력 준비](09/20/infrastructure-setup/TASK-04.md) — 내부 키 생성 PASS, DB 역할별 파일 입력 구현·격리 검증 및 운영 비밀번호 생성 대기
- [DB 비밀번호 생성 확인과 PostgreSQL 역할·백업 격리 검증](09/20/infrastructure-setup/TASK-05.md) — DB 키 생성 사용자 PASS, 실제 migration·앱 권한·backup dump/restore 및 Docker 통합 통과, 서버 적용 전
- [Lightsail 상태 확인과 PostgreSQL 단독 설치 준비](09/20/infrastructure-setup/TASK-06.md) — 2GB 서버 상태 사용자 확인, SSH 설치 도구·DB Compose·재실행·데이터 보존 격리 검사 통과, 실제 서버 설치 대기
- [Lightsail DB 설치 확인과 초기 앱 migration 준비](09/20/infrastructure-setup/TASK-07.md) — 서버 DB 설치 사용자 PASS, amd64 API image·초기 migration·권한·재실행 격리 검사 통과, 서버 migration 대기
- [Docker image 검증 오탐 수정](09/20/infrastructure-setup/TASK-08.md) — Docker API의 빈 Config 항목 생략 보정, 서버 image 읽기 전용 대조 통과, 실제 migration 재실행 대기
- [서버 migration 완료와 공개 연락처 준비](09/20/infrastructure-setup/TASK-09.md) — V001–V005·역할 권한 사용자 PASS, 앱 기동 필수 연락처 입력 양식 준비, 정책 확정·앱 배포 대기
- [공개 연락처 확인과 M0 정책 검토 준비](09/20/infrastructure-setup/TASK-10.md) — 연락처 5개 로컬 검사 사용자 PASS, 발행 전 검토표 작성, 실제 메일 서비스·정책 확정 대기
- [M0 간결한 정책 본문과 로컬 검토 도구](09/20/infrastructure-setup/TASK-11.md) — Gmail 수신 반영, 책임 범위·간결한 정책 초안, 연락처 자동 반영 도구 격리 검사 PASS, 본문 검토·발행 대기
- [Web·Core 운영 입력과 앱 Compose 준비](09/20/infrastructure-setup/TASK-12.md) — 기존 실값 읽기 전용 검사·키 분리·Compose·격리 Node 주입 PASS, 개인 입력 묶음 생성·image·기동·배포 대기
- [운영 입력 생성 확인과 amd64 앱 image 준비](09/20/infrastructure-setup/TASK-13.md) — 설정 묶음 사용자 PASS, Web·Core build·격리 통합·archive 해시/OCI 연결 검증 PASS, 서버 배포 대기
- [Web·Core 서버 보관 도구 준비](09/20/infrastructure-setup/TASK-14.md) — 서버 읽기 전용 확인, image·설정 설치 도구·재실행·Linux secret 읽기 PASS, 실제 설치·기동 대기
- [서버 앱 보관 완료와 Nginx 연결 구성 검사](09/20/infrastructure-setup/TASK-15.md) — 서버 설치 표시·권한 재확인, Web 전용 gateway·주소 변경·요청/로그 경계 격리 PASS, 공개 연결 전
- [실제 서버 Nginx 설치·기동과 잔여 확인](09/20/infrastructure-setup/TASK-16.md) — Nginx healthy, Web created·미기동, DB 유효 정책 0개 readback, 실제 앱 기동·Tunnel 전환·백업 잔여
- [운영 DB 정책 초안 등록과 초기 데이터 SQL 연결](09/20/infrastructure-setup/TASK-17.md) — DRAFT 2개 실제 등록·본문 해시·app 역할 readback PASS, migration 후 seed 단계 추가, EFFECTIVE 발행 대기

- [최초 시행일 확정과 최소 보관 기준 반영](09/20/infrastructure-setup/TASK-18.md) — 2026-09-20 시행일·목적 종료 후 파기 기준, DB draft.2 추가·기존 초안 보존 readback PASS, 정식 발행·앱 기동 미완료

- [정책 정식 발행과 Lightsail 운영 배포](09/20/infrastructure-setup/TASK-19.md) — 공개 HTTPS·정책·컨테이너·예약 작업·로그 TTL·암호화 R2 백업과 복원 PASS, 관리자 TOTP 입력 대기

- [배포 작업 기록 정리와 운영 문서 현행화](09/20/infrastructure-setup/TASK-20.md) — 현재 상태·미검증 경계 정리, 누적 배포 변경 검증과 커밋

## 2026-08-13

- [AI 협업 체계 검토](08/13/ai-governance/TASK.md)
- [AI 협업 체계 독립 재검수](08/13/ai-governance/TASK-02.md)
- [문서 정보 중립화](08/13/document-sanitization/TASK.md)
- [민감 로그 긴급 차단](08/13/security-hotfix/TASK.md)
