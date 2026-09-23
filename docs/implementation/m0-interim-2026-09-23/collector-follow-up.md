# 수집 시스템 후속 작업

기준일: 2026-09-23. 사용자 요청에 따라 현재 변경을 기능별 커밋으로 정리할 때 남기는 재개 목록이다.
제품·기술 계약을 새로 결정하는 문서는 아니다. 전체 우선순위는 [M0 실행 계획](next-plan.md)을,
사이트별 상태는 [수집 검증표](../../planning/content-collection/reference-site-validation.md)를 따른다.

## 현재 기준선

- 직전 로컬 검증 기록: 17개 출처의 수집 원본 104건, 이미지 380개, 첨부 2개, SNS 21개 readback.
- 공개 화면 검증 기록: `http://localhost:3000/meme` 게시글 71건, 이미지 266개, SNS 10개.
  71개 상세 방문과 이미지 로딩을 확인했다. 원본 수집량과 공개 게시글 수는 서로 다른 집계다.
- Java 전체 170/170, 제한 DB 역할과 migration·백업 복원 검증은 직전 실행에서 통과했다.
  이번 문서 작성에서 외부 수집·DB·브라우저 검증을 재실행한 결과는 아니다.
- 실제 관리자 인증 UI, Discord Gateway, 다른 PC와 원격 S3/R2, Windows 실행은 별도 미검증이다.
  21개 사이트 전체 또는 운영 준비 완료로 해석하지 않는다.
- 근거: [수용 기준 감사](../../../worklog/task-list/09/23/batch-고도화/ACCEPTANCE-AUDIT.md),
  [첨부·브라우저 검증](../../../apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md).

## 실행 순서와 완료 기준

| 순서 | 작업·기존 계획 연결 | 선행 입력과 범위 | 완료 기준 |
| --- | --- | --- | --- |
| 1 | 관리자 검수 UI 실제 사용 — P1-02 | 사용자가 로그인한 localhost:3000 관리자 세션. 쿠키·토큰을 문서/대화로 전달하지 않음 | 목록→검수→승인/반려→초안→별도 발행을 브라우저에서 수행. 중복 클릭·오래된 버전·이미지 실패·재시도, DB/object 결과까지 확인 |
| 2 | 사이트별 parser 파일 분리 | 아래 모듈 계약과 기존 fixture 결과. 외부 자격증명 없이 착수 가능 | 지원 사이트별 adapter/list/detail 파일과 테스트 분리, 분리 전후 canonical/post key·순서·미디어 결과 동일. fixture 성공과 live 성공을 별도 기록 |
| 3 | 별도 PC·공유 개발 DB·원격 S3/R2 — P1-03 | 승인된 비운영 DB/bucket, 제한 batch/API 역할, 비공개 설정 주입 | 목록→상세→DB/object→API 검수·초안·발행 완주. 원격 GET bytes/hash/size 대조, 역할 간 쓰기 거부, dry-run 무쓰기·재시작·중복 검증 |
| 4 | Discord 실제 연결 — P1-04 | 테스트 guild/channel/역할, bot 설정과 실행 PC | Gateway 연결과 `/collect url` 확인→queue→claim→fetch→parse→DB/object→결과 조회. 취소·만료·권한 거부·중복 interaction도 검증 |
| 5 | 관리자 URL 입력·원본 보존 — P1-01/05 | 입력 전달 소유권 및 raw/media/report/queue 보존 기간 결정 | API가 외부 사이트를 fetch하지 않는 입력 계약. 보존 대상 manifest dry-run, 진행/검수/승격 참조 보호, 승인된 삭제만 수행하고 readback |
| 6 | 출처 품질·실행 환경·CI — P1-06/07 | 공개 접근 허용 경로, 지원 OS 시험 장비 | since 날짜 미상 정책·공지/중복 제외·본문/첨부/SNS 표본 회귀. macOS·Windows PowerShell·Linux Docker 실행 결과와 CI 검사를 각각 기록 |
| 7 | 운영 준비와 관찰 — P0-05/P2 | 검토된 release와 별도 push/배포 권한, 운영 담당 | 출처 활성화·요청 간격·재시도 상한·site stop·알림·보존·복귀 기준 확인. 실제 운영 관찰 기록을 남기고 자동 발행은 추가하지 않음 |

사이트 파일 분리의 정본은 [코드 구조의 사이트별 모듈 계약](../../system-design/08-code-structure.md#collector-site-modules)이다.
현재 `SiteAdapters.java`의 중첩 구현은 독립 파일 분리 완료가 아니다. 한 사이트씩 옮기며 공통 실행·저장 계층을 유지한다.
목록을 지원하지 않는 출처에는 형식적인 목록 parser를 만들지 않는다.
관리자 인증이나 원격 환경 준비가 지연되면 2번의 파일 분리와 회귀 검증부터 진행할 수 있다.

## 차단된 4개 출처의 재개 조건

| 출처 | 직전 실제 관측 | 재개 조건 |
| --- | --- | --- |
| fmkorea | HTTP 430 보안 응답 | 허용된 공개 응답 또는 공식 수집 경로 확보 |
| ppomppu | 302 이동 뒤 HTTP 403 | 공개 접근 허용 또는 공식 경로 확보 |
| pgr21 | Anubis 연결 확인, 상세 접근 차단 | challenge 없는 허용된 공개 본문 응답 확보 |
| youtube-community | HTTP 200이나 게시글 renderer 없이 responseContext만 존재 | 공개 게시글 renderer가 있는 실제 URL 또는 허용된 데이터 경로 확보 |

조건이 바뀔 때 해당 출처만 제한적으로 재검증한다. 차단 우회·generic parser 대체로 성공 처리하지 않는다.
fixture 구현 가능성, 실제 fetch, DB 저장, object readback 상태를 각각 기록한다.

## 재개 방법

1. Git 변경과 [환경 설정](../operations/environment-configuration.md), [로컬 실행서](../../../scripts/local/README.md)를 확인한다.
2. 해당 작업의 선행 입력과 대상 환경을 확인한다. 운영 DB/bucket을 개발 시험 대상으로 사용하지 않는다.
3. 변경한 계층의 테스트와 fixture 회귀를 실행한다. DB/역할 변경은 격리 DB에서 migration·권한·readback을 확인한다.
4. 현재 수치·실행 명령·실패 사유·증거 파일·Git 상태를 새 기록으로 남긴다. 이전 PASS를 새 실행 결과로 복사하지 않는다.

직전 검증 재현 명령은 다음과 같다. DB 준비 조건은 로컬 실행서를 따른다.

```sh
node scripts/test-collector-readback.mjs
node scripts/test-database-roles.ts
npm run typecheck:scripts
npm run lint:scripts
git diff --check
git status --short --branch
```

커밋은 Collector → API/계약 → Web → 환경/검증 도구 → 설계 → 검증 기록으로 나눈다.
커밋의 생성 여부는 Git 이력으로 확인하며, 커밋 자체는 미검증 기능의 완료나 push·배포를 뜻하지 않는다.
