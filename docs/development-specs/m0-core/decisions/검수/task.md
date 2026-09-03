# M0 Core 전체 변경 정합성 검수

- 상태: 검수 완료 · 정정 전 커밋 비권장
- 기준일: 2026-09-03
- 요청: 현재 작업 트리의 전체 변경을 기준으로 문서 간 정합성을 검수한다.
- 작업 방식: 하위 에이전트가 영역별로 검수하고, 루트 에이전트가 정본·현재 diff·Git 상태와 직접 대조해 최종 판정한다.
- 변경 경계: 검수만 수행한다. 기존 문서 수정, stage, commit, push는 하지 않는다.

## 검수 범위

- 현재 추적 변경 43개 Markdown 문서
- `docs/planning/`, `docs/legal/`, `docs/system-design/` 정본
- `docs/development-specs/m0-core/`의 결정 색인, 보강서, API, D01, D08
- OD-M0-001~013의 확정·보류·활성화 차단·출시 차단 상태

## 제외 범위

- source, migration, OpenAPI, test, build, runtime, browser, deployment의 실제 구현 검증
- 정적 publishing·wireframe 변경: 현재 diff에 포함되지 않으므로 변경 검수 대상에서 제외
- 기존 로컬 커밋 4개의 내용 재감사: 현재 미커밋 변경과의 경계만 확인

## 에이전트 과업

1. API·관리자·예약 발행 계약 검수
   - OD-M0-001~005, OD-M0-012
   - API status/code/envelope, all-or-nothing, scheduler·재시도 규칙
2. 공개 탐색·공유·카피 계약 검수
   - OD-M0-008~009, OD-M0-013
   - canonical URL, SSR metadata fallback, Kakao 활성화 차단, public copy config
3. 법무·권리·분석 계약 검수
   - OD-M0-006~007, OD-M0-010~011
   - placeholder·출시 차단, mailto 범위, 동의 전 요청 0건, GA4 비활성 조건

## 공통 판정 기준

- planning → legal/system-design → development-spec 순서의 계약이 충돌하지 않는가
- 결정 색인의 상태와 소유 정본·관련 Spec의 실제 문구가 일치하는가
- `(미정)`, `[입력 필요]`, `[출시 차단]`이 근거 없이 제거되지 않았는가
- 문서 작성 완료를 구현·실행 완료로 과장하지 않았는가
- 상대 링크가 실제 파일을 가리키는가
- 실제 credential, 개인정보 또는 추정 운영값이 추가되지 않았는가
- `git diff --check`가 통과하고 의도하지 않은 파일이 섞이지 않았는가

## 보고 형식

- 발견 사항은 Critical, High, Medium, Low 순으로 기록한다.
- 각 발견은 `파일:행`, 영향, 정본/반증, 최소 수정 방향을 포함한다.
- 확인된 오류와 추가 확인이 필요한 의심을 분리한다.
- 마지막에 완료, 미검증, 차단, commit 가능 여부를 구분한다.

## 최종 검수 결과

### High

1. `recommended-decisions.md`가 확정 결과와 충돌한다.
   - OD-M0-007에 확정 결정과 정반대인 copy fallback을 권장한다.
   - OD-M0-010에 금지된 `post_id`와 오래된 parameter 이름을 권장한다.
   - OD-M0-006에서 보류한 사업자 정보를 M0 production 필수값처럼 묶는다.
   - OD-M0-013은 폐기한 후보 A를 권장하고, 체크리스트 대부분은 여전히 `(미정)`이다.
2. 확정 도메인 `https://blariyo.com/`이 상위 API·벤치마크 정본에 반영되지 않았다.
   - `docs/system-design/03-api-design.md:260`
   - `docs/planning/05-benchmark-spec.md:169-170`
3. all-or-nothing 업로드의 보상 삭제 영속성 경계가 없다.
   - DB rollback 뒤 즉시 object 삭제까지 실패하면 같은 transaction에 outbox를 남길 수 없다.
   - 별도 upload intent/삭제 outbox transaction과 process crash 회수 계약이 필요하다.

### Medium

1. OD-M0-002에서 사용자가 확정한 “추후 일반 사용자 업로드도 all-or-nothing” 문구가 이번 diff에서 제거됐다.
2. 관리자 검색 결과 0건에서 `page=2`이면 `hasPrevious=totalPages>0`이 `false`가 되는 경계 오류가 있다.
3. 예약 API 하위 Spec의 offset 필수·UTC 정규화가 상위 API 정본에 없고, D08에는 `07:30`·`17:30` 기본 슬롯과 임의 시각 UX가 없다.
4. GA4 활성화 조건의 전체 목록이 상세 정본과 상위 요약 문서에서 다르다. `planning/01-service-plan.md`와 `system-design/01-system-architecture.md`는 실제 Google 계약 법인과 tag/CSP domain 조건을 생략한다.
5. 이미지 URL 예시는 별도 `IMAGE_ORIGIN` 계약 대신 `img.__SERVICE_DOMAIN__`을 가정한다.
6. TEXT description의 `80~120자` 규칙은 짧은 본문, 절단 단위와 말줄임 처리까지 정의하지 않아 결정적이지 않다.
7. 현재 diff 밖의 publishing·wireframe은 확정 도메인·카피·Kakao 비활성 표시와 동기화되지 않았다. 제품 정본은 아니지만 다음 시각 검수에서 오해 가능성이 있다.

### Low

1. OD-M0-009가 결정 색인에서는 `확정·동기화 완료`, 공개 탐색 보강서에서는 `부분 확정`으로 표시된다.
2. `copy-proposals.md`의 “확정 시 동기화 대상/남은 동기화”와 `reference-site-copy-research.md`의 옛 metadata 제안이 stale 상태다.
3. `open-decisions.md` 기준일은 2026-09-02인데 2026-09-03 완료 내용을 담고 있다.
4. 분석 보강서의 개인정보처리방침 참조가 실제 GA4 조항 §10 대신 §11을 가리킨다.

## 통과 항목

- Critical 발견 없음
- 추적 변경 43개 Markdown 상대 링크 존재 검사 통과
- `git diff --check` 통과
- 실제 credential·연락처·Measurement ID·provider secret 추가 없음
- 법무 placeholder와 M0 Core production 출시 차단 유지
- 저장된 분석 동의 전 Google tag/request/cookieless ping 0건 계약 일치
- Kakao·GA4 운영값 미확정 시 해당 provider 활성화 차단 유지
- 구현·runtime 완료 과장 없음

## 미검증·차단

- 미검증: source, migration, OpenAPI, test, build, runtime, browser, SSR, provider 설정
- 출시 차단: OD-M0-006 법무·문의 실값, 실제 사용 수탁자, 시행일, 로그 적법 근거
- 기능 활성화 차단: Kakao 운영값·Web domain, GA4 운영값·법무 고지
- Git: 제품 문서 수정·stage·commit·push는 수행하지 않음
