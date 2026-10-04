# 계약 해시 누락 수정과 커밋 전 검사

- 담당: Codex (현재 세션)
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/contract-precommit-check`
- 기준: `release@c0ffd55` (시작 시 tracked/untracked 변경 없음)
- 상태: 진행
- 갱신: 2026-10-04 KST

## 요청과 범위

- CI #51의 계약 해시 누락 수정, 전체 로컬 테스트, 커밋 전 재발 방지 검사.
- 변경 경로: `docs/migration/contract-evolution.json`, `.githooks/`, `scripts/git-hooks*.mjs`, `package.json`, `docs/ai/git-workflow.md`, `tests/browser/`의 제목 선택자 5파일, 이 기록.
- 최초에는 commit/push/merge/배포 요청이 없었다. 후속 사용자 요청으로 단위별 로컬 commit을 포함한다. push/merge/배포는 범위 밖이다.
- 별도 `blariyo-m0-core` worktree와 기존 개발 DB 데이터는 보존한다. DB 테스트는 임의 이름으로 만든 일회용 DB만 사용한다.

## 확인한 원인

- https://github.com/JeahaOh/blariyo/actions/runs/37180014577/job/111370505065
- main `bfd1d08`의 `npm test`: 35개 중 34 통과, 1 실패.
- `b5961a1` 관리자 검색의 title/publishedDate 추가와 기존 query deprecated 반영 때 계약 3파일의 evolution 등록이 누락됐다.
- `tests/migration-contracts.test.ts:32`에서 OpenAPI 해시 불일치. 로컬 Node 24.18.0으로 동일 실패 재현.
- 추가 대조 결과 `api.d.ts`, `schema.mjs`도 불일치. SQL migration 해시는 일치.

## 1. 계약 해시 누락 수정

- `contract-evolution.json`의 날짜와 Core OpenAPI·api.d.ts·schema.mjs 3개 해시·변경 사유를 갱신했다.
- 근거: 관리자 명세·OpenAPI의 title 포함 검색, publishedDate KST 하루 검색과 titlePrefix/from/to 호환 유지. baseline 및 기존 SQL은 보존했다.
- Node 24.18.0: 전체 `npm test` 51/51(기존 35 + 추가 hook 16), API service 단위 35/35 통과.
- 전체 빌드/API test build, scripts/tests/Web 타입·lint와 API 타입·test 타입·lint 통과.
- 백업 도구 Node 17/17 + Python 3/3 통과.

## 후속 검증 진행

- stage 기준 계약 검사 구현·설치와 임시 저장소 hook 16건 검증 완료. 별도 단위로 commit할 예정이다.
- 최초 브라우저 전체 54개 중 37 통과·17 실패: 검색창과 편집창의 `제목` 중복으로 strict locator 오류 및 후속 데이터 부재. 편집 영역을 명시하는 5개 선택자만 수정하고 재검증한다. assertion은 유지한다.
- 최초 DB 통합 실행은 Collector 재컴파일과 병행 중 Java fixture 시작 실패. 재컴파일 후 fixture 진입이 정상임을 확인했으며, Collector 완료 후 전체 재검증한다.
- 사용자 메시지로 중단된 최초 Collector 실행은 완료 증거가 없다(`RUNNING`). 소유 프로세스가 남지 않았음을 조회하고 재실행했다. 통과로 집계하지 않는다.
- 로그: `/private/tmp/blariyo-contract-*.log` (임시 실행 산출물). 최종 결과와 자원 정리는 후속 절에 기록한다.
