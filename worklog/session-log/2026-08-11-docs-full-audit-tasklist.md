# Blariyo 기획 문서 전수 검토 Tasklist

> 대체됨 · 과거 감사 기록. 현행 게시판·권리·게시 빈도·이미지 저장 기준은 [01-service-plan.md](../../docs/planning/01-service-plan.md)와 [2026-08-12-board-policy-correction.md](./2026-08-12-board-policy-correction.md)를 따른다. 아래 MySQL 경로와 진단은 당시 기록이며 현행 데이터베이스 기준은 [2026-08-14 PostgreSQL 전환 결정](./2026-08-14-postgresql-transition.md)을 따른다.

- 작성일: 2026-08-11
- 대상: `docs/` 아래 기획, 설계, 정책, 와이어프레임, 퍼블리싱, 세션 기록
- 방식: 다관점 독립 검토 후 교차검증
- 상태: 완료

## 1. 검토 범위

- [x] `docs/planning/` 서비스·인프라·화면·광고·분석·벤치마크·카피 기획 검토
- [x] `docs/legal/` 약관·개인정보·권리자 요청·쿠키 정책 검토
- [x] `docs/wireframes/` 반응형·정책·광고·참고 화면 검토
- [x] `docs/publishing/` 실제 퍼블리싱 파일과 기획 정합성 검토
- [x] `docs/session-log/` 최종 결정과 과거 기록의 충돌 검토
- [x] `docs/docker.md`의 현행 구성 및 기획 문서 연결성 검토

## 2. 독립 검토 트랙

- [x] 제품·IA: 목표, 메뉴, 게시판, 단계별 범위, 운영 흐름
- [x] UX·반응형: 데스크톱/모바일 웹, 목록·상세·정책 화면, 접근성
- [x] 기술·데이터: API, 상태 모델, 페이지네이션, 수집·검수·발행, SEO/OG
- [x] 광고·법무: 광고 슬롯, 광고 차단, 제휴, 쿠키, 개인정보, 저작권

## 3. 공통 정합성 체크

- [x] 게시판 수와 메뉴 명칭이 모든 문서에서 일치하는가
- [x] 목록은 게시글 20개와 광고 행의 산정 기준이 명확한가
- [x] 상세 출처는 하단 한 번만 노출되는가
- [x] 상세 광고가 본문 하단, 하단 목록 중간, 목록 아래에 배치되는가
- [x] 이전 글·다음 글 없이 상세 하단 목록으로 탐색하는가
- [x] 공유 기능과 KakaoTalk·X 및 OG 메타 계약이 연결되는가
- [x] 자동 후보 수집과 수동 검수·예약/발행 경계가 명확한가
- [x] 광고 차단 해제 요청과 쿠키 설정·동의 정책이 충돌하지 않는가
- [x] 쿠팡 파트너스 및 일반 광고 표시 기준이 구분되는가
- [x] 반응형 와이어프레임과 퍼블리싱 결과가 같은 화면 계약을 따르는가
- [x] 보관용 문서가 현행 문서로 오인되지 않도록 구분되는가

## 4. 완료 조건

- [x] 모든 지적에 파일·줄 근거를 붙인다
- [x] 중복 지적을 합치고 상충 의견을 판정한다
- [x] 심각도와 신뢰도를 부여한다
- [x] 각 지적에 강제형 수정안을 작성한다
- [x] 최종 결과와 우선순위를 이 문서에 기록한다

## 5. 검토 결과

### 5.1 판정 요약

- 검토 라운드: 4차
- 대상: `docs/` 26개 파일
- 독립 검토: 제품·IA, UX·반응형, 기술·데이터, 광고·법무 4개 트랙
- 총 17건: Critical 0, High 9, Medium 8, Low 0
- 신뢰도: High 16, Medium 1, Low 0
- 결론: AA·구현 이슈 분해 전에 High 9건을 먼저 정리해야 한다. 현 상태로 구현하면 화면, API, 분석 동의, 수집·발행 계약이 서로 다른 기준으로 만들어진다.

### 5.2 발견 사항

