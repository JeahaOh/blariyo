# 로컬 검수 전 비우기·재수집

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료 / 갱신: 2026-10-05 21:30 KST
- 사용자 요청: 현재 검수 전 내용 전체를 비우고 새로 수집해 적재.
- 대상: 현재 화면의 로컬 `127.0.0.1:5439/blariyo_local`, `.local-data/collector-objects`. 운영 제외.
- 최초 읽기: 검수 전192, 승인47, 반려7, 게시글111. RUNNING0. 승인/반려·게시글은 보존.
- 범위: 고정 로컬 유지보수 도구와 백업/정리 manifest, 실제 출처 수집/DB·object readback, 관련 로컬 운영 문서.
- 정리 조건: 정확한 대상 manifest·DB/object 백업 검증·idle·잠금·미검수 재확인·게시글 보존 대조. 보존기한 조작·trigger 비활성화 없음. 명시적인 사용자 삭제를 만료 회수와 구분하고 제한된 transaction/row 삭제 capability를 사용한다.
- 수집: 등록21개 출처 기본 chart·최대2페이지/출처10건·최근24h·기존 INCLUDE_UNKNOWN, 출처별 요청 간격10초·quota/robots/미검증 chart 차단 유지. 새 결과는 검수 전으로만 저장하며 발행하지 않는다.
- 기존 source/UI/문서 변경 보존. commit/push/배포 제외.

## 정리 실행 — 21:09 KST

- `scripts/local/clear-unreviewed.mjs` 추가. 고정 로컬 연결·실행/대기열 idle·배타 수집 fence·collect/content 쓰기 잠금·정확한 미검수 manifest를 검사한다.
- 기존 guard는 유지하고 세션 임시 소유자 함수에서 manifest 대상 행에만 삭제 권한을 발급한다. 만료 일자, trigger, role grant, 회수 활성 gate 변경 없음.
- 삭제 rehearsal을 savepoint에서 실행해 보존 스냅샷을 대조한 뒤 rollback. 동일 본 실행 후 다시 대조하여 **192건 삭제, 객체673개 제거**.
- 승인47·반려7·게시글111과 content 전체 테이블, 남은 항목/첨부/보존 원장, 실행·보고서·checkpoint·queue의 행 수와 내용 SHA-256 동일.
- 미검수 원문 중 게시글과 URL이 같은64건이 있어 해당 중복 방지 키는 유지했다. 이미 게시한 글의 재수집·중복 게시를 허용하는 초기화는 하지 않았다.
- 백업: `.local-data/backups/unreviewed-2026-10-05T12-08-45-180Z/`의 `database.dump`, `objects/`, `manifest.json`, `receipt.json` (Git 제외·비공개).
- DB archive 검사·전체 객체 사본 크기/해시 대조 통과. 추가로 별도 임시 DB에 dump를 복원하여 삭제 전 미검수192/승인47/반려7/게시글111 확인 후 자신이 만든 임시 DB만 제거했다. `restore-verification.json`에 결과 저장.

## 재수집 진행

- 최초 example 설정 실행은 일일 요청 한도 미설정으로17출처 `SOURCE_CONFIG_REQUIRED`, 미검증 chart4출처 차단. 외부 수집 성공/DB 적재로 집계하지 않는다.
- 기존 실제 로컬 설정 `.local-data/development/dev-21-site-publish/sources.json`과 현행 example을 비교하여 허용 목록/파서/미검증 chart 차단이 동일함을 확인. 기존 한도300회/일·최소10초를 그대로 사용하여 재실행.
- 결과 저장: `.local-data/recollection/2026-10-05-configured/`. 서로 다른 출처3개까지 병행, 출처 내부 요청 간격 유지. 웃대 수정이 포함된 현행 Collector JAR 사용.
- 최종 건수·원문/첨부 readback·로컬 화면 API 검증은 진행 중.
- 사용자 표현 정정: 실제 수집 주체는 Java 배치 프로그램이고 Codex는 배치 실행·감시·결과 검증 담당이다. 이후 상태 보고도 이를 구분한다.
- 디시인사이드 HTTP 대기: 첫 robots 요청의 `HttpClient.send`에서5분 이상 정체, Thread dump와 요청 원장 미진행 확인. 이번 작업이 실행한 Java PID20456/JAR 사본/`--source dcinside` 일치 확인 후 해당 프로세스만 SIGTERM. 제한 환경의 첫 signal은 EPERM으로 실행되지 않았으며, 이후 승인된 실행으로 종료했다. 정상 source 잠금과 기존 `BATCH_OWNER_LOST` 상태 전이를 통해 해당 run을 FAILED로 기록했다(21:17:30 KST, 실행370초). trigger/제약 해제 없음. HTTP 대기 시간 초과가 실행을 끝내지 못한 원인 수정은 이번 데이터 정리·재실행과 구분해 후속으로 남긴다.

