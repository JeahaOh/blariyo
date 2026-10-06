# 2026-10-04 전체 사이트 운영 수집

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 기준 release `12df6ae`
- 상태: 종료(신규 적재 차단) / 갱신: 2026-10-04 17:38 KST
- 요청: 오늘자로 모든 사이트를 스크래핑하여 운영 DB에 적재.
- 기존 변경: production-acceptance 기록 미커밋 상태 보존.
- 변경 경로: 이 작업 기록 및 Git 제외 실행 설정/결과. source·배포 변경은 제외.
- 초기 범위: 등록된 21개 출처, 사이트별 목록 최대 2페이지·고유 후보 10건, 요청 간격 최소 10초·일일 300회 상한. robots/차단/중복 검사 유지.
- 확인 질문: 오늘 작성 글 또는 현재 목록, 검수 대기/초안/공개 상태를 질의했다. 답변 전 기본값은 한국시간 오늘 작성이 확인된 글만 검수 대기 적재다.
- 진행: 운영 API010/Collector010, 기존 collect run43/item108, 공개 글78건. 현재 운영에는 batch login이 없으므로 제한 연결을 먼저 준비한다. DB 공개 포트·API/자동 수집 flag는 변경하지 않는다.

## 실행 결과 — 17:38 KST

- 상태: 종료(요청 결과는 차단, 신규 적재 0건). 다음 담당: 사용자 승인 후 Codex. 잔여: OPS-03/COL-04 백업·회수 운영 인수 후 재수집.
- 기간: 2026-10-04 00:00 KST부터 실행 시각까지 작성일이 확인되는 글. Date policy `REQUIRE_KNOWN`, 후보 10건/사이트·2페이지, 요청 간격 10초·일일 300회. 새 글 전수 수집은 아님.
- 전체 21개 설정을 실행 진입점에서 검사했다. 외부 HTTP 전에 차단되어 실제 사이트 스크래핑·신규 collect item·R2 수집 객체 저장은 모두 0건이다.
- 17개: arcalive, bobaedream, clien, dcinside, dmitory, dogdrip, etoland, goodgag, humoruniv, instiz, inven, mlbpark, natepann, ruliweb, theqoo, todayhumor, yuldo — `BATCH_RETENTION_BACKLOG`.
- 4개: fmkorea, pgr21, ppomppu, youtube-community — 기존 목록 미검증 설정 `CHART_UNVERIFIED` 유지. 미검증 차트를 강제 활성화하지 않았다.
- 실행 시간: 최종 시도 17:36:23~17:36:31 KST. 보고된 run UUID는 시작 전 생성 값이며 DB run으로 commit되지 않았다. 실행 후에도 run43/item108/RUNNING0이다.

## 확인된 운영 차단

- `collect.retention_backlog() = true`.
- retention 108건 중 만료 LIVE 8건. 모두 2026-09-30 만료, 모두 APPROVED 및 post_id 연결 보유. 게시글 사본의 실제 독립성·전체 object inventory는 후속 삭제 전 검증해야 한다.
- `batch_retention_control.selective_backup_verified=false`, receipt hash 없음.
- `blariyo-collect-retention.service`/`.timer`: not-found/inactive. retention 전용 DB role도 없음.
- 현재 권한으로 보존 기한 수정·guard 우회·직접 payload 삭제·새 삭제 서비스 설치를 실행하지 않았다.

| 출처 | 만료 항목 | raw 객체 참조 | media 객체 참조 | 게시글 연결 |
| --- | ---: | ---: | ---: | ---: |
| dcinside | 3 | 3 | 141 | 3 |
| goodgag | 1 | 1 | 3 | 1 |
| inven | 1 | 1 | 10 | 1 |
| theqoo | 1 | 1 | 1 | 1 |
| todayhumor | 1 | 1 | 21 | 1 |
| yuldo | 1 | 1 | 0 | 1 |
| 합계 | 8 | 8 | 176 | 8 |

