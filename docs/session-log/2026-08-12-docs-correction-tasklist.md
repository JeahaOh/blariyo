# Blariyo 기획 문서 정정 Tasklist

- 작성일: 2026-08-12
- 기준: `2026-08-11-docs-full-audit-tasklist.md`의 17개 발견 사항
- 대상: `docs/` 기획·정책·와이어프레임·퍼블리싱·세션 기록
- 상태: 완료

## 1. 정본 결정

- [x] 게시판은 `유머`, `이야기` 2개만 유지한다.
- [x] `/`는 두 게시판의 최신 글을 섞어 보여주되 별도 게시판명이나 세 번째 메뉴를 만들지 않는다.
- [x] 목록과 상세 하단 목록은 게시글 20개로 고정하고 광고 행은 개수에서 제외한다.
- [x] 상세 탐색은 같은 게시판의 현재 글 주변 20개 목록만 사용하고 이전·다음 버튼은 두지 않는다.
- [x] 상세 광고는 본문·출처 다음, 하단 목록 중간, 하단 목록 아래만 사용한다.
- [x] 자동 수집은 M1 운영 자동화 후보로 허용하되 수집 결과는 임시 큐에만 저장하고 자동 발행하지 않는다.
- [x] 게시글, 권리, 후보수집, 검수, 발행 상태와 허용 전이를 하나의 계약으로 통일한다.
- [x] 내부 필수 운영 통계와 동의 기반 GA4 분석을 분리한다.
- [x] 정책 4개 route와 공유·OG 계약을 M0 범위에 포함한다.

## 2. 파일군별 정정

### A. 서비스·벤치마크 정본

- [x] `planning/01-service-plan.md` 범위·IA·데이터·API·상태·검토 결과 정정
- [x] `planning/05-benchmark-spec.md` 메뉴·기능·수집·API·상태 계약 정정
- [x] `planning/06-copy-candidates.md` 보류 상태와 타 문서 참조 정합성 확인

### B. 화면·와이어프레임·퍼블리싱

- [x] `planning/03-screen-design.md` 목록·상세·광고·정책·공유·접근성 정정
- [x] `wireframes/responsive/index.html` 현행 화면 계약 반영
- [x] `wireframes/legal/index.html` 분석·광고 독립 선택과 정책 route 반영
- [x] `wireframes/ads/index.html` 상세 광고 3개 위치와 차단 상태 반영
- [x] `publishing/responsive/` 목록 20개, 상세 하단 목록, 공유, 상태, 정책 링크 정정

### C. 분석·광고·정책

- [x] `planning/04-analytics-ad-plan.md` 이벤트 동의·익명 식별자·광고 슬롯·제휴 계약 정정
- [x] `legal/privacy-policy.md` 필수 운영 통계와 선택 분석, 처리업체 확정 전 항목 정정
- [x] `legal/cookie-settings.md` 쿠키·localStorage·sessionStorage 및 분석·광고 선택 정정
- [x] `legal/rights-request.md` 접수·임시 비노출·통보·재검토 흐름 정정
- [x] `legal/terms-of-service.md`, `legal/README.md` 연계 정합성 정정

### D. 인프라·기록·안전

- [x] `planning/02-infra-plan.md` 자동 수집·분석·광고·도메인·상태 계약 정정
- [x] `docs/docker.md` 파괴적 한 줄 명령 제거 및 안전한 개발 절차로 교체
- [x] `session-log/2026-08-08-service-planning.md` 대체됨 표시와 현행 정본 링크 추가
- [x] `session-log/README.md` 최신 결정 우선 규칙 추가
- [x] archive HTML 내부에 과거 비교용 표시 추가

## 3. 교차검증

- [x] 금지된 이전·다음 UI/API/컴포넌트가 현행 문서에서 제거됐는지 확인
- [x] `size=12`, 상세 상단 광고, 과거 서비스명이 현행 문서에 남지 않았는지 확인
- [x] 자동 수집 단계와 자동 발행 금지 규칙이 모든 문서에서 일치하는지 확인
- [x] 후보·게시글·권리 상태와 최종 발행 API가 일치하는지 확인
- [x] 필수 내부 이벤트와 선택 GA4·광고 동의가 정책 문서와 일치하는지 확인
- [x] 정책 route, 공유 route, canonical·OG가 퍼블리싱과 일치하는지 확인
- [x] HTML·JavaScript 문법과 Markdown 링크를 검사
- [x] `git diff --check` 통과

## 4. 완료 결과

- 서브에이전트 4개 검토 축(서비스·벤치마크, 화면·퍼블리싱, 분석·정책, 인프라·기록)을 합쳐 현행 문서 25개를 정정했다.
- 게시판 2개, 목록 20개, 상세 주변 목록, 상세 광고 3개, 수집·검수·초안·발행 상태, 내부 통계·GA4 경계를 정본 계약으로 통일했다.
- M1 이메일 인증·비밀번호 재설정·계정 관리·탈퇴 흐름과 M1.5 사용자당 하루 1건·전체 주 5건·운영 중단 기준을 보강했다.
- 실제 도메인이 문서에 입력되기 전까지 모든 현행 URL 예시는 `__SERVICE_DOMAIN__`으로 통일하고 출시 차단 조건으로 유지했다.
- 검증 결과: `git diff --check` 통과, JavaScript 및 HTML inline script 문법 통과, Markdown 상대 링크 검사 통과.
- 기존 소스 코드 변경과 `2026-08-11-docs-full-audit-tasklist.md`는 이번 정정에서 수정하지 않았다.
