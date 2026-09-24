# TASK-06 — 보안·준비·인수·README 안내 동기화

- 상태: 완료 / 우선순위: P1 / 선행: TASK-05
- 대상: [보안 상태](../../../docs/operations/security-protection-status.md), [운영자 준비](../../../docs/operations/owner-setup-checklist.md), [루트 README](../../../README.md), [운영자 인수](../../../docs/testing/operator-acceptance.md)
- 공통 범위와 원칙: [계획](README.md).

## 작업

1. 보안 문서의 현재 요약과 표에 앱 no-store 배포 후 증거를 반영한다. 9월 20일 당시 실행·미실행 서술은 날짜가 드러나도록 보존하고 후속 결과를 연결한다.
2. Cloudflare 새 자산 규칙·AWS 설정·정상 이용자 영향·구 탭·알림의 미검증 범위를 유지한다. 앱 배포를 콘솔 설정 완료로 바꾸지 않는다.
3. 운영자 준비표에서 이미 수행한 초기 설정·DB 반영과 남은 확인을 구분한다. 기존 비공개 입력을 재요청하지 않는다.
4. 루트 README의 운영·수집 안내를 현행 상태 및 문서 역할에 맞추고 legacy/direct와 로컬/원격 증거를 구분한다.
5. 인수표의 12건 미실행 상태를 유지한다. 로컬 sandbox 수집 OFF는 시험 조건이므로 운영 검수 ON에 맞춰 변경하지 않는다. 배포 대기 등 주변 설명만 최신화한다.
6. 문서 목차·deploy 인접 README·관련 planning/system-design/legal은 교차 확인 후 실제 충돌만 최소 수정한다. 제품·법무·입력 계약 결정이 필요하면 미정과 후속 작업으로 남긴다.

## 완료·검증 기준

- [x] 모든 진입점에서 같은 운영 상태와 잔여 작업 문서로 연결된다.
- [x] 과거 검증·최초 설치 설명과 현행 안내가 구분된다.
- [x] 실사용 인수 결과를 자동 검사·배포 기록으로 대신 채우지 않았다.
- [x] 변동값 중복을 줄이고 미정·법무·기능 활성화 조건을 보존했다.

## 실행 결과

- 변경 파일: [보안 상태](../../../docs/operations/security-protection-status.md), [운영자 준비](../../../docs/operations/owner-setup-checklist.md), [루트 README](../../../README.md), [운영자 인수](../../../docs/testing/operator-acceptance.md), [보안·운영 설계](../../../docs/system-design/05-security-operations.md), 이 TASK.
- 9월 20일 보안·최초 설치·legacy/로컬 결과를 당시 기록으로 표시하고, 9월 23일 앱 오류 `no-store` 운영 확인·API V008/Collector V006·관리자 batch 검수 ON을 당시 관측으로 연결했다. 운영 이미지 주소 `media.blariyo.com`의 오래된 `(미정)` 표기를 당시 공개 이미지 검증 근거에 맞춰 정정하고 Access 점검 경로에 `/admin-batch`를 포함했다. 보안 §9 제목·앵커와 수동 인수 12건 미실행, sandbox 수집 OFF를 유지했다.
- 교차 검토: [수집 기획](../../../docs/planning/content-collection/README.md), [법무 차단 항목](../../../docs/legal/README.md), [운영 상태](../../../docs/operations/current-status.md), [배포 설정 도구 안내](../../../deploy/application/README.md) 및 docs/deploy 색인을 대조했다. direct 보존·고지(QD-04)는 `(미정)`이고 실제 MFA·Discord·자동 수집은 완료로 바꾸지 않았다.
- 검증: 변경 대상 5문서의 상대 파일 링크 108개 누락 0, 기존 인바운드 제목 앵커·신규 근거 제목 확인, `git diff --check` 통과. 9월 24일 문서 작업에서 앱 build/test, 서버·DB·Cloudflare/AWS 재조회와 실제 인수는 미실행.
- 잔여: 격리 로컬 sandbox의 운영자 수동 12건과 별도 실제 Access MFA 세션의 관리자 업무·batch 검수 인수, direct 보존·고지 결정과 기능별 gate, Cloudflare 새 자산 규칙·AWS 비용/MFA·알림 수신·정상 이용자/구 탭 검증은 [현재 운영 상태](../../../docs/operations/current-status.md)와 [로드맵](../../../docs/roadmap.md)을 따른다.

## 1차 재검토 후속 보완

- C1-1 반영: 최초 교차 검토에서 누락한 [현행 설계 준비 상태](../../../docs/system-design/design-readiness.md)를 추가 수정했다. 자동 수집 I6/P1/U1과 실제 활성화·운영 수용을 분리하고 Core·수집 보조도 최신 상태 문서로 연결했다.
- 제품 기획에서 이 문서로 들어오는 경로까지 대조하여 위 ‘모든 진입점’ 완료 판단을 보완했다. M1·M1.5 설계 판정과 기능별 법무·미정 조건은 유지했다. 통합 검증은 [후속 결과](RESULTS.md#1차-재검토-보완-결과)를 따른다.
