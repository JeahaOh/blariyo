# M0 Core + Spring 수집 보조 완료 조건

이 문서의 체크는 아래 feature 브랜치 구현 당시의 로컬/외부 운영 판정 이력이다.
현재 main의 Nest 전환은 별도 [최종 TASK](../../task_list/09/09/TASK.md) 전체 검증을 요구한다.
현재 결과는 [PROGRESS](../../migration/PROGRESS.md)를 따르며 과거 체크로 Nest 완료를 판정하지 않는다.

- 작성일: 2026-09-08
- 대상: `feature/m0-core`
- 사용자 승인 범위: 아래 1~7 구현·검증, 커밋 금지
- 범위 제외: 목록/feed 자동 수집, 자동 발행, M1 회원, M1.5 익게, 광고 활성화
- 기존 변경: README, DB 연결/마이그레이션 실행, DB 회귀 테스트 보존
- 제품 정본: [서비스 단계](../../planning/01-service-plan.md), [수집 기획](../../planning/content-collection/README.md)
- 기술 정본: [Spring 수집 계약](../../system-design/07-spring-collector-design.md), [수집 명세](../../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md), [보안·운영](../../system-design/05-security-operations.md)
- 법무·공개: [법무 차단 조건](../../legal/README.md)

## 판정 규칙

각 ID는 source/contract/migration/test/build/runtime 증거 및 실행 시각을 기록한다. 문서 작성·mock 통과로 실제 외부 연동이나 운영 전환을 완료 처리하지 않는다. `완료`, `진행`, `미검증`, `차단`을 구분한다. 전체 완료는 아래 모든 필수 조건 충족이다. 구현으로 해소할 수 없는 실제 입력·시간 조건도 삭제하거나 가상 통과로 대체하지 않는다. 배포·운영 연결은 사용자 제공 대상만 사용하며 secret·원문 URL·본문·개인정보를 증거에 복사하지 않는다. 커밋·push는 하지 않는다.

## 1. Core 수집 API 확장

- [x] S1-01 nullable execution/result digest/image source digest 및 quota/event/receipt migration. legacy RUNNING·preview 데이터 유지, 임의 backfill 없음. up/down·권한 확인.
- [x] S1-02 LEGACY_V1/SPRING_V2 credential·scope·전환 mode. 두 계약의 신규 실행 동시 활성 거부, 관리자 권한과 분리.
- [x] S1-03 claim/heartbeat/result/preview 2xx 7일 replay. 같은 key 다른 요청 409, 429/503은 재평가 가능. claim receipt에 URL/제목 없음.
- [x] S1-04 execution ID·version·lease·terminal fencing. stale 요청은 DB/object/quota를 변경하지 않음. PREVIEW_REFRESH는 NEW의 이미지만 재처리.
- [x] S1-05 status/execution-state/reservation/operational-event API와 BFF allowlist·OpenAPI·생성 계약 동기화. GET은 최소 정보·no-store.
- [x] S1-06 100개 동시 quota 요청·KST 날짜 경계·same-key replay·source 변경 검사. robots/detail/redirect/image/HEAD 각각 차감.
- [x] S1-07 기존 Core·legacy 회귀 + V2 실제 PostgreSQL/HTTP 계약 테스트 실패·skip 0.

## 2. Spring 서버와 전용 DB

- [x] S2-01 apps/collector 독립 Gradle/JDK 25·Boot/Batch/Quartz/jsoup/JDA 버전 실제 확인, wrapper checksum·dependency lock·SBOM·build.
- [x] S2-02 별도 물리 PostgreSQL의 batch/quartz/collector migration, production startup DDL 금지, 메타데이터 재시작 유지.
- [x] S2-03 loopback 18787만 bind, REST bearer scope/JSON/body 상한/멱등/오류 envelope, cookie/CORS 없음.
- [ ] S2-04 collectorId·자격·spool key Keychain 저장 경계, 원문/secret 미기록. 설정 누락은 fail closed.
- [ ] S2-05 liveness/readiness 및 Core/Discord 부분 장애 구분. 앱 기동·인증·재시작 runtime 검증.

## 3. 단일 후보 end-to-end

- [x] S3-01 CollectorRunService가 유일한 진입, jobRequestId 식별 Job, 기본 active 1/FIFO·중복 요청 처리.
- [x] S3-02 6개 Tasklet Step resolve/claim/fetch/result/preview/finalize, service DB 직접 접근 없음.
- [x] S3-03 승인 출처·robots·DNS/SSRF·동일 host redirect 3회·크기·시간 제한. private/loopback/link-local/metadata·DNS rebinding 차단.
- [x] S3-04 외부 요청마다 Core quota 예약, network 시작 후 기존 예약 재송신 금지, parser 결과 최소화.
- [x] S3-05 REST→Spring→BFF→Core→비공개 preview→관리자 검수→초안→별도 수동 발행 실제 격리 E2E.

## 4. 장애 복구

- [x] S4-01 claim/heartbeat/reservation/result/preview commit 응답 유실 각각 same-key replay·7일 이후 digest reconcile.
- [x] S4-02 각 Step 전후 실제 process kill/restart. 다른 owner·반려·승격이면 즉시 중단, 추측 mutation 없음.
- [ ] S4-03 AES-256-GCM spool, nonce·SHA-256·0700/0600·Keychain 잠금/훼손·TTL. result 7일/image 24시간 최대, 성공/terminal 즉시 삭제.
- [x] S4-04 이미지별 중단·NEW preview refresh·고아 회수·탈취/경합 검증. URL·title·binary·절대 경로가 metadata/log에 없음.
- [x] S4-05 local DB 복구 뒤 자동 실행 차단 및 Core 권위 상태 reconcile, 일시 실패와 RECONCILE_REQUIRED 구분.

