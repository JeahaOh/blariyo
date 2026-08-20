# Blariyo

`블라리요`는 운영자가 선별한 유머 콘텐츠를 데스크톱·모바일 웹에서 연속해서 보는 서비스다.

- 내부 코드명: `blariyo`
- 공개 서비스명: `블라리요`
- 현재 단계: M0 기획·시스템 설계 재정비
- 현재 상태: 애플리케이션 source를 제거하고 문서와 정적 화면 프로토타입만 유지

## 문서 정본

같은 내용을 README에 다시 정의하지 않고 아래 문서를 정본으로 사용한다.

| 질문 | 정본 |
| --- | --- |
| 무엇을 어느 단계에 만드는가 | [서비스 기획서](docs/planning/01-service-plan.md) |
| 화면에서 어떻게 동작하는가 | [화면 설계서](docs/planning/03-screen-design.md) |
| 분석·광고를 언제 어떻게 적용하는가 | [분석·광고 계획](docs/planning/04-analytics-ad-plan.md) |
| 어떤 기술 경계로 구현하는가 | [M0 시스템 설계](docs/system-design/README.md) |
| PostgreSQL schema 계약은 무엇인가 | [M0 데이터 모델](docs/system-design/02-data-model.md) |
| HTTP 계약은 무엇인가 | [M0 API 설계](docs/system-design/03-api-design.md) |
| 어떻게 배포·백업·복구하는가 | [인프라 설계](docs/system-design/04-infrastructure-design.md), [보안·운영 설계](docs/system-design/05-security-operations.md) |
| AI가 어떤 순서와 근거로 작업하는가 | [AI 작업 안내](docs/ai/README.md) |

제품 범위는 planning, 구현 세부는 system-design, 실제 완료 여부는 migration·OpenAPI·source·test를 기준으로 판단한다.

현재 구현 목표는 M0다. 단계별 제품 범위와 기술 선택은 위 정본 문서에서만 변경한다.

## 저장소 구조

```text
blariyo/
  AGENTS.md                 AI agent rules and canonical boundaries
  CLAUDE.md                 Claude entry pointer
  GEMINI.md                 Gemini entry pointer
  docs/
    ai/                     canonical map and evidence contract
      skills/               project-local AI workflows
    planning/               product and stage decisions
    system-design/          M0 implementation contracts
    legal/                  release-blocking policy drafts
    publishing/             responsive publishing prototype
    wireframes/             screen references
  worklog/
    task-list/              task scopes and verification artifacts
    session-log/            decision and review history
```

애플리케이션 source, production infrastructure와 실행 가능한 M0 OpenAPI/routes는 현재 저장소에 없다.

## 다음 실행 산출물

1. M0 OpenAPI `3.1.x` source와 example validation
2. 공개 board·list·detail Core API
3. Nuxt BFF의 nested 공개 route
4. 관리자 image·draft·publish·hide route
5. 수집 출처·후보 Core API와 `SourceFetcher` adapter
6. Nuxt 목록·상세, 정책 화면과 관리자 후보 검수 화면
7. backup restore drill과 배포 smoke test

data-model과 api-design의 미구현 gate는 각 문서 마지막 checklist에서 관리한다.

## 주요 결정 기록

- [작업 기록 안내](worklog/README.md)
- [세션 기록 규칙](worklog/session-log/README.md)
- [PostgreSQL 전환 결정](worklog/session-log/2026-08-14-postgresql-transition.md)
- [planning·system-design 경계 재검토](worklog/session-log/2026-08-14-planning-system-design-boundary-review.md)
- [게시판·권리 정책 정정](worklog/session-log/2026-08-12-board-policy-correction.md)