위 수량은 DB 참조 기준이다. report 및 orphan 객체를 포함한 최종 물리 삭제 수량은 inventory 검증 전 확정하지 않는다.

## 준비·검증·원상 복구

- 적재 전 운영 백업 생성 성공: 17:32:29 KST, 513,843 bytes, SHA-256 `72b3f5bc1d8de734671207c5b9be4a938e779cde4ab84f147e1919d0a51a39b7`. 이 백업은 선택 백업 전환·회수 gate 충족 증거가 아니다. 이번 신규 백업의 별도 격리 복원은 미실행.
- `bootJar` Java25 빌드 성공(UP-TO-DATE). JAR SHA-256 `8affeca8d8761baa7786be209f753f1d60de38dd7a8d164eb5386f5205338acb`.
- 실행 source config SHA-256 `abb248fff86942165d7bcfc8ce93a23b06908058db3393f639424e940b3be2d5`.
- 검증된 소스 runner를 그대로 사용하고 날짜 범위만 10/4 KST 시작으로 전달하는 임시 Java 진입점을 사용했다. source 변경 없음.
- 운영 DB에 없는 `blariyo_batch` role을 일회성 생성: collect 지정 table/function만, public DB 포트 없이 loopback SSH 터널. content INSERT/legal UPDATE 권한 false 확인.
- 기존 HBA 파일을 비공개 백업하고 gateway 한 IP·전용 role에만 허용. 종료 시 세션0/소유 객체0 확인 후 임시 grant/role 회수, HBA 원문 일치·role 부재·RUNNING0 확인. SSH 터널 종료.
- 초기 연결 검증에서 content schema 접근 자체가 거절되어 schema USAGE 거부 검사로 수정했다. 이후 로컬 credential 파서가 숫자를 포함한 변수명을 누락해 `BATCH_OBJECT_STORE_REQUIRED`가 발생했고 외부 요청 전 수정했다. 이 준비 실패들은 수집 성공으로 집계하지 않는다.
- 최종 수집 시도에서는 source 등록 metadata가 갱신될 수 있으나 item/run payload는 추가되지 않았다. 공개 게시글은 78건 유지; DRAFT2/HIDDEN_REVIEW2/SCHEDULED1 유지.
- 종료 전후 content.board_post 전체 행 집계 MD5 동일: `bf4c60948cc1c6e797ce5a8b0dd351f6`. 값·본문을 로그에 출력하지 않고 hash만 비교했다.
- 실행 설정·비밀·사이트별 로그는 Git 제외 `.local-data/production-collection-20261004/`에 제한 권한으로 보관. 비밀 값·원문을 작업 기록에 포함하지 않았다.
- 배포·commit·push·공개 발행 없음. 기존 production-acceptance 미커밋 기록 보존.

## 재개에 필요한 범위

1. [선택 백업 runbook](../../../deploy/backup/SELECTIVE-RUNBOOK.md)에 따라 선택 백업 실다운로드·격리 복원 및 기존 full 원격/로컬 사본 대체 inventory를 검증한다. 검증되지 않은 receipt를 만들거나 gate만 강제로 열지 않는다.
2. [원문 보존 운영 인계](../../../deploy/operations/collect-retention.md)에 따라 제한 retention 계정·객체 권한·dry-run과 게시글 사본/영구 dedup 보호를 검증한다.
3. 사용자 승인 범위에서 만료 원문 회수·object 부재·DB payload 정리 readback을 수행한다. 삭제 범위는 raw8/media176 참조 외 report/orphan inventory를 포함해 최종 확정해야 한다.
4. backlog=false와 수집 쓰기 조건을 확인한 뒤 오늘자 전체 source 시도를 재개한다. 4개 미검증 목록은 별도 소스 검증 없이는 성공으로 처리하지 않는다.

- 이번 요청은 수집/적재이므로 기존 운영 원문·백업 삭제 및 보존 서비스 최초 활성화까지 자동 확대하지 않았다. [AGENTS G08](../../../AGENTS.md)의 범위 구분 및 위 운영 인계의 사용자 활성화 기준을 따른다.