| ID | 심각도 | 유형 | 신뢰도 | 요약 |
| --- | --- | --- | --- | --- |
| E4-1 | High | 오류 | High | `docs/docker.md`에 데이터 삭제 명령이 설명·보호장치 없이 노출됨 |
| C4-1 | High | 모순 | High | 이전·다음 버튼 제거 결정과 컴포넌트·API·광고 흐름이 충돌함 |
| C4-2 | High | 모순 | High | 상세 상단 광고 금지와 상·하단 배너 실행 문구가 충돌함 |
| C4-3 | High | 모순 | High | M1 자동 크롤링 제외와 M1 자동 후보수집 설계가 충돌함 |
| E4-2 | High | 오류 | High | 후보 승인 이후 초안·최종 발행 API와 멱등 계약이 끊겨 있음 |
| C4-4 | High | 모순 | High | 후보수집 상태와 게시글·권리 상태 모델이 문서마다 다름 |
| C4-5 | High | 모순 | High | 무동의 내부 이벤트와 개인정보·쿠키 고지 및 7일 식별자 계약이 충돌함 |
| E4-3 | High | 오류 | High | 상세 공유·OG 퍼블이 홈 hash 화면에 묶여 게시글별 미리보기를 검증할 수 없음 |
| C4-6 | High | 모순 | High | 정책 화면·권리자 처리·광고 동의 UI가 기획과 연결되지 않음 |
| C4-7 | Medium | 모순 | High | 홈 최신 피드와 2개 게시판 메뉴의 기본 선택·URL·필터가 불명확함 |
| C4-8 | Medium | 모순 | High | 페이지당 20개 계약과 `size=12` API 예시가 충돌함 |
| A4-1 | Medium | 모호함 | High | 상세 하단 목록이 최신 목록인지 현재 글 주변 목록인지 확정되지 않음 |
| C4-9 | Medium | 모순 | High | 사용자 상세 와이어프레임에 내부 권리 상태가 노출됨 |
| D4-1 | Medium | 설계 | High | 출처 후보의 허용 필드·보관기간·출처별 승인 기준이 없음 |
| D4-2 | Medium | 설계 | High | 퍼블의 상태 화면·키보드·터치·공유 상호작용 검증 범위가 부족함 |
| C4-10 | Medium | 모순 | High | 과거 세션 기록과 archive가 현행 브랜드·광고·수집 결정과 충돌함 |
| A4-2 | Medium | 모호함 | Medium | M1 계정 생명주기와 M1.5 전역 수용량이 주 4시간 상한에 맞게 닫히지 않음 |

### 5.3 상세 근거와 강제 수정안

#### E4-1 — 파괴적인 Docker 초기화 문서

- 위치: `docs/docker.md:1`
- 문제: `docker-compose down -v`와 `rm -rf data/mysql/*`가 한 줄로 이어져 있고 개발 전용 여부, 대상 경로 검증, 백업 확인이 없다.
- 영향: 복사 실행 시 MySQL 볼륨과 로컬 데이터가 복구하기 어렵게 삭제될 수 있다.
- 수정안: 해당 파일을 개발 전용 초기화 절차로 다시 작성하고 운영 실행 금지, 명시적 대상 경로, 백업·복구 확인, 단계별 확인 명령을 반드시 추가한다.

#### C4-1 — 이전·다음 탐색 계약 충돌

- 위치: `docs/planning/03-screen-design.md:236`, `docs/planning/03-screen-design.md:499`, `docs/planning/04-analytics-ad-plan.md:225`, `docs/planning/05-benchmark-spec.md:87`, `docs/planning/05-benchmark-spec.md:188`, `docs/planning/05-benchmark-spec.md:199`
- 문제: 상세 하단 목록만 사용한다고 정했지만 `AdjacentPostNav`, `AdjacentNav`, `/adjacent`, 이전·다음 흐름이 남아 있다.
- 영향: 같은 목적의 UI와 API가 중복 구현되고 연속 소비 지표도 갈린다.
- 수정안: 이전·다음 기능과 API를 현행 스펙에서 모두 제거하고 상세 하단 20개 목록을 단일 탐색 계약으로 확정한다.

#### C4-2 — 상세 광고 위치 충돌

- 위치: `docs/planning/03-screen-design.md:375`, `docs/planning/03-screen-design.md:380`, `docs/planning/04-analytics-ad-plan.md:227`, `docs/planning/05-benchmark-spec.md:89`, `docs/planning/01-service-plan.md:590`, `docs/planning/01-service-plan.md:797`, `docs/planning/02-infra-plan.md:577`
- 문제: 정본 화면은 상단 광고를 금지하지만 서비스·인프라·벤치마크 문서는 상단 배너를 포함한다.
- 영향: 슬롯 ID, feature flag, 레이아웃 예약 공간과 광고 심사 범위가 달라진다.
- 수정안: 상세 광고 정본을 `AD-POST-BODY-BOTTOM`, `AD-DETAIL-LIST-INLINE`, `AD-DETAIL-LIST-AFTER`로 고정하고 상단 광고 문구를 현행 문서에서 제거한다.

#### C4-3 — 자동 후보수집 단계 충돌

