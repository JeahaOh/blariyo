# 작업 단위 커밋·로컬 DB 초기화·신규 배치

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 시작 HEAD `12df6ae`
- 상태: 종료 — 커밋·로컬 초기화·21개 출처 배치·저장 검증 완료 / 갱신: 2026-10-06 20:40 KST
- 작업 차단: **해제**. 커밋·DB 초기화를 위한 공유 작업 폴더 우선 사용이 끝났으며, 사용자 요청에 따라 `ai-quality-adoption` 세션은 작업을 재개할 수 있다.
- 요청: 기존 변경을 작업 단위로 커밋한 다음 로컬 DB를 비우고 신규 배치 실행.
- 담당 확인: 기존 수집 정책·관리 UI·검토 기록 종료 확인. 기존 변경은 보존하며 사용자 요청으로 Git 반영 담당을 이어받음.
- 변경 범위: 기존 미커밋 구현/계약/검증/운영 문서와 작업 기록, 이 기록. 원격 push·운영 변경 제외.
- 커밋 구분: 제목 공통 유틸, DB/API 계약, Collector 처리, API 업무 처리, Web 공통 로딩, 관리자 화면, 로컬/운영 도구, 정본 문서, 작업/검토 기록. 같은 파일의 누적 변경은 의존성을 유지하여 묶음.
- 초기화 대상: 고정 로컬 `127.0.0.1:5439/blariyo_local`. DB 전체(게시글/검수/수집/중복 이력 포함)를 새로 구성. 설정·인증 비밀은 유지.
- 초기화 전 DB dump 복원 검사 및 로컬 object/media 보관. 이후 API V013·Collector V015 migration, 공통코드/게시판 기본값·정책 seed, 제한 역할 확인.
- 신규 수집: 기존 로컬 설정의 등록 21개 출처, 출처별 최대 10건/2페이지/최근 24시간, 기본 요청 간격 5초. 미검증 chart·실제 HTTP 차단은 유지. 배치가 수집하고 Codex는 실행·결과를 검증. 자동 승인/발행 없음.
- 검증: staged diff/계약 hook, build·타입/단위 검사, 로컬 초기화 전후 DB readback, 배치별 결과와 객체 크기/해시, 로컬 API 목록/상세.

## 실행 결과

- 시작 시 Git hook 설치 일치·`git diff --check` 통과. 로컬 PostgreSQL 컨테이너와 5439 포트 확인.
- 7개 커밋 후 별도 `ai-quality-adoption` 진행/CI·package 변경 발견. Git 작업 중단 후 사용자에게 순서를 확인했고, 사용자가 **품질 도입 세션을 멈추고 이 작업 먼저**로 지정했다. 품질 도입 변경·기록은 이번 커밋에서 제외했다. 당시 커밋/초기화를 위해 두었던 다른 세션 작업 보류는 아래와 같이 해제했다.
- 현재 build·Web 타입 검사 통과. 최초 단위 검사는 API 빌드 중 dist 재생성 경쟁으로 sitemap import 실패1건; build 종료 후 재실행하여 52건 모두 통과(실패/skip0).

## 초기화 전 커밋

- `1440a74` fix(contracts): remove known source labels from draft titles
- `6e30c92` fix(collector): preserve decoded Korean text from Humoruniv
- `d348866` feat(db): define common codes and direct collection review contracts
- `d8a7317` feat(collector): coordinate retention, image retries and configurable request pacing
- `113d414` feat(api): manage common codes and direct batch review actions
- `193d495` feat(web): add shared top loading indicator
- `d77db70` feat(admin): streamline collection review and common code management
- `368bc93` feat(ops): support collection cleanup and updated database privileges
- `1a31805` docs: align collection policy and administrator workflows
- `a5cbb0d` docs(worklog): record collection and administrator validation results
- `d8cadef` docs: record AI quality tooling review and adoption plan

- 초기화 전 백업: `.local-data/backups/reset-20261006/`. 별도 임시 DB 복원 후 78개 테이블 전체 행 수·내용 해시 일치. 수집85/게시글117/검수68 확인. 객체1,731개·821,620,812 bytes 사본 SHA-256 일치. 로컬 서버 정상 종료 후 재대조.
- 다른 세션 소유의 CI/package/admin.vue lint 수정·scripts/quality·ai-quality-adoption 기록은 보존·커밋 제외.

## 로컬 초기화·배치 실행

