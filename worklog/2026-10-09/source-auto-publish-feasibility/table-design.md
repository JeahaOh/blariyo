# 출처별 자동 발행 테이블 검토

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: 출처별 자동 발행 여부를 별도 테이블로 관리할 필요가 있는지 판단.
- 적용 스킬: blariyo-task-start. 검토 전용이며 이 기록만 작성한다. 앞선 [가능 여부 검토](README.md)를 잇는다. 정책·코드·DB·설정은 변경하지 않았다.

## 판단

- 일반적으로 기존 출처 테이블에 boolean을 추가해도 되지만, 현행 구조에서는 API가 관리하는 별도 정책 테이블을 권장한다.
- `collect.batch_source`는 Collector가 등록·갱신하는 테이블이다. `BatchStore.registerSource()`가 INSERT/UPDATE하며, 로컬·운영 grant는 Collector에 테이블 전체 INSERT/UPDATE를 부여한다.
- 따라서 자동 발행 컬럼을 그대로 추가하면 수집기 DB 역할도 해당 정책을 변경할 권한을 갖는다. 기존 테이블 유지안은 컬럼별 권한 재설계와 기존 등록 경로 회귀 확인이 필요하다.
- `apps/api/src/persistence/collect-ownership.ts`도 batch_source를 API 읽기 전용 수집 결과 테이블로 분류한다. 수집 결과 소유권과 운영자의 발행 정책 소유권을 분리하는 편이 현재 구조에 맞는다.

## 최소 제안 — 미구현

- 제안 테이블명: `collect.batch_source_publish_policy` (명칭 미확정). 출처당1행이며 출처마다 별도 테이블을 만드는 안이 아니다.
- 필드: `source_key`, `auto_publish_enabled DEFAULT false`, `updated_by`, `updated_at`, `lock_version`.
- API/관리자 권한으로만 설정 변경. Collector에는 변경 권한을 부여하지 않는다. 발행 여부는 공통 API 발행 경로에서 판단한다.
- 설정 없음은 사람 검수 필요. 기존 관리자 반려·발행 이력은 존중하고 자동 발행 실행 직전에 최신 정책/버전을 재확인한다.
- 활성화 시 과거 검수 대기분까지 소급 발행하지 않고 이후 수집분부터 적용하는 것을 제안한다. 이 기준을 채택하면 정책 적용 시점 기록/판정도 구현 계약에 포함해야 하며 단순 updated_at을 무조건 활성화 시점으로 쓰지 않는다.
- 출처별 대상 게시판·시간대·복잡한 조건 JSON은 현재 질문 범위에서 추가하지 않는다. 기존 감사 기록 경로를 재사용할 수 있는지 구현 단계에서 확인한다.

## 검증

- planning의 현재 사람 검수 정책, Collector V002 테이블 정의, BatchStore 등록 SQL, 운영/개발 grant, API collect-ownership을 직접 대조했다.
- 설계 제안만 작성했으며 migration·테스트·서비스 실행은 하지 않았다. 기존 미커밋 변경을 보존하고 `git diff --check` 확인.