- 위치: `docs/planning/01-service-plan.md:201`, `docs/planning/01-service-plan.md:436`, `docs/planning/01-service-plan.md:444`, `docs/planning/02-infra-plan.md:313`, `docs/planning/05-benchmark-spec.md:121`, `docs/session-log/2026-08-08-service-planning.md:16`
- 문제: M1에서 자동 크롤링을 제외하면서 M1 후보 기능으로 adapter·worker·자동 주기를 설계했다.
- 영향: M1 범위와 운영비가 구현자 판단에 따라 달라진다.
- 수정안: 자동 후보수집의 정확한 단계 하나를 결정한다. 현재 M1 커뮤니티 검증을 보존하려면 수동 URL 등록만 M0~M1.5에 두고 자동 목록·상세 파싱은 M2 운영 최적화로 분리한다.

#### E4-2 — 수집 승인 이후 발행 계약 단절

- 위치: `docs/planning/05-benchmark-spec.md:139`, `docs/planning/05-benchmark-spec.md:208`, `docs/planning/01-service-plan.md:456`, `docs/planning/01-service-plan.md:689`
- 문제: 파이프라인은 `초안 생성 → 최종 발행`을 요구하지만 후보와 초안 연결키, 최종 발행 API, 중복 승인 멱등성이 없다.
- 영향: 승인 즉시 공개, 중복 초안, 후보 추적 단절이 발생할 수 있다.
- 수정안: 후보에 unique `draft_post_no`를 두고 승인 API는 `DRAFT`만 생성하게 한다. 별도 최종 발행 API와 예약 시각, 허용 상태 전이, 중복 요청 결과를 확정한다.

#### C4-4 — 상태 모델 불일치

- 위치: `docs/planning/01-service-plan.md:471`, `docs/planning/01-service-plan.md:625`, `docs/planning/01-service-plan.md:629`, `docs/planning/05-benchmark-spec.md:158`, `docs/planning/05-benchmark-spec.md:230`, `docs/planning/05-benchmark-spec.md:233`
- 문제: 후보 상태는 `PENDING` 계열과 `DISCOVERED/FETCHED/NORMALIZED` 계열로 갈리고, `candidate_status`와 `fetch_status`도 값을 중복 소유한다. 게시글은 `visible_yn`만 있어 초안·예약·공개·숨김을 구별하지 못하며 `rights_status` 값도 없다.
- 영향: DB 제약, 재시도, 검수, 권리 미확인 게시글의 발행 차단을 강제할 수 없다.
- 수정안: 수집 상태와 검수 상태를 분리한 단일 상태 전이표를 만들고 `post_status`, `rights_status`, 허용 전이 및 발행 guard를 모든 문서에 동일하게 적용한다.

#### C4-5 — 내부 이벤트·동의·재방문 지표 충돌

- 위치: `docs/planning/04-analytics-ad-plan.md:119`, `docs/planning/04-analytics-ad-plan.md:133`, `docs/planning/04-analytics-ad-plan.md:202`, `docs/legal/privacy-policy.md:20`, `docs/legal/privacy-policy.md:30`, `docs/legal/cookie-settings.md:23`
- 문제: `anonymous_id`, `session_id` 내부 이벤트는 동의 전에 동작하지만 정책 문서는 행동 이벤트를 동의 후 수집한다고 적었다. 익명 ID의 저장 위치·회전·삭제와 세션 경계도 없다.
- 영향: 분석 거부 상태의 실제 수집 범위가 불명확하고 핵심 지표인 7일 재방문율을 재현할 수 없다.
- 수정안: 필수 운영 통계와 선택 GA4 이벤트를 분리하고, 익명 ID·세션의 생성, 저장소, 만료, 회전, 철회 시 삭제, 보관기간을 기획·정책·스키마에 동일하게 명시한다.

#### E4-3 — 상세 공유·OG 검증 불가

- 위치: `docs/publishing/responsive/index.html:6`, `docs/publishing/responsive/index.html:85`, `docs/publishing/responsive/app.js:66`, `docs/planning/01-service-plan.md:360`
- 문제: 퍼블은 홈과 상세를 hash로 전환하고 고정된 홈 canonical·OG만 제공한다. 공유 버튼 동작도 연결되지 않았다.
- 영향: `/posts/:postNo` 공유 시 게시글별 제목·설명·이미지를 SNS crawler에 제공하는 계약을 검증할 수 없다.
- 수정안: 게시글 상세를 독립 route의 서버 응답 HTML로 검증하고 게시글별 title, canonical, `og:type=article`, OG/Twitter image·alt를 생성한다. 공유 버튼의 기본 공유·링크 복사·카카오톡·X 흐름도 퍼블에서 검증한다.