- 20:09 KST: 기존 개발 서버 정상 종료·활성 배치0·DB 연결0 확인 후 고정 로컬 DB를 DROP/CREATE. 기존 collector/media 폴더는 백업 디렉터리의 `original-*`로 이동 보존하고 빈 경로 생성. 비공개 설정/계정/복구 사본 유지.
- 새 빈 DB에서 `prepare-batch-review`의 EMPTY_BACKUP 검사에 걸려 변경 없이 종료. 검사 완화 없이 문서의 신규 환경 순서인 API `db:migrate`를 먼저 실행한 뒤 준비 도구 재실행 성공.
- API V001~V013 / Collector V001~V015·API/배치 제한 역할 확인. 게시글0/수집0/검수0, 공통코드21/게시판1·정책2개 seed. 이전 DB의 임시 복원 검증 DB는 검증 후 제거.
- Web3000/API3100 재시작(workers=false). `/meme`, 인증 `/admin/batch`, 검수 목록 API HTTP200.
- 20:10:31 KST: 기존 source 설정을 비공개 실행 디렉터리에 고정 복사하고 등록21개 source 배치 시작. 출처3개까지 병행하며 같은 출처 요청은 기본5초 간격 유지. 설정 hash와 출처별 로그는 `.local-data/recollection/reset-20261006/` 보관.

## 작업 차단 해제·담당 경계

- 2026-10-06 20:25 KST 사용자 요청으로 차단 해제를 명시한다. 기존 변경의 단위별 커밋과 로컬 DB 초기화·기본값 복원·서버 재시작은 완료했다.
- 다음 담당: `ai-quality-adoption` 세션. 해당 세션 소유 파일의 구현·검증을 재개할 수 있다. 해당 변경은 이 세션의 커밋에 포함하지 않는다.
- 이 세션 잔여: 이미 실행한21개 출처 배치 감시, 로컬 DB/object/API 결과 대조, 이 기록의 최종 결과 갱신. 배치 완료를 기다리는 것은 다른 세션의 작업 차단 사유가 아니다.
- 실행 중 배치는 고정 source 설정과 실행별 JAR 사본을 사용하고 Web 서버도 별도 빌드 사본을 사용한다. 이 세션은 추가 공유 빌드·브랜치 전환·다른 세션 파일 수정을 하지 않는다. 이 문서만 차단 해제 커밋에 반영한다.

## 최종 실행·검증 결과

- 단위별 기존 변경11개와 준비 기록 `d113198`, 차단 해제 `b932366`까지 **13개 로컬 커밋**. push/merge/운영 변경 없음. 차단 해제 이후 품질 도입 담당 작업은 계속 보존한다.
- 배치 실행: 20:10:31~20:37:11 KST, **26분40초**, 등록21개 출처 모두 실행 판정 종료. 실제 DB 실행17개(완료10·부분3·차단3·실패1), 미검증 chart4개는 실행 전 차단.
- 현재 배치 저장: **139건 = FETCHED128 + FAILED7 + BLOCKED3 + SKIPPED_POLICY1**. 기간 제외1건은 율도. source 게시 시각 미상은 기존 INCLUDE_UNKNOWN 조건에 따라 포함했으므로 엄격한 오늘 글 전수 수집으로 해석하지 않는다.
- 원문139개·첨부443개/48,988,123 bytes 크기·SHA-256 일치. 16개 종료 report/checkpoint/저장 대조 통과. 디시 강제 종료1개는 정상 report가 생성되지 않았으며 별도 종료 증거로 기록.
- 관리자 목록139개가 DB item ID 집합과 일치. FETCHED128개 상세200, 이미지가 있는13개 출처 대표 미리보기200. 실행 중 RUNNING0/FETCHING0, 이미지 정리 대기0.
- 수집 후 사용자 관리자 작업으로 승인·발행/반려가 진행됐다. 20:38:04 검증 snapshot에서는 게시글2/검수3, 후속 조회에서는 게시글3으로 증가했다. 배치의 자동 검수/발행으로 집계하지 않고 사용자 작업을 보존했다. 초기화 직후0건 증거와 현재 사용자 검수 상태를 구분한다.
- 첫 전체 확인은 사용자 검수 이전을 가정한 posts=0 검사에서 중단됐다. 실제 승인·발행/반려 기록 확인 후 검증 대상을 전체 목록 ID 일치·현재 상세 상태·저장 파일로 바꿔 재검증했다. 저장 검증과 원문 의미/품질 대조는 구분한다.

