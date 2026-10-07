# 출처 공통 코드 관리

- 요청: 출처 공통 코드화. 관리자 추가·수정 기능도 포함(사용자 확인).
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 기준 HEAD/release `12df6aed`
- 상태: 종료(구현·검증·로컬 적용 완료) / 갱신: 2026-10-05 19:10 KST
- 앞선 담당: batch-direct-decision 종료 확인. 기존 미커밋 변경 보존.
- 변경 범위: 출처 코드/표시명 DB·API·관리 UI, 검수 선택/표시·초안 출처명 연결, 관련 정본·계약·검증.
- 결정: OWNER 추가/이름 수정, EDITOR 조회. 코드 등록 후 불변. 기존 21개 명세 표시명 초기 등록. 수집 실행 설정과 분리하며 등록이 parser 지원·활성화를 의미하지 않음. 미등록 코드는 원래 코드로 표시. 기존 게시글 출처명은 소급 변경하지 않음.
- 완료 조건: 중복/입력 검증/권한/동시 수정/유실 응답 재조회, 선택 필터와 초안 표시명 저장, 로컬 적용 및 브라우저 검증. 운영 배포·commit/push 미포함.

## 구현 결과

- `content.source_code` V012: 고정 source_key/표시명/수정 버전/생성·수정 감사. 기존21개 명세 seed, 원문 임시 테이블과 분리해 content 백업에 포함.
- `/api/v1/admin/source-codes` GET/POST, 코드별 PATCH. OWNER 추가·수정 / EDITOR 조회. 검증·중복·수정 충돌·유지보수 차단 및 캐시 금지. 수집 feature flag에 종속되지 않음.
- `/admin/source-codes`: 공통 메뉴·추가/이름 수정·오류 입력 보존·최신 목록 재조회, 로그인 후 원래 화면 복귀. 코드/표시명만 다루며 수집 활성화 설정은 변경하지 않음.
- `useSourceCodes`를 검수 화면/실행 설정 조회에 공유. 기존8개 hardcode 제거, 출처명 select·목록·상세 표시 및 미등록 코드 fallback. 새 초안 생성은 현재 공통 명칭을 저장. 기존 게시글 출처명은 그대로 유지.
- readiness: V012 및 테이블 SELECT/INSERT/UPDATE 각각 필수. 기존 DB 버전/권한 누락이면503. V012도 direct/운영 이벤트 준비 검사에서 정상 인식.
- 변경 파일: 신규 migration2개·source-code Controller/Service/Repository/Module 및 TypeORM Repository·공통 composable/관리 페이지/회귀 시험. 기존 app.module/검수 module-service/health/권한 목록/검수·직접수집 UI/관리 메뉴/로그인 복귀 allowlist/관련 명세·생성 계약·migration manifest 수정. 앞선 미커밋 파일은 보존.

## 검증

- API/DB29 tests: 신규 출처7(역할·입력·중복·고정 코드·감사·동시 수정·유지보수·V012 준비/권한 부족), 검수20(공통 출처명 초안 저장 포함), migration2.
- Chromium14 tests: 공통 코드1(추가/수정/경쟁/응답 유실 재조회/선택 반영/1280·390·320px), 역할1(EDITOR UI와 위조 권한403), 검수12(미등록 코드 fallback·출처 선택·검색/페이지·검수 회귀).
- 계약/hash·의존성5 tests, API/Web 빌드 및 Web/테스트/스크립트 타입 검사, 변경 API/Web/브라우저 코드 lint, git diff --check 통과.
- 제한5역할 통합 검사: 별도 임시 PostgreSQL, API12개/Collector10개 migration, batch/API/retention 경계, backup dump·별도DB restore74테이블·16시퀀스 일치.
- 검증 중 발견·수정: CollectionMaintenanceGuard 옵션 주입 누락; Nuxt shallow data의 내부 배열만 교체하면 등록 직후 목록이 갱신되지 않는 문제. 전체 data 객체 교체 후 브라우저 재검증 통과. readiness 권한은 세 권한을 각각 AND로 검사하고 UPDATE만 회수한 시험에서false 확인.
- 최종 로그: `/tmp/blariyo-source-api-final.log`(출처7), `/tmp/blariyo-source-api-tests.log`(검수20/migration2), `/tmp/blariyo-source-browser-final.log`(신규1), `/tmp/blariyo-source-browser-regression.log`(역할/검수13), `/tmp/blariyo-source-roles.log`(5역할/복원), `/tmp/blariyo-source-contracts.log`(계약/구조5). 임시 로그는 커밋 대상 아님.

## 로컬 적용과 잔여

- 준비 도구의 적용 전 DB dump·archive catalog 확인 후 로컬5439 DB에 V012 적용. `.local-data/backups/before-batch-review-1791194943889.dump`; 기존 객체772개 재검증. 보존/회수나 게시글 변경 없음.
- 소유 개발 서버만 재시작, Web3000/Core3100 유지, workers=false. readiness200·Web200·DB 공통 코드21개·API V012 확인.
- 실제 Chrome:21개 관리 화면과 추가/수정 폼, 검수의 출처명21개 선택, 더쿠 선택 후7개 결과 확인. 실사용 로컬 DB에 테스트용 코드나 검수 판단을 추가하지 않음.
- 확인 URL: http://localhost:3000/admin/source-codes (필요 시 개발 관리자 로그인).
- 운영 DB·배포·commit/push 미실행. 새 출처의 스크래핑 adapter/실행 승인과 출처별 만족도 검사는 별도 작업.