#### C4-6 — 정책·권리자·광고 동의 화면 미연결

- 위치: `docs/planning/03-screen-design.md:71`, `docs/legal/cookie-settings.md:54`, `docs/legal/rights-request.md:4`, `docs/legal/privacy-policy.md:104`, `docs/wireframes/legal/index.html:284`, `docs/publishing/responsive/index.html:172`
- 문제: 정책 4개는 M0 route인데 퍼블 푸터는 `#`이며, 쿠키 와이어프레임에는 광고 허용·모두 허용이 없다. 시행일·접수 이메일·책임자도 placeholder다.
- 영향: 직접 URL, 장문 정책, 광고 동의 철회, 권리자 요청 접수를 출시 전에 검증할 수 없다.
- 수정안: `/terms`, `/privacy`, `/rights`, `/cookie-settings`를 실제 본문으로 연결하고 분석·광고 독립 토글, 필수만·모두 허용·선택 저장을 제공한다. 정책 담당자와 접수 정보를 출시 차단 체크로 둔다.

#### C4-7 — 홈과 게시판 IA 불명확

- 위치: `docs/planning/01-service-plan.md:123`, `docs/planning/03-screen-design.md:90`, `docs/planning/03-screen-design.md:111`, `docs/planning/05-benchmark-spec.md:38`, `docs/wireframes/responsive/index.html:449`, `docs/wireframes/responsive/index.html:456`
- 문제: 홈을 최신 메뉴 하나로 설명하면서 별도 문서와 화면은 유머·이야기 2개 메뉴를 필수로 둔다. 와이어프레임은 유머가 활성화된 상태에서 이야기 글을 섞어 표시한다.
- 영향: `/` 기본 목록, 활성 메뉴, 게시판 route, API 필터, canonical을 구현자가 임의로 정하게 된다.
- 수정안: 게시판은 `HUMOR`, `TALK` 2개만 유지하면서 `/`의 혼합 최신 목록 여부와 각 게시판 route·필터·활성 상태를 하나의 IA 표로 확정한다.

#### C4-8 — 목록 개수 충돌

- 위치: `docs/planning/03-screen-design.md:141`, `docs/planning/03-screen-design.md:176`, `docs/planning/05-benchmark-spec.md:71`, `docs/publishing/responsive/README.md:17`
- 문제: 페이지당 게시글은 20개인데 API 예시는 `size=12`다.
- 영향: 페이지 수, 광고 삽입 위치와 테스트 기대값이 달라진다.
- 수정안: 공개 목록과 상세 하단 목록을 모두 게시글 `20개`로 통일하고 광고 행은 20개 산정에서 제외한다고 명시한다. API 예시는 `size=20`으로 고친다.

#### A4-1 — 상세 하단 목록 선정 기준 모호

- 위치: `docs/planning/01-service-plan.md:292`, `docs/planning/03-screen-design.md:230`, `docs/planning/03-screen-design.md:257`, `docs/planning/05-benchmark-spec.md:88`
- 문제: 하단 목록을 최신 목록 또는 현재 글 주변 목록 중 하나로 남겼다.
- 영향: API 응답, 현재 글 강조, 페이지네이션, 다음 소비 순서가 달라진다.
- 수정안: 선정 기준 하나를 확정하고 현재 글 포함 여부, 정렬, 20개 경계, 첫·마지막 글 동작을 응답 계약에 명시한다.

#### C4-9 — 내부 권리 상태 공개

- 위치: `docs/planning/03-screen-design.md:225`, `docs/wireframes/responsive/index.html:490`
- 문제: 권리 상태는 사용자에게 표시하지 않는다고 했지만 정본 와이어프레임은 `권리 상태: 운영자 확인 완료`를 노출한다.
- 영향: 내부 판단이 공개 보증처럼 보이고 공개 DTO에 내부 필드가 섞일 수 있다.
- 수정안: 상세에는 출처명·원문 링크·일반 권리자 요청 안내만 두고 `rights_status`, `rights_note`, 내부 확인 문구를 공개 DTO와 화면에서 제거한다.

#### D4-1 — 후보수집 통제 기준 누락

- 위치: `docs/planning/01-service-plan.md:460`, `docs/planning/01-service-plan.md:464`, `docs/planning/05-benchmark-spec.md:149`, `docs/legal/privacy-policy.md:23`
- 문제: 출처별 이용조건 확인일, 허용 필드, 후보 보관·파기 기간, 담당자가 없다.
- 영향: 작성자명과 이미지 후보가 필요 이상으로 저장되고 권리 검수 전 데이터가 장기 잔존할 수 있다.
- 수정안: 출처별 승인표와 최소수집 필드, 후보 보관기간, 자동 파기, 차단·탈퇴 출처 처리 규칙을 반드시 정의한다.

