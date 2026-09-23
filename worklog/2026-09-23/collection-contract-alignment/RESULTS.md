# P1-01 수집 계약 문서 정합성 결과 — 2026-09-23

- 판정: **D01~D03의 현행 direct/legacy 문서 충돌 보완 완료. P1-01 전체는 부분 완료.**
- 범위: 서비스 기획·수집 기획·보안 설계·기능 명세·내부 법무 gate와 후속 계획/요구사항 참조.
- 이번 실행은 문서 변경과 source/권한/OpenAPI 대조다. 앱 코드·migration·공개 정책 본문·기능 flag 변경,
  외부 수집·DB 쓰기·commit·push·배포·운영자 인수는 수행하지 않았다.
- 최초 감사 D01~D03과 과거 검증 수치는 소급 수정하지 않고 이 후속 결과를 연결했다.

## 확인한 충돌과 조치

| ID / 중요도 | 충돌·영향 | 반영한 조치 |
| --- | --- | --- |
| D01 / High | 서비스 기획의 metadata 후보·API 제출·임시 preview 설명을 direct에 적용하면 실제 raw/본문/미디어 저장과 다른 제품 규칙이 됨 | [서비스 기획 §8](../../../docs/planning/01-service-plan.md#8-콘텐츠-수집)과 [수집 기획 §1.2](../../../docs/planning/content-collection/README.md#12-현행-direct와-legacy의-적용-경계)에 현재 direct와 legacy 적용 범위 분리 |
| D02 / High | 보안 문서의 원문 HTML 미저장·넓은 collect DML 설명이 실제 raw 저장 및 역할 분리와 충돌 | [보안·운영](../../../docs/system-design/05-security-operations.md)에 비공개 raw·이미지 검증·결과 7개 SELECT·queue 권한 분리·명시적 허용 목록 반영 |
| D03 / Medium | 기능 명세의 요구표·상태·찾아보기가 legacy 중심이어서 direct 검수 API와 화면을 찾기 어려움 | [기능 명세 §4~12](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md)에 direct 요구표/상태/권한/API/화면 참조 추가, 기존 anchor는 legacy 범위로 보존 |
| 후속 / High | 파싱 결과의 댓글 제외가 파싱 전 raw HTML에도 적용된다고 오해할 수 있음 | raw와 파싱된 본문·공개 결과를 분리. [내부 법무 gate](../../../docs/legal/README.md)에 저장 항목·목적·접근·보존/파기·고지 정합성 확인 추가 |

보안 표의 게시글 이미지 20개 설명도 현행 편집/direct 200개와 legacy 선택 20개로 구분했다.
기존 요청당 수동 업로드 10개/100MiB 및 파일당 10MiB는 유지했다.

## 직접 대조한 구현 근거

- [DirectBatchRunner](../../../apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java):60~66,
  [DirectUrlRunner](../../../apps/collector/src/main/java/com/blariyo/collector/run/DirectUrlRunner.java):68~74:
  상세 응답 bytes를 `collect/raw`에 저장한 다음 parser를 호출한다. raw에서 댓글·프로필·개인정보가
  모두 제거됐다는 보장은 없다. 이번 작업에서 기존 raw object의 내용은 조회하지 않았다.
- [API 소유권 목록](../../../apps/api/src/persistence/collect-ownership.ts):2~4와
  [권한 SQL](../../../deploy/postgresql/apply-privileges.sql):65~89:
  API 소유 collect 10개와 batch 결과 조회 7개를 구분한다. API는 batch queue/confirmation을 쓰지 않는다.
- [BatchMain](../../../apps/collector/src/main/java/com/blariyo/collector/ops/BatchMain.java):57~59,89~91:
  direct 실행기는 주입된 source 설정 파일을 읽는다. 기존 Core source 수정 UI와 같은 설정 저장소가 아니다.
- [수집 OpenAPI](../../../docs/development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml):
  목록·상세·preview·검수·승격 operationId 5개와 문서 추적을 대조했다.
- [개인정보처리방침](../../../docs/legal/privacy-policy.md)의 metadata·미발행 후보 30일 설명과
  direct 저장 범위의 차이를 확인했다. 정책 전문·버전·시행일을 바꾸거나 법률 적합 판정을 내리지 않았다.

## 검증 범위

- 문서 12개에서 상대 링크 375개·추가 링크 anchor 14개 검사: 누락 0. direct API operationId 5개 일치.
- 수정 정본에서 `(미정)`·`[입력 필요]`·`[출시 차단: ...]` 삭제 0. 개인정보처리방침 본문은 HEAD와 동일.
- `git diff --check`와 대상 문서 whitespace 검사 통과. Git은 `main...origin/main [ahead 1]`이며 개별 변경 파일은
  실행 전 179개에서 182개로 증가했다. 새 결과 파일과 이번에 변경 목록에 들어온 기획/법무 문서가 추가된 수량이다.
- Core 이미지 입력 SHA-256은 기존 후보의 `00630e561cb9ad1b9a1edc4c6cafad1626c6ef9ab1be91f3f78aab36936cdfa5`와 동일하다.
  이 문서 변경으로 이미지를 새로 빌드하지 않았다.
- 결과 원본: `test-results/collection-contract-alignment/verification.json` (Git 제외).
- 문서만 변경했으므로 앱/DB/browser 테스트를 재실행하지 않았다. 이전 테스트 통과를 이번 실행으로 집계하지 않는다.

## 남은 결정과 재개 조건

| 항목 | 현재 상태 | 다음 작업 |
| --- | --- | --- |
| QD-03 Web URL 전달 | 미정 | API 소유 요청함 polling 또는 인증된 batch 입력 endpoint의 소유권·멱등·장애 보존 계약 결정 |
| QD-03 source 변경 | 미정 | direct 설정 정본·변경 담당·버전 식별·읽기 전용 표시 계약 결정 |
| QD-04 raw/media/report/queue | 보존 기간·승격 후 원본·실패 orphan 유예·감사 보존 미정 | 실제 기간과 참조 보호 확정 후 전용 dry-run/회수 구현·검증 |
| 고지 정합성 | 미검증 | 저장 항목/목적·접근·보존/파기 계약에 맞춰 해당 수집 기능 활성화 전에 확인 |
| 운영 수용 | 별도 미완료 | 원격 최종 CI, 실제 운영자·Access·다른 PC/DB/object·Discord·Windows·운영 관찰 |

미정 기간에 legacy 30일/24시간을 대입하거나 사용자 답변 없이 입력 전달안을 확정하지 않는다.
수집 기능의 조건을 Core 수동 콘텐츠 운영 전체의 새로운 차단 조건으로 확대하지 않는다.
현재 40개 요구사항은 I 29 / P 10 / U 1을 유지하며 O08을 문서 수정만으로 완료 처리하지 않는다.
