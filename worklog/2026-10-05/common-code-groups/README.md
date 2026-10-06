# 공통코드 그룹과 source 4자리 코드 전환

- 요청: source 그룹에 thqo/pmpu/yldo/invn/dgdp/rlwb 등으로 관리. 메뉴와 화면을 공통코드 관리로 통합.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 기준 HEAD/release `12df6aed`
- 상태: 종료(구현·검증·로컬 적용 완료) / 갱신: 2026-10-05 19:27 KST
- 앞선 source-common-codes 및 source-code-and-batch-navigation-review 종료 확인. 기존 dirty 변경 보존.
- 범위: 공통 그룹/코드 DB·API·UI 및 source 매핑, 초기21개 코드 이관·권한/충돌/검수 호환·문서/계약·로컬 적용.
- source 그룹키 소문자, 출처 코드4자리. 사용자 지정6개 우선, 나머지는 충돌 없는4자리로 배정. 기존 Collector 식별자는 referenceKey 매핑으로 보존.
- 기존 V012 수정 없이 V013 추가. 이관 대상에 미정 매핑이 있으면 중단해 데이터 유실을 막음. 그룹/코드/매핑은 생성 후 고정, 이름 수정에 버전 검사. OWNER 추가·수정/EDITOR 조회.
- 완료 조건: 실제 그룹별 분리·등록/수정·중복/권한/경쟁·기존 source 이름/감사 이관·검수 및 초안 연결·로컬 실행 검증. 운영 배포·commit/push 미포함. 목록으로 버튼은 앞선 검토 결과로 유지하며 이번 그룹 요청에 섞지 않음.

## 구현 결과

- V013: `content.common_code_group`와 `content.common_code`, 그룹/코드 복합 키. source 키는 소문자, 코드는4자리(첫자 영문 소문자, 나머지 소문자/숫자). reference_key로 기존 수집 키 보존. 기존 V012 이름/버전/감사 이관 후 source_code 테이블 대체. V001~V012 체크섬 유지.
- 사용자 지정6개: thqo=더쿠, pmpu=뽐뿌, yldo=율도, invn=인벤, dgdp=개드립, rlwb=루리웹.
- 나머지15개: arca=아카라이브, bbae=보배드림, clin=클리앙, dcid=디시인사이드, dmtr=디미토리, etld=이토랜드, fmkr=에펨코리아, ggag=고급유머, hmun=웃긴대학, inst=인스티즈, mlbp=MLBPARK, ntpn=네이트판, pgr2=PGR21, tdhm=오늘의유머, ytcm=유튜브 커뮤니티.
- 미등록 기존키가 있으면 COMMON_CODES_UNMAPPED_SOURCE_KEY로 이관 transaction을 중단해 원본 보존. down은 COMMON_CODES_ROLLBACK_REQUIRES_HANDOFF로 차단해 다른 그룹/코드 유실 방지.
- 공통코드 관리: 그룹 선택·그룹 추가/그룹명 수정·그룹별 코드 추가/코드명 수정, OWNER 쓰기/EDITOR 조회. source에서만 수집 연결 필수. 이전 URL은 새 화면으로302 이동. 로그인 복귀 allowlist·메뉴·제목 정렬.
- API `/api/v1/admin/common-code-groups` 및 `/{groupKey}/codes`, PATCH는 각키와 lockVersion. 독립 common-codes 기능 모듈에 SQL 없는 Controller/Service/Repository 계약과 TypeORM 구현 배치. collection이 공통코드를 참조하고 역의존 금지.
- useSourceCodes는 source 그룹의 referenceKey를 기존 수집 결과/검색에 연결. 검수·실행 설정·새 초안 이름 매핑 유지. 기존 게시글/원문 식별자/Collector 설정 변경 없음.
- 현행 정본: planning 수집/화면, DB/API/코드구조, 개발Spec/OpenAPI/생성 타입 및 migration evolution manifest 갱신. 기존 source-only API는 미출시 상태에서 그룹 API로 대체.

## 검증

- API/DB29 tests: 공통코드7(이관 실패 무손실·이름/버전/감사 보존·정확한6개코드/21개형식·그룹 분리·그룹/코드 권한·입력·연결중복·불변키·동시 수정·유지보수·준비 권한), 검수20(새 초안 이름 포함), migration2(V012 down 이력 유지/V013 down 거부 포함).
- Chromium14 tests: 공통코드 생성/수정/경쟁/응답 유실·그룹 생성/이름 변경/전환·그룹 간 동일코드 분리·이전URL/로그인 복귀·지정6코드·검수필터·1280/390/320px, EDITOR UI/권한 위조 방어, 기존 검수 회귀.
- 계약/hash·아키텍처5 tests, API/Web 빌드, Web/테스트/스크립트 타입 및 변경 API/Web/테스트 lint, diff whitespace 통과.
- 그룹 독립 모듈 도입에 따른 collection→common-codes 단방향 의존을 설계/아키텍처 검사에 명시했다. 역의존/순환/SQL 경계 검사 유지. 범용 예외나 skip을 추가하지 않음.
- 제한5역할/SCRAM·batch/API/retention·DDL/ledger/역할전환 거부·백업읽기전용·dump/별도DB restore75테이블/16시퀀스 전체 일치.
- 수정한 검증 문제: migrator에 TEMP 권한이 없어 초기 임시 매핑 테이블을 VALUES CTE로 변경(권한 확대 없음). 그룹 select의 명시적 접근성 이름을 연결해 키보드/테스트 선택 정확성 보완. 재실행 통과.
- 로그: `/tmp/blariyo-common-api-tests.log`, `/tmp/blariyo-common-browser-final.log`, `/tmp/blariyo-common-roles.log`, `/tmp/blariyo-common-contracts.log`, `/tmp/blariyo-common-*-types.log`, `/tmp/blariyo-common-*-lint.log`. 임시 로그는 커밋 대상 아님.

## 로컬 적용

- 이관 전 백업 `.local-data/backups/before-batch-review-1791195919985.dump` 및 archive catalog 확인. API V013/Collector V010, 기존 객체772개 readback. source 그룹21개와 지정6코드/연결 SQL 재조회.
- 소유 개발 서버 재시작(Web3000/Core3100), workers=false. readiness200. Chrome 공통코드 관리/source 선택/4자리21개/그룹 폼 및 검수 출처명 연결 확인.
- 사용자 DB에 시험용 그룹·코드를 추가하거나 게시글을 수정하지 않음. 관리 기능 쓰기 검증은 임시 DB에서 수행.
- 확인 URL: http://localhost:3000/admin/common-codes
- commit/push·운영 DB/배포 미실행. 목록으로 버튼은 별도 검토 사항으로 남음.
