# 후속 변경 작업 단위 커밋

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 — 기능별7개 커밋 확인, 이 최종 기록 커밋으로8개 단위 마감
- 요청: 지금까지 이 세션에서 수행한 변경을 수정 단위로 커밋한다. push·merge·배포는 포함하지 않는다.
- 담당 경계: AI 품질 도입 세션이 검증 및 Collector 시험4개 보완을 진행 중이다. G03에 따라 동시 stage/commit은 시작하지 않는다. 이 작업은 읽기 분류와 자체 기록·임시 패치 준비만 진행한다.

## 커밋 단위와 경로

1. 수집 제목 정규화: `packages/contracts/src/draft-title.mjs`, `tests/draft-title.test.ts`, `scripts/content/metadata-batch.mjs`, 관련 화면/수집/API/기능 명세의 제목 규칙 부분, `todayhumor-title-prefix`·`all-source-title-labels` 기록.
2. 출처별 병렬 배치: `scripts/local/{batch-concurrency.mjs,batch-concurrency.test.mjs,run-batches.mjs,run-batch.mjs}`, 기획·아키텍처의 동시 실행 부분, `batch-source-concurrency` 기록. 제외 기능은6번에서 따로 반영한다.
3. 상세 처리 버튼 고정·원본 링크: `admin-batch.vue`·`admin.css`의 작업 행/링크 부분, browser 시험의 링크 이름, 화면 명세의 해당 부분, `batch-sticky-actions`·`batch-original-link-filter` 기록. 필터 초기화는 기존 구현 검증이며 새 코드 변경으로 주장하지 않는다.
4. 조회 결과 목록 고정: `admin.css`의901px 이상 목록 패널 부분, 화면 명세의 해당 부분, `batch-sticky-list` 기록.
5. 검수 대기 대상 보정: API batch-review repository/통합 시험, admin-batch 상태 표시·단계 안내, browser 실패 필터 회귀, 화면/API/기능 명세의 UNREVIEWED 조건, `batch-review-eligibility` 기록.
6. 임시 출처 제외: source JSON·설정 시험, 전체 배치의 제외 처리·회귀, 기획·아키텍처의 제외 목록, `temporary-source-exclusion`·`inven-temporary-exclusion` 기록.
   후속 요청으로 MLBPARK·PGR21 제외와 `mlbpark-pgr21-temporary-exclusion` 기록도 같은 단위에 포함한다.
7. 베스트 댓글 캡처 아이디어: `docs/planning/content-collection/BACKLOG.md`와 README 탐색 링크, `best-comments-capture-idea` 기록.
8. 실행/조사 기록: `commit-reset-recollection`의 실제 최종 배치 결과 추가분, `sns-review-display-audit`, 이 커밋 작업 기록. SNS 표시 코드는 변경하지 않는다.

공통 문서는 전체 파일을 무조건 stage하지 않고 해당 작업 부분만 분리한다. 각 단계의 staged diff와 hook을 확인하고, 다른 담당 파일 및 작업 트리 내용이 유지됐는지 비교한다.

## 제외 경로

AI 품질 도입 담당의 `.github`, `AGENTS.md`, 루트 README/package, `docs/ai`·status/roadmap/testing, scripts/quality·tools·quality tests, API entities/database 시험, admin.vue, start-development 및 browser navigation/fixture, Collector parser 시험4개와 해당 worklog는 이 세션 커밋에 포함하지 않는다.

## 검증 기준

- 설치된 hook 확인, 세션 파일 hash 기준선, 각 커밋의 실제 staged diff·범위 확인, hook 실행 및 종료 후 Git 상태 확인.
- 집중 시험은 현재 변경으로 실행하며 전체 quality/API/browser/Collector 통과는 별도 담당의 최신 유효 증거와 구분한다.
- 진행 중 다른 담당의 명확한 인계 또는 사용자 작업 순서 지정 전까지 Git 변경 작업은 보류한다.

## 커밋 직전 준비

