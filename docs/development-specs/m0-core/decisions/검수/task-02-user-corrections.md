# M0 Core 사용자 결정 반영 및 재검수

- 상태: 문서 정정 및 정적 검수 완료 · browser/runtime 미검증
- 기준일: 2026-09-03
- 선행 검수: [전체 변경 정합성 검수](./task.md)
- 변경 권한: 아래 사용자 확정사항에 한해 정본과 파생 Spec을 수정한다.
- Git 경계: stage, commit, push는 수행하지 않는다.

## 사용자 확정사항

1. mail client를 사용할 수 없는 경우 권리 접수 이메일 주소를 복사할 수 있게 한다.
   - browser가 mail client 실행 성공·실패를 신뢰성 있게 감지한다고 가정하지 않는다.
   - `mailto:`와 별도로 항상 접근 가능한 `이메일 주소 복사` 동작을 둔다.
   - 복사 범위는 이메일 주소만이며 제목·본문 copy fallback은 만들지 않는다.
2. 확정 서비스 기준 URL `https://blariyo.com/`을 남은 상위 정본과 관련 Spec에 반영한다.
3. all-or-nothing 업로드의 rollback 후 object 보상 삭제는 유지한다.
   - 즉시 삭제 실패 시 rollback과 분리된 cleanup transaction으로 삭제 outbox를 남긴다.
   - process crash로 outbox도 남지 않은 object는 24시간 orphan inventory가 회수한다.
4. 과거 추천·카피 제안은 현행 정본으로 보관하지 않는다.
   - `recommended-decisions.md`, `copy-proposals.md`를 삭제하고 모든 참조를 현행 소유 정본으로 교체한다.
   - 확정 카피 문서에 남은 폐기 후보 이력도 제거한다.

## 하위 에이전트 작업

1. 권리 문의·공개 URL·카피 정리
   - planning, legal, public browsing, policy-and-rights 동기화
   - 과거 제안 문서 삭제 및 참조 정리
   - `open-decisions.md`는 최종 통합 담당자가 수정
2. 업로드 보상 삭제·관리자 계약
   - data model, API, infrastructure, security, 관리자 Spec 동기화
   - 확정 URL·IMAGE_ORIGIN 예시 중 system-design 소유 부분 정리
   - `open-decisions.md`는 수정하지 않음
3. 독립 정합성 검수
   - 앞의 두 변경 완료 후 결정 색인과 잔여 링크·placeholder·GA4 조건을 대조
   - `open-decisions.md`를 최종 확정 내용에 맞춰 한 번만 수정

## 완료 조건

- 삭제한 제안 문서로 향하는 링크 0건
- mailto와 이메일 주소 복사 계약이 planning·legal·D01·D08에서 일치
- `__SERVICE_DOMAIN__`이 현행 M0 정본과 현재 responsive 검토물에서 제거됨
- rollback 뒤 보상 삭제·별도 outbox·orphan 회수 경계가 모순 없이 연결됨
- Markdown 상대 링크 검사와 `git diff --check` 통과
- 실제 이메일, IMAGE_ORIGIN, credential을 추측하지 않음

## 반영 결과

- 권리 문의는 `mailto:`와 독립된 `이메일 주소 복사`를 항상 함께 제공한다. browser가 mail client
  실행 성공·실패를 신뢰성 있게 알려준다고 가정하지 않으며, 복사는 이메일 주소만 대상으로 한다.
- 서비스 기준 URL과 canonical·공유 URL을 `https://blariyo.com/`으로 동기화했다.
- 이미지 URL 예시는 문서 전용 `https://media.example.invalid/...`로 통일하고 실제 응답은
  `IMAGE_ORIGIN` 설정을 사용하도록 명시했다.
- 업로드 DB rollback 뒤 이미 저장된 object를 즉시 보상 삭제한다. 실패하면 rollback과 분리된 cleanup
  transaction으로 `OBJECT_DELETE_PRIVATE` outbox를 남기고, 기록 전 process crash는 24시간 orphan
  inventory로 회수한다.
- 과거 제안 문서 `recommended-decisions.md`, `copy-proposals.md`를 삭제했다. 확정 카피만 남긴 정본은
  `docs/planning/06-copy-contract.md`로 이름을 바꾸고 현행 참조를 갱신했다.
- 이미 확정된 조회 수 오류가 미결정으로 남아 있던 `public-post-browsing/d01/view-post.md`의 stale 문구를
  `400 VALIDATION_FAILED` 확정·runtime 미검증으로 정정했다.

## 직접 검수 결과

- `git diff --check`: 통과
- 새 미추적 카피 계약 파일의 whitespace 검사: 통과
- Markdown 상대 링크: `docs/`, `검수/`의 75개 파일 통과
- 정적 JavaScript 문법, HTML inline script 문법, CSS 중괄호 균형: 통과
- 현행 docs의 삭제 문서·이전 카피 후보 파일 참조: 0건
- 현행 M0 정본·현재 responsive 검토물의 `__SERVICE_DOMAIN__`, `__IMAGE_ORIGIN__`: 0건
- 변경 추가분의 credential·실제 contact email 하드코딩: 발견 0건
- 실제 browser 화면·clipboard·mailto 동작: browser 도구 cache 의존성 불일치로 미검증
- 앱 source·OpenAPI·migration·test·R2·DB·outbox runtime: 현재 브랜치에 실행 증거가 없어 미검증

## 남은 결정과 운영 입력

현재 정정 범위에 새 제품 방향 결정은 없다. 다만 구현 계약을 모호하지 않게 하려면 다음 세부값은
추가 확정이 필요하다.

1. 상세 metadata description의 짧은 본문 처리, 120자 초과 절단·말줄임표와 글자 수 기준
2. 다중 업로드 `fields[]`를 사용자 수정 가능한 파일 검증 오류에만 제공할지 여부
3. 한 요청에 크기·형식 오류가 함께 있을 때 top-level HTTP status와 error code의 우선순위

법무 contact·시행일·실제 수탁자, Kakao key·Web domain, GA4 운영값·법무 고지는 설계 선택이 아니라
production 또는 해당 provider 활성화 전에 채울 운영 실값이다.
