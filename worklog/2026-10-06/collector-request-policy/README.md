# 수집 요청 정책 변경

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6ae`
- 상태: 종료 / 갱신: 2026-10-06 20:02 KST
- 요청: robots.txt는 참고로만 처리. 요청 간격을 늘리고 일일 한도 완화. source 수정.
- 선행: robots-policy-decision-review 및 batch-failure-delete 종료 확인. 기존 dirty 변경 보존.
- 범위: collector 요청 경로·기본 설정·요청 제한 대기·관련 테스트·기획/설계 동기화.
- 제외: 실제 사이트 재수집·기존 삭제6건 복구·운영 배포·commit/push.
- 기준: robots 자동 조회/허용 판정을 실행 gate에서 제외하고 출처별 명세의 참고 정보 유지. 기본 간격15초·일일5000 HTTP 요청. 별도 출처 설정 유지. 실제403/429·SSRF·일일 한도 보호 유지.
- 검증 예정: collector 단위/격리 DB 테스트, migration 계약 검사, build, diff/문서 링크.

## 변경

- SourceRequests·DiscoveryFetcher·CollectionPipeline 및 Core quota/result 서비스에서 robots 실행 gate 제거. SourcePolicy 해석기·기존 출처 robots 관측값은 참고용으로 유지.
- 단건·목록 CLI 기본15초, 출처에 별도 설정된 간격은 CLI 생략 시 적용. BatchSourceRuntime와 실제 요청기 모두 daily 기본5000/interval 기본15000으로 일치.
- 로컬 `.local-data/development/dev-21-site-publish/sources.json`21개 출처: 일일300→5000, 간격10000→15000ms. 이전 설정은 `.local-data/backups/collector-request-policy-20261006/sources.json`에 보존. 실제 배치는 미실행.
- V015는 기존 요청 budget의 next_allowed_at을 늘리는 제한 함수를 추가한다. 429·긴 Retry-After·HTTP 재시도 소진 시 사용량 보존/새 JVM 대기. 초과 큰 값은 infinity 보류. batch role만 EXECUTE, 직접 budget 테이블 변경 불가.
- 이미지 바깥 재시도는403/429/503에서 즉시 종료. DB 이미지 실패 분류에서도 robots·차단·DNS/일시 HTTP 장애를 제외하여 보류 원문을 삭제하지 않는다. 이미 삭제된6건에는 소급 복구/재수집을 수행하지 않는다.
- 기존 DB robots 값/확인일의 함께 null/값 보유 제약은 유지한다. 참고 정보의 정합성과 실행 gate 제거는 별개다.

## 검증 진행

- 첫 collector 검사293 tests 중3개가 변경된 기본15초와 기존 발견 테스트의10초 옵션 불일치로 실패. 발견 테스트를 새 기본15초로 갱신했고, 별도 명시10초 출처 fixture는 그 설정을 보존한다. 실패를 삭제/skip하지 않았다.
- 실제 격리 PostgreSQL 포함294 tests/81 suites/0 skipped 통과. 테스트 source cooldown 격리 보강 및 최종 소스 재빌드를 추가 검증 중.
- API 첫 검증은 새 robots=false/null fixture의 확인일 조합이 기존 DB 제약과 맞지 않아 실패. false에는 확인일, null에는 null을 설정하고 복원에도 확인일을 유지하도록 fixture를 수정했다. DB 제약은 변경하지 않았다.
- API collection-v2-http8 + collector-lease8 tests 통과. robots false/null에서도 quota replay 허용, robots false에서 성공 결과 저장, 비활성 source/다른 host 거부를 유지.
- 계약 hash 검사1 통과. API build·test build 통과.
- `.mjs`를 TS 전용 eslint 설정에 넘긴 검사는 parser type 정보 오류로 실행 불가. 해당 설정은 수정하지 않고 JS 문법 검사와 실제 격리 DB 실행으로 검증한다.

## 사용자 후속 결정 — 기본5초와 공통 상수

- 사용자가15초를5초로 조정하고 상수화를 요청했다. 앞의15초 검증은 중간 결과이며 최종 기본값이 아니다.
- `SourceRequestPolicy.java`에 기본 간격5000ms·일일5000회·최소1000ms·최대3600000ms·HTTP 최대3회·인라인 최대60초·기본 제한 대기15분을 모았다. CLI·queue·runtime·실제 요청기가 같은 상수/설정 해석을 사용한다.
- 출처 명시값 > 기본 상수. CLI는 출처 간격보다 길게 지정 가능. 실제 응답 제한 시 Retry-After가 우선한다.
- 예제/로컬21개 source 간격을5000ms로 변경했다. 기존 로컬10초·300회 설정 백업은 그대로 보존한다.
- V015는 아직 로컬/운영 DB에 적용하지 않은 이번 작업의 신규 migration이다. 기존 V002/V009를 수정하지 않고 V015에서 interval DB 제약을1000ms 이상으로 변경한다. 기존 V001~V014 checksum은 보존한다.
- DB permit 안전 여유 때문에 설정5초가 모든 실제 송신 간격을 정확히5초로 보장하지는 않는다. 기존 보호 동작을 유지한다.

## 최종 검증 및 로컬 반영

- 최종5초 코드: collector82 suites /296 tests /fail0 /skip0. 실제 PostgreSQL readback20개 포함. bootJar·fixtureClasspath build 통과.
- 실제 loopback HTTP 수신 시각으로5초 이상 간격, 같은 quota의 두 요청 후 한도 초과, 새 요청기의 일일 집계 보존 확인.
- 이미지429는 실제 runner에서 요청1회 후 FAILED 원문 보존·추가 이미지 재시도0·새 DB 연결에서도1시간 대기 유지. requestIntervalMs=5000으로 batch_run 저장 확인.
- API collection-v2-http8 + collector-lease8 tests 통과. mailbox는 기존 fixture의 localhost55449 전용 제한을 유지했다. 5439 실행은 ISOLATED_MAILBOX_DATABASE_REQUIRED로 거부됐고 임시 전용 PG18/55449에서 재검증한다. fixture도 수동 V002~009 부분 적용 대신 실제 MigrationMain 전체 경로를 사용하도록 갱신했다.
- 역할 검사 첫 실행은 robots 요청2회 제거로 실제3회를 기존5회와 비교하던 기대값에서 실패했다. 정책 변경 근거와 함께 정확히3회로 수정했다. 앱/retention/backup의 defer 함수 실행 거부 및 batch의 긴 대기 저장을 추가 검증했다.
- 최종5개 역할 실제접속·수집/중복skip·본문/첨부 readback·권한 경계·정리/게시글 보호·79개table/16개sequence 전체 backup/restore 일치 통과.
- local batch 권한1 test, migration contract1 test 통과. API build/test build, 변경 API/테스트 및 역할 스크립트 lint, JS 문법 검사 통과. Markdown 상대 파일 링크 누락0·diff --check 통과.
- 로컬 V015 적용 및 batch의 defer 함수 EXECUTE 권한 readback 확인. 적용 전후 수집85·첨부409·실패47·검수68·게시글117건 동일. 실제 삭제0, 외부 수집0.
- 로컬 설정파일21개와 참조 예제21개 모두 requestIntervalMs=5000/dailyRequestLimit=5000 검증. 설정 백업 보존.
- 실제 출처에서5초 간격의 차단 여부는 시험하지 않았다. 운영 migration/배포, 소급6건 복구, 새 수집, commit/push 미실행. 로컬 API 프로세스 재시작은 하지 않았다.

- 최종 설정 정리: 참조21개·로컬21개 source에서 공통 기본 간격/한도 중복값을 제거했다. 두 값을 생략하면 SourceRequestPolicy의5초/5000회를 따르며 특정 출처 JSON에 값을 추가하면 그 출처만 override한다. 따라서 공통 상수 변경이 실제 기본 출처들에 적용된다. JSON schema도 간격 생략을 허용하고 명시값은1초~1시간으로 검증한다.

- 전용55449 격리 DB의 mailbox8 tests 최종 통과(실제61초 lease 만료 포함). API 최종 합계24 tests 통과. 작업 전용 PostgreSQL container는 종료/제거했고 기존 로컬 DB container는 유지했다.
- 기본값 중복 제거 후 참조 source 등록/JSON schema/readback manifest3 tests 통과. 참조21·로컬21개가 공통 기본값을 상속하는지 확인했다. 이 구성 변경은 네트워크 요청을 실행하지 않았다.
- 변경 경로: `apps/collector/src/main/{java,resources/db/collector-v015.sql}`, 관련 `src/test/java`, `apps/collector/ops/{README.md,sources.schema.json,reference-sites.sources.example.json}`, `apps/api/src/features/collection/collector-{quota,result}.service.ts`, 관련 API3개 테스트, `deploy/postgresql/apply-privileges.sql`, `scripts/local/batch-privileges{,.test}.mjs`, `scripts/test-database-roles.ts`, 수집 planning/system-design/spec/OpenAPI 및 generated contracts/manifest, `docs/status.md`, 이 worklog. 기존 다른 세션/이전 작업 변경은 보존.
- 잔여: 실제 사이트5초 실행의 성공률/차단 여부 관측, 운영 배포, 로컬 API 재시작, 삭제된6건 복구/재수집은 이번에 실행하지 않음. 사용자 요청은 소스/설정 수정이며 새 수집을 수행하지 않았다.