## 19:25 KST 후속 조회 — 만료 8건과 로컬 확인 범위

- 요청: 만료 원문 8건의 정체와 로컬에서 확인 가능한지 설명. 담당·폴더·브랜치 동일, 읽기 전용 조회, 기록 외 변경 없음.
- 운영 재조회: 전부 9/23 수집, 9/30 만료이며 post104~111에 연결. 운영 게시글 8건 모두 PUBLISHED.
- 구버전 이관 자료로 `legacy_review_finalized=true`, `review_finalized_at=NULL`; migration의 과거 review.updated_at 기반 7일 산정이다. 정확한 최초 승인 시각으로 단정하지 않는다.
- 로컬 Docker `blariyo_local` DB5439에 같은 item UUID 8건 모두 존재. 같은 post104~111에 연결하며 post110만 DRAFT, 나머지7건 PUBLISHED. 운영과 로컬 DB의 상태 차이를 확인했다.
- localhost3000 LISTEN 없음. 로컬 웹 서버를 이번 조회에서 시작하지 않았으며 브라우저·이미지 렌더링 검증도 미실행.
- 공개/관리자 게시글 사본을 볼 수 있는 것과 만료 수집 원문 조회는 구분한다. 현행 batch 상세 repository는 만료 lifecycle에410 `BATCH_ITEM_EXPIRED`를 반환하므로 `/admin/batch`에서 원문을 볼 수 있다고 안내하지 않는다.
- 확인 근거: `scripts/local/README.md`, `apps/api/src/persistence/batch-result.repository.ts`, `apps/collector/src/main/resources/db/collector-v007.sql`, 운영/로컬 READ ONLY SQL.
- 상태: 후속 조회 종료. 삭제·복사·수집 재개·배포·commit/push 없음.

## 19:26 KST 후속 설명 — 만료 원문이 신규 수집을 막는 이유

- 요청: 원문 보존기한 만료와 수집 차단의 인과 설명. 읽기 전용 소스/정본 검토; 기록 외 변경 없음.
- 정본 `docs/system-design/02-data-model.md:1261`은 삭제 실패 backlog가 늘지 않도록 새 수집을 중단하고 Core 수동 운영은 유지하도록 정한다.
- 실제 SQL `collector-v008.sql:232`은 source 조건·건수 임계값·유예시간 없이 만료됐고 PURGED가 아닌 항목이 하나라도 있는지 전역 검사한다. PURGE_FAILED뿐 아니라 LIVE/PURGE_PENDING도 포함한다.
- `BatchStore.java:108`에서 true이면 run INSERT 및 외부 HTTP 전에503 BATCH_RETENTION_BACKLOG로 거부한다. 코드의 범위는 명시적 삭제 실패 발생 이후보다 엄격하다.
- 이번 운영 실행의 직접 원인은 만료 LIVE8건이며, 정리 service/timer 미설치와 선택 백업 검증 gate=false는 이 backlog를 해소할 운영 절차가 준비되지 않은 상태다. 백업 gate=false 자체가 위 함수의 직접 판정 조건은 아니다.
- 차단 장치는 운영 적용됐으나 회수 운영 준비가 함께 완료되지 않은 상태로 평가한다. 정책/코드 완화나 삭제는 수행하지 않았다. 상태: 설명 검토 종료.

## 후속 사용자 결정 — 신규 수집과 만료 원문 회수 분리

사용자가 새 원문을 수집하면서 만료 원문을 제거하도록 정책을 변경했다. 앞선 backlog 전역 차단 설명은 당시 코드/운영 결과이며, 새 정책·구현·검증은 [후속 작업](../collection-retention-independence/README.md)을 따른다. 만료 원문 정리 의사는 확인됐으므로 같은 범위의 정리 승인을 반복 요청하지 않는다. 운영 선택 백업/회수 설치 검증 및 실제 재수집 결과는 별도 기록해야 한다.
