# S07 — 기존 migration SQL·checksum 호환 조합

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-18**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: SQL·계약·실행기·회귀를 한 조합으로 선택. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S07-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

SQL 원복/유지 선택이 기존 DB migration 인식과 충돌하지 않도록 파일 조합과 필요한 검증을 확정한다.

PR #6의 API V001\~V008, Collector V001\~V006, 콘텐츠 migration과 checksum 보완. 등록된 previous/current 쌍 제한은 구현됐지만 실제 대상 DB ledger는 inventory에서 조회하지 않았다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

관련 migration SQL, API `migration-checksum-compatibility.ts`·migrations 실행 경로, Collector `MigrationMain.java`, `scripts/content/migration-checksum.mjs`, `docs/migration/contract-evolution.json`, 관련 회귀. 정확한 경로는 FILES의 GOV-18 전체를 사용한다.

S04의 config 작업과 병행 가능. SQL/source caller/계약/관련 회귀는 이 세션만 편집; S06의 대량 포맷에서 제외.

## 수행 순서

1. 원본 SQL과 현재 SQL의 byte/hash, 승인된 previous/current 쌍, 호출 실행기·계약·시험을 한 표에 연결한다.
2. 과거 SQL 재포맷 유지 또는 원본 SQL 복원 중 선택된 방향에 대해 실제 ledger가 이전/현재 hash를 가진 경우를 따로 분석한다. DB 상황을 확인하지 않고 호환 helper만 삭제하지 않는다.
3. 실제 적용 DB에 대한 수용까지 요청된 경우에만 적절한 접근으로 ledger를 읽기 전용 조회하고 비밀·행 데이터는 기록하지 않는다. 권한이 없으면 코드 후보 검증과 실제 DB 미검증을 분리한다. ledger 수정은 이 task의 조치로 사용하지 않는다.
4. 선택한 SQL·계약·helper·caller·tests를 함께 수정한다. 알 수 없는 checksum을 폭넓게 허용하는 우회는 하지 않는다.
5. S04/S06에 SQL 포맷 대상/제외 원칙을 전달하고 S08에 실제 검증할 migration 조합·SHA를 전달한다.

## 검증과 완료 조건

- 정확한 현재 hash, 승인된 previous/current 쌍 허용; 미등록·변조 쌍 거부의 기존 회귀.
- API·Collector·콘텐츠 caller가 같은 계약을 사용하는지 확인. 관련 migration 시험은 격리 fixture/DB에서 실행.
- 실제 DB ledger 조회 여부·대상·시각을 별도로 표시. 운영 적용을 하지 않았다면 운영 호환 완료로 쓰지 않음.

완료 조건:

- 최종 선택한 SQL·계약·실행기 조합과 회귀 결과가 일치함.
- 실제 DB 적용 판단이 필요한 경우 필요한 ledger 근거가 있거나 미검증 차단으로 명시됨. DB 값 변경 없이 결과를 인계.

중단/보존 조건:

- 승인되지 않은 hash, 원본 SQL 부재, 실제 ledger와 후보 조합의 불일치가 보이면 해당 적용/삭제 중단.
- DB 접근 불가를 해결하려고 migration 실행·ledger 수정을 자동 시도하지 않음.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

원본/최종 hash 조합, 유지/철회 helper 목록, 회귀와 DB readback 구분을 S04/S06/S08/S10에 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S07 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S07-migration-checksum.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S07-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-18 — 기존 migration SQL과 checksum 호환

- 분야/중요도: DB 호환 / High.
- 근거: API `migration-checksum-compatibility.ts:38`, `migrations.service.ts`, Collector `MigrationMain.java`, `scripts/content/migration-checksum.mjs`, `docs/migration/contract-evolution.json`, migration 관련 회귀.
- 진척: API V001\~V008, Collector V001\~V006, 콘텐츠 migration의 포맷 변경과 승인된 previous/current hash 쌍 제한이 있다. 현재 hash의 정확한 일치 또는 등록된 쌍만 허용하며 미등록·변조 거부 회귀를 추가했다. H6의 기존 verify·collector CI success.
- 미완료: 실제 개발/운영 DB ledger가 어떤 hash를 보유하는지 이번 목록 작성에서 조회하지 않았다. 최종 남길 SQL/호환 코드 조합의 수용도 아직 없다.
- 유지/원복: **SQL만 되돌리거나 호환 함수만 제거하지 않는다.** 원본 SQL, 실행기, 계약 JSON, 회귀를 같은 조합으로 판단한다. 기존 ledger 수동 수정은 이 목록이나 일반 코드 원복에 포함되지 않는다. lint를 유지하는 것과 과거 migration 전체 재포맷을 유지하는 것은 별도 선택이다.