## 5. Discord와 Quartz

- [ ] S5-01 허용 guild/channel/user/role·확인 interaction 후 /collect url 실행, /collect status는 읽기만. 일반 메시지 수집 없음.
- [x] S5-02 REST/Discord/Quartz 공통 submit·동시 요청·중복 방어. Quartz JDBC/Asia-Seoul/15분/DO_NOTHING/기본 off/한 fire 한 후보.
- [ ] S5-03 stop·SIGTERM 90초·heartbeat·신규 network 차단, 절전 복귀 폭주 없음.
- [x] S5-04 알림 즉시+1/5/15분 재시도·FINAL_FAILED, Core event 한 번 반영, 알림 실패가 후보 성공을 취소하지 않음.
- [x] S5-05 synthetic Discord/Quartz 계약·단절 runtime 검증. 라이브 Discord 증거는 S7에 별도 기록.

## 6. 설치·운영·복구

- [x] S6-01 설치/제거·launchd 템플릿과 검증기, RunAtLoad/backoff/고정 경로/umask077/로그 회전/Keychain/SIGTERM. secret plist 저장 금지.
- [x] S6-02 전용 local DB 암호화 daily backup 최근 7개·격리 restore·reconcile 검증. 운영 경로·계정 적용 증거 별도.
- [x] S6-03 metric/log 보존·오류·quota·spool·dependency·알림 관측 및 민감정보 비노출 검사.
- [x] S6-04 Core 회귀 0실패/0skip·브라우저·Docker·복구, collector down 중 공개 조회·관리자 수동 발행 정상.
- [ ] S6-05 실제 Core R2/Access/CDN purge/cron/알림/암호화 원격 backup·전체 서버 복구, 법무 실값·정책 artifact 검증.

## 7. 운영 전환

- [ ] S7-01 실제 출처 이용 조건/robots/selector/interval/daily quota/User-Agent 연락처, Discord 대상·실행 PC·계정·설치 경로 확인.
- [ ] S7-02 Python 신규 claim 중지, 진행 lease drain, 기존 preview TTL 정리 확인. 운영 데이터 임의 삭제·해시 backfill 금지.
- [ ] S7-03 drain 사전 검사 뒤 strict DB CHECK 추가/검증. 실패하면 Spring mutation 활성화 금지.
- [ ] S7-04 Spring REST→Discord→Quartz 순서로 실제 E2E 확인, 두 credential 동시 claim 금지, rollback 수동 Core 유지.
- [ ] S7-05 7일 실제 관찰(시작/종료 시각·일별 실패/복구·quota·알림·운영자 확인). fixture clock 전진으로 대체 금지.
- [ ] S7-06 관찰 통과 뒤 legacy credential 폐기, 운영자 go-live 승인과 현재 정본 상태 반영. 기존 Python 파일 삭제는 별도 명시 요청 전 보존.

## 증거와 진행 상태

| 단계 | 상태 | 현재 증거 / 남은 조건 |
| --- | --- | --- |
| 1 | 로컬 검증 완료 | V005 up/down·권한·7일 receipt·소유권/버전/lease fence·100개 quota 경쟁·KST 경계·보존·strict 전환·계약 동기화. Core/legacy/V2 50 통과 |
| 2 | 진행 | 별도 DB·서버·로컬 인증·본문 제한·멱등·Core 단절 partial·지표 구현/검증. 실제 Keychain 잠금·운영 계정 기동·실제 Discord 단절 상태는 미검증 |
| 3 | 로컬 검증 완료 | 6 Step→BFF→Core→비공개 preview→브라우저 검수·초안·수동 발행. TLS·DNS 재연결·크기/20초 제한·3회 redirect와 요청별 quota 통과 |
| 4 | 진행 | 12개 Step 전후 kill, commit 응답 유실 5종·7일 만료, owner/반려/초안 승격 후 중단, 다중 이미지 중단·refresh, restore gate·조정 통과. 실제 Keychain 잠금 상태 시험은 운영 계정에서 필요 |
| 5 | 진행 | Quartz 실제 fire, synthetic Discord·공통 queue·알림 재시도·Core event, 100개 동일 요청, active SIGTERM 90초 내 종료 통과. 라이브 Discord interaction·실제 절전 복귀는 미검증 |
| 6 | 진행 | 암호화 실제 dump/격리 restore·8개 중 최근 7개 보존·launchd 렌더러·로그/지표·브라우저 9·Docker 통과. 운영 PC 설치·실제 daily backup·Core 외부 서비스/전체 서버 복구·법무 실값 검증 필요 |
| 7 | 차단 | 승인 출처·Discord·실행 PC/계정 설정, 운영 전환, 실제 7일 관찰·go-live 승인 필요 |

체크된 항목은 격리 환경의 구현/검증 범위다. S7 운영 완료를 뜻하지 않는다. 미체크 항목의 세부 완료 범위는 [검증 기록](evidence.md)에 기록했다. 실제 계정·연동·관찰 시간을 fixture나 임의 값으로 대체하지 않는다.