- 8개 순차 패치를 임시 폴더에 준비했다. 프로젝트 index/stage는 변경하지 않았으며, 별도 파일 사본에 순서대로 적용한 결과 이 세션33파일의 현재 내용과 바이트 단위로 일치했다.
- 현재 입력으로 제목·migration 계약·출처 설정·동시 배치 집중36 tests PASS(실패/skip0). `npm run hooks:check` PASS. 다른 담당의 전체 검증을 대체하지 않는다.
- AI 품질 도입 담당의21:12 기록은 quality 통과 후 API/browser 실행 및 Collector 예정으로 확인됐다. G03에 따라 아직 commit은 하지 않았다. 사용자에게 커밋과 품질 도입의 작업 순서를 질의했으며, 답변 또는 해당 담당 종료 확인 후 Git 변경을 시작한다.

## 범위 분리 커밋 진행 지시

- 사용자: “걔랑 중복되지 않을 것 같은데 별도로 커밋 진행 하면 되지 않을까?” 이번 세션 소유 변경만 분리하여 커밋하라는 지시로 적용한다. 다른 담당의 stage/commit 권한으로 확대하지 않는다.
- 실행 직전 HEAD b932366 유지, index 비어 있음 확인. 품질 도입 담당의 최신 기록도 최종 검증·자원 정리 완료이며 Git 변경 미실행이다. 해당 소유 source/정책·검증 기록을 포함하지 않고 작업 트리 그대로 보존한다.
- MLBPARK·PGR21 후속 제외까지 반영한8개 패치를 사용한다. 실제 commit별 staged diff/설치 hook 결과와 최종 다른 담당 경로의 보존을 확인한다.

## 커밋 결과

| 순서 | 커밋 | 내용 |
| --- | --- | --- |
| 1 | `5a9189a` | 출처별 제목 접두어·접미사 정규화 |
| 2 | `e72d7fd` | 동시 출처 수 설정·병렬 배치·중지 신호 전달 |
| 3 | `ce78e89` | 상세 처리 버튼 고정·원본 링크 |
| 4 | `86fbba5` | 데스크톱 조회 결과 목록 고정 |
| 5 | `64a36a9` | 검수 전에서 실패·차단 등 비검수 대상 제외 |
| 6 | `5c2dc83` | 디시·아카라이브·보배드림·인벤·MLBPARK·PGR21 임시 제외 |
| 7 | `1884c7d` | 베스트 댓글 캡처 아이디어 백로그 |
| 8 | 이 파일을 추가하는 커밋 | 최종 배치 실행 결과·SNS 검수 표시 조사·작업 단위 커밋 기록 |

- 이번 커밋 직전 현재 입력의 제목/계약/출처 설정/동시 배치 집중36 tests PASS, 실패/skip0. 각 기능 커밋의 실제 파일 목록과 계획 경로 일치, staged diff/공백 검사 및 계약·migration·OpenAPI hook 통과를 확인했다.
- API21개·브라우저 수동 검증·격리 build 등 구현 당시 증거는 각 작업 기록에 남겼다. 이번에는 기능 소스를 추가 수정하지 않았고 전체 API/browser/Collector suite를 다시 실행하지 않았다. 다른 담당의 이전 전체 검증을 현재8개 커밋 tree의 독립 검증으로 재사용하지 않는다.
- 마감 직전 다른 담당의88파일을 커밋 시작 기준선과 SHA-256 대조해 변경0건 확인했다. 해당 파일은8개 커밋에 포함하지 않는다. 작업 트리의 품질 도입 dirty/untracked는 정상적으로 남는다.
- 과거 작업 기록의 ‘당시 미커밋’ 표기는 소급 수정하지 않는다. 위 표가 이번 후속 Git 반영 증거다. SNS 검수 임베드 연결은 조사만 했고 미구현이다.
- push·merge·운영 배포·DB 변경·서버 재시작은 하지 않았다. 품질 도입의 offline parser fixture 보완도 해당 담당의 별도 커밋 대상이며 이번 제외 설정 변경과 함께 통합 검증해야 한다.
