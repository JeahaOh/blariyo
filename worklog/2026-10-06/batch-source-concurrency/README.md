# 출처별 배치 동시 실행 수 설정

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 / 갱신: 2026-10-06 20:50 KST
- 요청: 사이트별 병렬 실행 수를 상수화하고 수정 가능하게 한다.
- 범위: `scripts/local/run-batches.mjs`, `scripts/local/run-batch.mjs`의 중지 신호 전달, `scripts/local/batch-concurrency.mjs`, `scripts/local/batch-concurrency.test.mjs`, 수집 기획·기술 설계 및 이 기록.
- 담당 경계: AI 품질 도입 세션의 수정·공유 빌드/Git 작업을 보존한다. 신규 Node 실행기와 네트워크 없는 집중 시험만 수행한다.
- 구현 기준: 기본3개를 공통 상수로 정의하고 환경변수로 덮어쓴다. 사이트 단위 Java 배치 프로세스를 제한하여 실행하며 사이트 내부 요청 간격은 유지한다. 기존 단일 사이트 명령은 유지한다.
- 검증 계획: 동시 상한·빈자리 즉시 투입·실패 후 다음 출처 처리·잘못된 값 거부·중지 시 후속 실행 중단. 실제 재수집·DB 변경·운영 적용·커밋은 하지 않는다.

## 결과

- `DEFAULT_SOURCE_CONCURRENCY = 3` 및 `COLLECTOR_SOURCE_CONCURRENCY` 양의 정수 설정을 추가했다. 신규 정식 `run-batches.mjs`가 등록된 모든 출처를 기존 고정 로컬 DB 실행기로 분배한다. 실행기 하나의 동시 출처 수이며 Java 내부 thread 수/개별 사이트 HTTP 동시 수가 아니다.
- 출처별 완료/실패 코드를 출력하고 빈 자리에 다음 출처를 즉시 투입한다. 일부 실패에도 나머지를 완료하며 전체 비정상 종료1로 알린다. 중지 신호는 기존 wrapper에서 Java까지 전달하고 하위 프로세스 종료 후 임시 JAR 사본을 정리한다.
- Node24.18.0에서 집중 시험6개 PASS: 입력 경계, 슬롯 재사용·중복 출처 방지, 직렬/실패/중지, CLI 사전 거부, 실제 Node 하위 프로세스 병렬 상한2개와 옵션 전달, pool→wrapper→가짜 Java SIGTERM 전달·대기 출처 미실행·JAR 사본 정리.
- 중지 시험 최초 실행은 macOS 임시 경로 `/var`와 `/private/var` 차이로 fixture 설정 검증에 실패했다. 실제 wrapper 보호 조건을 유지하고 fixture 루트를 realpath로 정규화한 뒤6개 모두 재통과했다.
- `--help`, `git diff --check` PASS. 기획의 기본3개/요청 간격 유지와 기술 문서의 명령·설정·종료 동작을 동기화했다. 신규 문서는 저장소 내 실행기·상수 파일 경로를 확인했다.
- 실제 외부 사이트 재수집·DB 쓰기·운영 적용·커밋/푸시는 미실행. 테스트는 임시 폴더와 가짜 하위 프로세스만 사용했다. 기존 UI 로컬 서버는 재시작하지 않았다.
