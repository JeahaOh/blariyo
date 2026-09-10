# M0 Core 구현 Backlog

- 문서 상태: 신규 M0 Core 개발 순서
- milestone: `M0 Core` (`m0-core`)
- 기준일: 2026-09-03
- 입력 근거: [서비스 기획](../../planning/01-service-plan.md), [시스템 설계](../../system-design/README.md), [API 설계](../../system-design/03-api-design.md), [M0 Core 결정 색인](./decisions/open-decisions.md)
- 구현 증거: [현재 소스의 검증 기록](../../../README.md#검증). 운영 외부 서비스·법무 실값·deployment는 별도 미검증.

이 문서는 이미 작성된 M0 Core 개발 Spec을 구현 순서로 묶는 실행 준비 backlog다. 제품 범위나 API
계약을 새로 확정하지 않고 각 기능 Spec과 system-design의 계약을 따라 구현 단위를 정렬한다.

## 1. 구현 전제

- [새 개발 전제](../../system-design/README.md#현재-준비-상태)에 따라 빈 애플리케이션 구조에서 시작한다. 기존 프로토타입 동기화·수정 작업을 선행 조건으로 두지 않는다.
- 구현 완료는 이 문서가 아니라 실제 source, migration, test, build, runtime 증거로 판정한다.
- `M0 Core`는 수집 보조·자동 수집 없이 공개 가능해야 한다.
- `policy-and-rights`의 법무·문의 실값 `차단`은 production 공개 조건이다. 조회·시행 command·UI 개발은 테스트 fixture로 진행한다.
- Kakao, GA4, 광고는 구현 경계와 운영 활성화 gate를 분리한다.

## 2. Backlog 순서

| 순서 | 작업 | 주요 산출물 | 선행 조건 | 완료 증거 |
| --- | --- | --- | --- | --- |
| 1 | repository scaffold | Nuxt Web/BFF, Nest Core, PostgreSQL compose skeleton | Node.js 24.18.0 기준 확정 | `npm ci`, 기본 build/test |
| 2 | 공통 API 계약 | request id, envelope, error mapper, validation, cache header | [API 설계 §1~§7](../../system-design/03-api-design.md) | 공통 unit/contract test |
| 3 | DB migration | `content`, `legal`, `ops` schema와 초기 `meme` board seed | [데이터 모델](../../system-design/02-data-model.md) | migration up/down, schema smoke test |
| 4 | 공개 게시판/목록 | boards, `/meme` list, page 404, pinned/general 분리 | [public-post-browsing](./public-post-browsing/public-post-browsing.dev.md) | API contract, SSR list test |
| 5 | 게시글 상세/조회 수 | detail, context list, SSR metadata, view count endpoint | 공개 목록 구현 | API·SSR·view count test |
| 6 | 정책 조회 | policy current/history 조회, route/modal viewer | 법무 artifact placeholder 유지 | policy API/D08 test |
| 7 | 관리자 인증 경계 | BFF external identity adapter, Core service token/actor | Cloudflare Access 또는 fake adapter | auth contract test |
| 8 | 관리자 이미지/초안 | upload all-or-nothing, preview, discard, draft create/update | R2 adapter fake/real 경계 | image/storage rollback test |
| 9 | 발행/예약/숨김 | publish, schedule, unschedule, hide, republish, remove, outbox | 게시글 편집 구현 | 상태 전이·outbox test |
| 10 | 정책 시행 command | sanitized policy artifact publish, version switch, cache purge | 로컬 fixture로 구현, 실제 시행은 법무 실값·artifact 승인 후 | command/integration test |
| 11 | analytics consent | 기본 비활성, 동의 UI, GA4 loader gate | [analytics-consent](./analytics-consent/analytics-consent.dev.md) | browser network test |
| 12 | 운영 smoke | health, backup, restore, scheduler, browser QA | production-like preview compose | smoke checklist |

## 3. 구현 단위별 Spec 연결

| 기능 | 개발 보강서 | API | D01 | D08 |
| --- | --- | --- | --- | --- |
| 공개 탐색 | [public-post-browsing](./public-post-browsing/public-post-browsing.dev.md) | `list-boards`, `list-posts`, `get-post`, `increment-post-view` | `browse-posts`, `view-post`, `share-post` | `meme-list`, `post-detail` |
| 관리자 게시글 | [admin-post-management](./admin-post-management/admin-post-management.dev.md) | 검색, 편집, 이미지, 발행, 숨김, 삭제 | 초안·발행, 예약, 권리 처리 | `admin-post-editor` |
| 정책·권리 | [policy-and-rights](./policy-and-rights/policy-and-rights.dev.md) | `get-policy` | 정책 열람, 정책 시행, 권리 문의 | policy viewer, policy command, rights entry |
| 분석 동의 | [analytics-consent](./analytics-consent/analytics-consent.dev.md) | API 해당 없음 | 동의 저장·철회, event 전송 | banner, settings, loader |

## 4. OpenAPI 작성 범위

문서 입력 계약은 [openapi/m0-core.yaml](./openapi/m0-core.yaml), 배치 기준은 [openapi-draft.md](./openapi-draft.md)를 따른다. 새 구현의 공유 계약은 `packages/contracts/openapi/m0-core.yaml`에 두고 docs 원본과 같게 시작한다. 생성 타입은 이 파일에서 새로 만든다.

초기 OpenAPI에는 다음만 포함한다.

- public GET/POST: boards, posts list, post detail, post view count
- legal GET: policy current/history
- admin POST/GET/PATCH/DELETE: 게시글 관리와 이미지 staging
- 공통 envelope, error schema, pagination, idempotency header, auth header

다음은 M0 Core OpenAPI에 넣지 않는다.

- `M0 수집 보조`, `M0 자동 수집`
- social login, user content, ad runtime, affiliate
- GA4 tag 호출

## 5. 차단·미검증

- 출시 차단: OD-M0-006 법무·문의 실값, 시행일, 실제 수탁자, 접속·보안 로그 법무 근거
- 활성화 차단: OD-M0-009 Kakao 운영값, OD-M0-011 GA4 운영값
- 로컬 검증: source·migration·OpenAPI·test·build·browser·Docker·DB 복구는 [README](../../../README.md#검증)의 실행 결과를 따른다.
- 미검증: production 외부 서비스 연결, 운영 cron·알림·암호화 원격 백업·전체 서버 복구, deployment
- 보류: 수집 보조·자동 수집, 회원, 광고, 제휴는 별도 milestone에서 진행
