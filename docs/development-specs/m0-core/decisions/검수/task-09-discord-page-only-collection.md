# Task 09 — Discord 입력과 페이지 단위 수집 정본 동기화

## 요청

- Discord로 지정한 URL을 확인해 수집을 실행한다.
- M0 수집 보조는 페이지 단위, 즉 단일 상세 페이지 1건만 수집한다.
- 목록·feed·pagination·scheduler 기반 자동 수집은 M0 수집 보조 범위에서 제외한다.

## 반영 결정

| 항목 | 결정 |
| --- | --- |
| URL 입력 | Discord `/collect url:<원문URL>` 또는 관리자 화면 URL 입력 |
| Discord 방식 | Interactions endpoint로 slash command를 받고, incoming webhook은 결과 알림용으로만 사용 |
| 수집 단위 | 입력된 단일 상세 페이지 1건 |
| 목록 수집 | M0 수집 보조에서는 사용하지 않음 |
| 이미지 처리 | Python extractor 작업 경로에 임시 저장 후, 게시 결정 시 관리자 업로드와 같은 검증을 거쳐 영구 저장 |
| 자동 수집 | 후속 `M0 자동 수집` 단계에서 별도 결정·설계 |

## 정정 범위

- `docs/planning/01-service-plan.md`
- `docs/planning/02-infra-plan.md`
- `docs/planning/03-screen-design.md`
- `docs/planning/04-analytics-ad-plan.md`
- `docs/planning/05-benchmark-spec.md`
- `docs/planning/content-collection/README.md`
- `docs/planning/content-collection/source-spec-template.md`
- `docs/planning/content-collection/sources/*.md`
- `docs/system-design/README.md`
- `docs/system-design/01-system-architecture.md`
- `docs/system-design/02-data-model.md`
- `docs/system-design/03-api-design.md`
- `docs/system-design/04-infrastructure-design.md`
- `docs/system-design/05-security-operations.md`
- `docs/development-specs/m0-collection-assist/collection-assist/**/*.md`

## 검수 기준

- M0 수집 보조 현재 범위에 목록·feed·pagination·scheduler 실행 경로가 남아 있지 않아야 한다.
- `collect:crawl-due`, `LIST_CRAWL`, 출처 자동 비활성은 후속 `M0 자동 수집`으로만 설명되어야 한다.
- source spec 21개와 template의 목록 fixture는 `해당 없음` 또는 `사용하지 않음`으로 정리되어야 한다.
- 구현·테스트·runtime 완료 주장을 추가하지 않는다.

## 결과

- 문서 정정 완료.
- 실제 source·OpenAPI·runtime·브라우저 검증은 수행하지 않음.
- 최종 검수 결과는 작업 보고에서 별도 기록한다.
