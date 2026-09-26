# S02 — 제품 변경·브라우저 회귀·원문 fixture 보존

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-27 · GOV-30 · GOV-32**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 제품 변경과 원문 보존; 필요한 회귀 수정은 별도 유지 후보. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S02-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

governance 철회 과정에서 기존 제품 변경과 수집 원문이 사라지지 않도록 보존 범위를 확정하고, 선택된 브라우저 회귀 수정만 분리한다.

local main `e51f1b501f7cc327da279102dd69eac2f4c554db`까지 8개 commit, PR #3/#4/#6, stash 원문 HTML 49개. #3은 이미 develop에 병합됐고 T1의 #4 선반영 patch는 취소됐다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`inventory.json`의 `legacyMain` 제품 경로 70개와 설계 경로 2개, `stashOriginalHtmlFixtures`, `tests/browser/admin-workflow.test.ts`, `tests/browser/admin-recovery.test.ts`, `apps/collector/src/test/resources/sites/**/*.html` 및 provenance. 파일 색인의 GOV-30 중첩 경로도 포함한다.

S01-A 이후 독립 작업본에서 진행. S06은 제품 보호 목록이 나오기 전 해당 경로를 수정하지 않는다. package/workflow는 직접 바꾸지 않고 S10에 변경 요구를 전달.

## 수행 순서

1. 기존 8개 commit의 SHA·제목·변경 경로를 대조한다. governance 설계 전용 `21b8828d07e059fc93b23caf81d0ecf97957cb15`의 두 문서와 나머지 제품 변경을 분리한다. 원래 commit 이력을 재작성하지 않는다.
2. 제품 경로별 원본 blob·현재 blob·남길 변경을 표로 만든다. GA4/GTM, 관리자 접근·수집 UX의 구현 보존과 운영/배포 수용은 별도 상태로 둔다.
3. #3의 이미지 재조회 대기와 #6의 공개 사이트 링크 선택자 변경을 현재 후보에서 직접 확인한다. #4/#5 실패 및 원복된 T1 로그를 현재 수정 완료 증거로 사용하지 않는다. 유지 실행이 요청된 경우 해당 회귀 수정만 후보에 적용한다.
4. HTML 49개 각각의 stash 부모 원문·stash 변형본·현재 사본 hash와 provenance를 S01 원문 백업에 연결한다. 원문 보존을 기본으로 하고 stash 전체 재적용은 하지 않는다. 변형본 재사용을 선택한 경우에만 파일별 의미 차이를 검토한다.
5. S06에 제품·원문 보호 경로와 선택한 변경 단위를 전달한다. 제품 경로라는 이유로 이후 필요한 포맷 변경을 전부 금지하지는 않되, 같은 hunk를 동시에 수정하지 않는다.

## 검증과 완료 조건

- 보존된 commit과 제품 경로 70개가 archive/선택 후보에서 추적 가능하며 governance 설계 2개와 구분됨.
- 49개 원문과 변형본의 파일별 hash·provenance를 확인. 내용 수정이 없다면 Collector 전체 실행을 새 완료 조건으로 추가하지 않음.
- 브라우저 수정 시 선택한 build와 해당 browser test를 실행하고 실제 검증한 SHA·diff hash를 기록. 원격 CI나 운영 상태는 별도로 보고.

완료 조건:

- 보존 대상 누락 여부와 선택자 수정의 적용/보류 상태가 명시됨.
- 실제 수정이 있으면 해당 회귀가 통과하고, 미실행·환경 차단은 성공으로 쓰지 않음.

중단/보존 조건:

- 원문/제품 변경의 유일한 사본을 찾지 못하면 해당 경로 원복 중단.
- 동일 파일의 다른 세션 변경과 구분할 수 없으면 그 파일을 보존하고 충돌 내역 인계.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

제품·원문 보호 목록, 선택한 browser patch와 검증, 미수용 운영 항목을 S06/S10/S11에 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S02 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S02-product-preservation.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S02-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-27 — 관리자 브라우저 회귀 수정

- 분야/중요도: 제품 테스트 / Medium.
- 근거: #3 `tests/browser/admin-workflow.test.ts`, #6 `tests/browser/admin-recovery.test.ts`, 취소한 T1 patch·로그.
- 완료: #3의 편집기 재조회 후 이미지 재시도 대기 수정은 source CI success 및 develop 병합 완료다. #6의 공개 사이트 링크 선택자 수정은 해당 후보의 verify 성공에 포함된다.
- 미완료: #4/#5에는 선택자 불일치가 남아 실패했다. T1에서 #4에 선반영한 2줄은 사용자 요청으로 원복했다. 따라서 T1의 8/8 로컬 성공을 현재 #4가 고쳐졌다는 증거로 쓰면 안 된다.
- 유지/원복: governance 운영과 직접 관계없는 제품 테스트 수정이다. #3의 이미 병합된 이력을 없애거나 #6 전체를 버리며 필요한 회귀 수정까지 잃지 않도록 별도 선택한다. main 배포 여부는 이 issue의 완료 주장에 포함하지 않는다.

### GOV-30 — 기존 제품 변경 보존

- 분야/중요도: 제품 기능·기존 이력 / High.
- 근거: local main `e51f1b5`의 기존 8개 commit, PR #4. JSON `legacyMain`에 전체 SHA·제목·제품 경로 70개·설계 경로 2개를 분리했다.
- 진척: GA4/GTM·관리자 접근·수집 검토 UX와 관련 기록의 기존 SHA는 보존됐다. 그중 governance 전용 설계 commit은 `21b8828`의 두 문서다.
- 미완료: PR #4의 develop 통합은 미완료이며 governance 철회와 별개다. 기존 제품 변경의 운영 수용을 이번 inventory가 새로 완료 판정하지 않는다.
- 유지/원복: governance 이전의 `8af7244`로 main 전체를 강제 reset하면 제품 변경도 잃는다. **제품 변경은 보존 대상으로 둔다.** FILES의 GOV-30 표시는 같은 파일에 제품 변경이 섞였다는 경고다. branch·commit 이름만 보고 통째로 버리지 않는다.

### GOV-32 — stash의 수집 원문 HTML fixture 49개

- 분야/중요도: 원문·제품 회귀 데이터 / High.
- 근거: stash의 **추적 파일 수정**을 파일 색인과 대조해 추가한 `apps/collector/src/test/resources/sites/**/*.html` 49개. stash는 부모 2개이며 별도 미추적 tree가 없다. JSON `stashOriginalHtmlFixtures`에 기준 blob·stash blob·각 SHA-256·현재 작업본 사본을 기록했다.
- 진척: PR·현재 diff만 조사했을 때 빠졌던 arcalive, bobaedream, dcinside, dogdrip, inven 등 HTML 변경을 포함했다. 49개 모두 stash 기준 부모의 원문과 일치하는 현재 사본이 있고, stash의 변경된 byte와 일치하는 현재 사본은 확인되지 않았다. raw HTML과 포맷된 JSON fixture·provenance는 같은 산출물이 아니다.
- 미완료: stash의 변형이 의미상 안전한 포맷인지, 재사용할 변경인지 이번 inventory에서 수용 판정하지 않았다. 기준 원문과 stash 변형본을 같은 내용으로 취급하지 않는다.
- 유지/원복: 현재 보존된 원문을 유지한다. **stash 전체를 재적용하면 원문 HTML 49개도 다시 바뀔 수 있다.** stash 삭제나 recovery worktree 제거 전 두 버전과 provenance를 보관하고 비교한다. 제목·요약이나 JSON 일부로 원문 보관을 대신하지 않는다.