| 출처 | 정상 수집 | 실행 결과/사유 |
|---|---:|---|
| arcalive | 10 | COMPLETED |
| bobaedream | 10 | COMPLETED |
| clien | 1 | BLOCKED / SOURCE_NOT_ALLOWED |
| dcinside | 0 | FAILED / 첫 HTTP send 정체 / BATCH_OWNER_LOST |
| dmitory | 7 | BLOCKED / SOURCE_NOT_ALLOWED |
| dogdrip | 10 | COMPLETED |
| etoland | 2 | PARTIAL / PARSE_FAILED |
| fmkorea | 0 | BLOCKED / CHART_UNVERIFIED |
| goodgag | 10 | COMPLETED |
| humoruniv | 10 | COMPLETED |
| instiz | 10 | COMPLETED |
| inven | 5 | PARTIAL / PARSE_FAILED |
| mlbpark | 9 | PARTIAL / PARSE_FAILED |
| natepann | 10 | COMPLETED |
| pgr21 | 0 | BLOCKED / CHART_UNVERIFIED |
| ppomppu | 0 | BLOCKED / CHART_UNVERIFIED |
| ruliweb | 10 | COMPLETED |
| theqoo | 10 | COMPLETED |
| todayhumor | 5 | BLOCKED / SOURCE_NOT_ALLOWED |
| youtube-community | 0 | BLOCKED / CHART_UNVERIFIED |
| yuldo | 9 | COMPLETED / 기간 조건 제외1 |

### 확인된 잔여 문제

- **디시인사이드 HTTP timeout:** 첫 요청에서5분 이상 요청 원장/DB 진행0. 이 실행의 Java PID70018·실행별 JAR·source 일치 확인, thread dump의 `HttpClient.send` 대기 확인 후 해당 PID만 SIGTERM. 제한 batch 역할로 source 잠금·기존 owner 소멸·item0 검증 후 기존 BATCH_OWNER_LOST 전이로 종료했다. trigger/제약 완화 없이 실패1건으로 기록. 원인 수정은 미실행.
- **웃대 CP949 확장 문자:** 앞선5건 표본에서는 깨짐0이었으나 전체10건 검사에서1건 본문 `미식이네��` 발견. 저장 원문의 CP949 바이트 `9e f6`는 `욛`이며 현행 EUC-KR 디코딩에서 대체문자2개로 변환된다. 제목 전체/일반 한글 재파싱 문제와 별도로 남은 확장 문자 처리 결함이다. 저장 byte/hash 검증 통과를 내용 품질 전체 통과로 보고하지 않는다. 원문 보존, 코드/기존 데이터 수정 미실행.
- **파싱/URL 허용 범위:** 이토랜드3·인벤3·엠엘비파크1 PARSE_FAILED, 클리앙/디미토리/오늘의유머 각1 SOURCE_NOT_ALLOWED. 미검증 chart4개는 활성화하지 않았다.
- **병렬 실행:** 이번 임시 실행기는 서로 다른 출처3개까지 병렬, 출처 내부5초 간격이다. 21개 전부 동시 실행은 아니며 이미지가 많은3개 출처가 실행 자리를 점유하는 동안 뒤 출처가 대기했다. 사용자의 병렬 질문에 이 제한을 설명했다. 정식 동시 출처 수 설정/작업 스케줄러 변경은 이번에 구현하지 않았다.
- 운영자 원문 대비 품질/만족도 전수 검사·CI/원격 반영은 별도다. 이번 종료는 요청한 로컬 재구성과 배치 실행·저장 검증의 종료다.

### 기록·인계

- 복구: `.local-data/backups/reset-20261006/`의 DB dump·restore-verification·objects-manifest 및 기존 object/media 원본 폴더.
- 실행/검증: `.local-data/recollection/reset-20261006/`의 source snapshot/hash, 출처별 로그, source-results, verification, 웃대 인코딩 조사, 디시 timeout/thread 증거. 비공개 파일은 Git 제외.
- 차단 해제 문서는 사용자 요청대로 `b932366`에 커밋했다. **이 최종 배치 결과 추가분은 미커밋**이며 재개된 품질 도입 작업과 동시 Git 변경을 하지 않는다. 후속 커밋 시 이 문서만 별도 반영한다.
- 담당 상태 종료. 품질 도입 세션은 작업 차단 해제 상태를 유지한다. 로컬 서버3000/3100은 실행 유지한다.
