# TASK-03 — 배포와 복구 실행 기준 정정

- 상태: 완료 / 우선순위: P0 / 선행: TASK-02
- 대상: [배포 실행서](../../../docs/operations/deployment-runbook.md), [배포 정책](../../../docs/operations/deployment-policy.md)
- 교차 확인: [부팅 도구](../../../deploy/operations/start-application.py), [앱 도구 안내](../../../deploy/application/README.md), [DB 도구 안내](../../../deploy/postgresql/README.md)
- 공통 범위와 원칙: [계획](README.md).

## 작업

1. 최초 설치 재현, 과거 V005 후보 검사, 현재 재배포·복구 절차를 명확히 구분한다. 과거 V005 설명을 V008로 일괄 치환하지 않는다.
2. 부팅 helper가 최초 release를 참조한다는 설명을 현재 로컬 source와 대조해 바로잡는다. 실행 도구 자체는 수정하지 않는다.
3. V008에서 9월 20일 구버전 API가 readiness에 실패한다는 경계를 보존한다. 앱 복귀는 V008 호환성이 확인된 5c581c2 기준으로 설명하고 DB 전체 복구와 구분한다.
4. 해당 SHA의 CI·GHCR·실제 배포 기록을 연결한다. 자동 CD 미구현, 새 후보 검증·백업·설정·migration 대조 필요는 유지한다.
5. 앱 JSON 오류 no-store의 배포 후 확인 범위를 반영한다. 신규 정적 자산 캐시 규칙·구 탭·실제 rollback·재부팅 미검증은 별도로 남긴다.
6. 교차 확인 문서에 현재 안내와 충돌이 있으면 문서만 최소 수정하고 변경 범위에 추가한다.

## 완료·검증 기준

- [x] 구버전 앱으로 단순 복귀하거나 초기 migration 도구를 후속 upgrade에 쓰도록 오해할 안내가 없다.
- [x] release·설정 식별·migration·복귀 경로 확인 절차가 현재 source 및 운영 기록과 맞는다.
- [x] 설치·발행·정책 주입 명령은 조회 명령과 구분되며 검증 목적으로 실행하지 않는다.
- [x] DB 자동 역 migration·volume 삭제·정책 재발행을 새 절차에 추가하지 않는다.
- [x] 문서상 명령·옵션·참조 파일을 정적으로 대조했다. 실제 배포 검증으로 보고하지 않는다.

## 실행 결과

- 변경 파일: [배포 실행서](../../../docs/operations/deployment-runbook.md), [배포 정책](../../../docs/operations/deployment-policy.md),
  [앱 도구 안내](../../../deploy/application/README.md), [DB 도구 안내](../../../deploy/postgresql/README.md), 이 TASK 상태·결과.
- 검증: 9/23 배포·DB 반영 기록과 9/24 로컬 부팅 helper·CI workflow·Compose `pull_policy: never`·준비 도구의 flag 이름·초기 migration 명령을 정적으로 대조했다. 범위 내 문서 9개의 상대 링크 검사에서 누락 0, `git diff --check` 통과. 설치·발행·배포·복구 명령은 실행하지 않았다.
- 잔여: 다음 후보의 원격 CI·digest/서버 release·설정·ledger/백업 실시간 확인, 실제 rollback·VM 재부팅·구 탭/신규 자산 캐시·운영자 인수는 별도 작업이다. 자동 CD는 아직 구현되지 않았다.

## 1차 재검토 후속 보완

- A1-2 반영: 배포 실행서의 교체 직후 기본 검사와 최종 성공 검사를 분리했다. 기본 검사에는 아직 수행하지 않은 부팅 경로 갱신·timer 재개를 요구하지 않으며, 최종 검사는 두 단계와 캐시 대조 뒤에 수행한다.
- 실패 시 복귀·부팅 경로/timer 확인 경로와 실제 MFA 업무 인수 조건은 유지했다. 배포 명령은 실행하지 않았다. 통합 검증은 [후속 결과](RESULTS.md#1차-재검토-보완-결과)를 따른다.
