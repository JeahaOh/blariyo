# M0 Core 세부 결정 반영 및 전체 변경 감사

- 상태: 세부 결정 반영·전체 감사 완료 · 정정 권장 항목 남음
- 기준일: 2026-09-03
- 선행 기록: [사용자 결정 반영 및 재검수](task-02-user-corrections.md)
- 변경 권한: 직전 보고의 세 가지 추천 결정을 확정값으로 정본과 관련 Spec에 반영한다.
- Git 경계: 기존 사용자 변경을 보존하고 stage, commit, push는 수행하지 않는다.

## 확정할 세부 계약

1. 상세 metadata description
   - whitespace를 정리한다.
   - 120자 이하는 원문을 그대로 사용하며 최소 길이를 맞추려고 문구를 덧붙이지 않는다.
   - 120자를 넘으면 Unicode grapheme cluster 기준 앞 119자와 `…`를 사용해 최대 120자로 만든다.
2. 다중 이미지 업로드 `fields[]`
   - 사용자가 파일을 바꿔 해결할 수 있는 크기·형식 validation 오류에만 제공한다.
   - R2·DB 등 `503 DEPENDENCY_UNAVAILABLE`에는 제공하지 않는다.
3. 한 요청에 크기·형식 validation 오류가 함께 있는 경우
   - storage 작업 전에 전체 파일 validation을 완료한다.
   - 하나라도 크기 제한 오류가 있으면 top-level `413 UPLOAD_TOO_LARGE`, 그 외 형식 오류는
     `415 UNSUPPORTED_MEDIA_TYPE`을 사용한다.
   - `fields[]`에는 실패한 파일별 일반화된 이유를 모두 제공한다.
   - validation 실패 요청은 storage를 시작하지 않으므로 `503`과 혼합하지 않는다.

## 하위 작업

1. 공개 상세 description 계약을 planning → system/design 필요 지점 → public browsing Spec 순서로 동기화
2. 업로드 오류 계약을 system-design → admin upload API·D01·D08 순서로 동기화
3. 앞선 변경 완료 후 전체 diff와 현행 planning·legal·system-design·M0 Spec·현재 responsive 검토물 감사
4. 오케스트레이터가 하위 결과를 독립 재검증하고 완료·미검증·차단을 보고

## 감사 기준

- 확정 세부 계약의 정본·Spec 간 값 불일치 0건
- 삭제한 제안 문서와 이전 카피 후보 경로 참조 0건
- 법무 placeholder·출시 차단 조건의 근거 없는 제거 0건
- 구현·OpenAPI·test·runtime 완료 과장 0건
- Markdown 상대 링크, 문서/스크립트 정적 검사와 `git diff --check` 통과
- 변경 파일 범위와 삭제·추가 파일을 포함한 commit 후보 경계 확인

## 결정 반영 결과

- description은 첫 공개 TEXT block plain text의 앞뒤 Unicode whitespace를 제거하고, 내부의 연속된
  Unicode whitespace를 단일 U+0020 space로 치환한 뒤 grapheme 수를 센다. 120자 이하는 그대로,
  초과하면 앞 119자와 단일 `…`를 사용하며 세 description metadata에 같은 값을 넣는다.
- 업로드 요청 단위 개수·전체 합계 gate 초과는 `413 UPLOAD_TOO_LARGE`와 `fields` 생략으로 처리한다.
  gate 통과 뒤 모든 파일을 storage 전에 검증하며, 개별 크기 오류가 하나라도 있으면 top-level `413`,
  그 외 형식·decode 오류만 있으면 `415`다. `fields[]`는 모든 파일별 오류를 포함한다.
- 모든 validation 통과 뒤 R2·DB가 실패한 `503 DEPENDENCY_UNAVAILABLE`에는 `fields`를 넣지 않는다.
  rollback·즉시 보상 삭제·별도 cleanup outbox·24시간 orphan inventory 계약은 유지한다.
- 1차 반영에서 사용자 확정 범위를 넘어 추가됐던 파일 수량별 `fields[]` 매핑은 제거했다.

## 전체 감사 결과

Critical·High는 없다. 다음 불일치가 남아 있어 현 상태를 commit-ready로 판정하지 않는다.

### Medium

1. `docs/ui/publishing/responsive/index.html`의 404 설명이 `권리자 요청으로 검토 중`이라는 내부 사유를
   노출한다. planning과 D08의 원인 비노출 동일 404 계약에 맞춰 일반 문구로 정정해야 한다.
2. 현재 responsive publishing·wireframe은 Kakao 운영값과 Web domain이 미확정인데도 카카오톡 버튼을
   기본 표시한다. 정본 계약처럼 기본 숨김으로 바꾸고 명시적 검토 모드에서만 표시해야 한다.

### Low

1. 현행 화면 설계에서 참고 링크로 연결한 `wireframes/legal`, `wireframes/community`에
   `__SERVICE_DOMAIN__`이 남아 있다. 현재 참고물로 유지하려면 `https://blariyo.com/`으로 맞춘다.
2. `wireframes/legal`의 쿠키 화면이 기본 비활성인 GA4·광고 선택을 항상 표시한다. 활성 기능에 따른
   조건부 표시 또는 후속 활성 상태 전용 시안 표시가 필요하다.
3. 새 카피 정본 `docs/planning/06-copy-contract.md`는 아직 untracked다. commit 시 이전 파일 삭제와
   새 파일 추가를 반드시 함께 포함해야 한다.
4. 이번 결정으로 본문이 변경된 일부 planning·system-design·Spec·publishing 문서의 기준일 또는
   정합성 검토일이 여전히 2026-09-02다. 2026-09-03 검토 사실과 맞춰야 한다.

위 정정 항목은 이미 확정된 정본을 화면·메타데이터에 맞추는 작업이며 새 제품 결정은 필요하지 않다.

## 검증 결과

- `git diff --check`: 통과
- `docs/`, `검수/` Markdown 상대 링크 76개: 통과
- publishing JavaScript와 wireframe inline JavaScript 문법: 통과
- HTML5 parse 4개: 통과
- CSS 중괄호 균형: 통과
- 삭제한 제안 문서·이전 카피 파일 참조: 0건
- 실제 credential·연락처·Measurement ID·Kakao key 하드코딩: 0건
- 범위 밖 `worklog/` 변경: 0건
- 개인정보 보호법 제30조의3과 2026-09-11 시행 예정 표기: 국가법령정보센터 현행 법령과 일치
- 실제 browser 시각·clipboard·mailto·Kakao·GA4·R2·DB·outbox runtime: 미검증