#### D4-2 — 퍼블 상태·접근성·상호작용 누락

- 위치: `docs/planning/03-screen-design.md:259`, `docs/planning/03-screen-design.md:448`, `docs/publishing/responsive/index.html:148`, `docs/publishing/responsive/app.js:97`, `docs/wireframes/legal/index.html:237`
- 문제: 퍼블에는 일반 오류 하나만 있고 로딩·빈 목록·숨김 상태가 없다. 게시글 행은 실제 링크가 아니며 Enter만 처리하고 정책 tab의 키보드 패턴도 없다.
- 영향: 상태 복구, 직접 URL, 키보드 탐색과 모바일 터치 크기를 실제 화면에서 확인할 수 없다.
- 수정안: 모든 M0 상태를 퍼블에 추가하고 게시글 행을 실제 링크로 바꾼다. 터치 44px, tab 역할·방향키·포커스 복귀, 공유 메뉴 Escape 동작을 완료 조건에 넣는다.

#### C4-10 — 과거 기록과 현행 정본 혼재

- 위치: `docs/session-log/2026-08-08-service-planning.md:11`, `docs/session-log/2026-08-08-service-planning.md:16`, `docs/session-log/2026-08-08-service-planning.md:31`, `docs/session-log/2026-08-08-service-planning.md:44`, `docs/session-log/README.md:3`, `docs/wireframes/archive/mobile/index.html:408`, `docs/wireframes/archive/mobile/index.html:433`
- 문제: 과거 기록에 `피식톡`, 자동 크롤링 제외, M0 화면 2개, 상세 상단 광고, 12개 목록이 남아 있고 세션 기록 README에는 현행 정본 우선순위와 폐기 표시 규칙이 없다.
- 영향: 새 작업자가 과거 결정을 현행 요구로 해석할 수 있다.
- 수정안: 과거 기록 상단에 `대체됨` 표시와 현행 정본 링크를 추가하고 archive는 비교용임을 파일 내부에도 명시한다. 세션 기록 README에 최신 결정 우선 원칙을 넣는다.

#### A4-2 — M1 이후 운영 범위 미완성

- 위치: `docs/planning/01-service-plan.md:178`, `docs/planning/01-service-plan.md:221`, `docs/planning/01-service-plan.md:229`, `docs/planning/01-service-plan.md:537`, `docs/legal/privacy-policy.md:25`
- 문제: M1 계정에는 비밀번호 재설정·탈퇴·회원 데이터 보관이 없고 M1.5 제보는 사용자당 제한만 있어 전체 검수 수용량이 없다.
- 영향: 계정 복구·삭제 요청과 주 4시간 운영 상한을 일관되게 처리하기 어렵다.
- 수정안: M1 계정 생명주기와 데이터 보관·파기 계약을 추가하고, M1.5에는 주간 전체 접수 상한과 대기 건수·최장 대기시간 기반 자동 접수 중단선을 둔다.

### 5.4 적용 우선순위

1. 즉시 격리: `docs/docker.md`의 파괴적 명령과 과거 기록의 현행 오인 위험
2. 기획 정본 확정: 홈 IA, 20개 목록, 하단 목록, 이전·다음 제거, 상세 광고 3개 위치
3. 도메인 정본 확정: 게시글·권리·후보 상태, 수집 승인, 초안, 최종 발행
4. 분석·정책 확정: 내부 이벤트, 익명 ID, 동의, 쿠키, 권리자 요청, 제휴 고지
5. 퍼블 보강: 실제 route, 게시글별 OG, 공유 동작, 정책 본문, 상태·접근성
6. 이후 범위 정리: 자동수집 단계, M1 계정 생명주기, M1.5 전역 수용량

### 5.5 교차검증 메모

- 4개 트랙 중 2개 이상에서 반복된 항목: 이전·다음, 20개/12개, 자동수집 단계, 후보 상태·발행, 내부 이벤트 동의, 상세 상단 광고, 권리 상태 노출
- 직접 파일로 재확인한 단독 항목: `docs/docker.md`, 정책 route 미연결, 접근성, 과거 세션 기록
- archive 파일의 과거 UI 자체는 결함으로 판정하지 않았다. 현행 정본으로 오인될 수 있는 표시·문서 규칙 부재만 지적했다.
- 법률 확정 판단은 하지 않았다. 실제 사업자·도메인·수탁자·국외이전·제휴 사업자가 확정될 때 정책 문서를 다시 대조해야 한다.