## 최종 결과 — 21:30 KST

- 상태: 종료. 21개 출처 배치 실행 종료, 정상 원문 **27건**, 실패9·차단1을 포함한 새 검수 전 항목 **37건**. 잔여 RUNNING/FETCHING0. 출처별 최대10건·2페이지·최근24h(시각 미상 INCLUDE_UNKNOWN)로 실행한 결과이며 전체 사이트 글 전수 수집을 뜻하지 않는다.
- 정상 원문: 인벤9, 루리웹9, 디미토리6, 클리앙2, 율도1. 21개 출처 모두 수집에 성공한 것은 아니다.
- 마지막 디미토리 배치: 이미지57개짜리 원문을 완료한 뒤 후속 항목의 SOURCE_URL_INVALID로 중단. 성공6건 보존.
- 구조/저장 검증: 새 항목37건의 원문 파일37개 읽기, 첨부122개/54,692,543 bytes 크기·SHA-256 대조, 정상27건 본문 이미지 매핑 통과.
- HTTP 검증: 로컬 BFF 검수 전 목록37건이 DB와 정확히 일치, 정상27건 상세200·UNREVIEWED, 이미지가 있는 정상 출처3곳의 대표 미리보기200 확인. 실제 브라우저 렌더·출처 원문과의 의미/품질 전수 대조는 이번 검증에 포함하지 않았다.
- 웃대 새 항목은 파싱된 제목·본문에 대체문자 U+FFFD 없음. 이미지 서버 ROBOTS_UNVERIFIED 때문에 정상 수집으로는 집계하지 않는다.
- 삭제 전192개 UUID 잔존0, 검수 완료54건과 content8개 테이블의 내용 해시 동일(게시글111건 포함). 자동 승인/발행·운영 변경 없음.
- 도구 node --check·git diff --check 통과. 공개 상태 기록과 로컬 실행 안내 갱신. commit/push/배포 미실행.

| 출처 | 배치 상태 | 정상 원문 | 사유 |
|---|---|---:|---|
| 아카라이브 (arcalive) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 보배드림 (bobaedream) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 클리앙 (clien) | BLOCKED | 2 | SOURCE_NOT_ALLOWED |
| 디시인사이드 (dcinside) | FAILED | 0 | HTTP_SEND_STALLED / BATCH_OWNER_LOST |
| 디미토리 (dmitory) | BLOCKED | 6 | SOURCE_URL_INVALID |
| 개드립 (dogdrip) | BLOCKED | 0 | SOURCE_ACCESS_BLOCKED |
| 이토랜드 (etoland) | BLOCKED | 0 | ROBOTS_DISALLOWED |
| 에펨코리아 (fmkorea) | BLOCKED | 0 | CHART_UNVERIFIED |
| 개드립넷 (goodgag) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 웃긴대학 (humoruniv) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 인스티즈 (instiz) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 인벤 (inven) | PARTIAL | 9 | PARSE_FAILED |
| 엠엘비파크 (mlbpark) | BLOCKED | 0 | ROBOTS_DISALLOWED |
| 네이트판 (natepann) | BLOCKED | 0 | ROBOTS_DISALLOWED |
| PGR21 (pgr21) | BLOCKED | 0 | CHART_UNVERIFIED |
| 뽐뿌 (ppomppu) | BLOCKED | 0 | CHART_UNVERIFIED |
| 루리웹 (ruliweb) | PARTIAL | 9 | PARSE_FAILED |
| 더쿠 (theqoo) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 오늘의유머 (todayhumor) | BLOCKED | 0 | ROBOTS_UNVERIFIED |
| 유튜브 커뮤니티 (youtube-community) | BLOCKED | 0 | CHART_UNVERIFIED |
| 율도 (yuldo) | BLOCKED | 1 | ROBOTS_UNVERIFIED |

### 후속 사항

- 출처별 robots 확인/수집 금지/접근 차단/미검증 목록, 허용 origin·URL 및 본문 파싱 오류는 개별 원인 검토가 필요하다. 이번 실행에서 보호 조건을 완화하지 않았다.
- 디시인사이드에서 HttpClient.send의 요청 시간 제한이 종료로 이어지지 않은 문제는 재현·수정 대상. 실행 정체/부분 성공을 관리자 화면에서 구분하는 개선과 함께 별도 범위로 다룬다.
- 삭제 전 전체 백업 및 개인 환경 로그는 `.local-data/`에만 보존하며 Git에는 포함하지 않는다.
