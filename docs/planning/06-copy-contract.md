# Blariyo 확정 카피 계약

- 문서 상태: OD-M0-013 확정
- 기준일: 2026-09-03
- 정합성 검토일: 2026-09-24 (Nuxt 설정·metadata·푸터 소스 대조)
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [05-benchmark-spec.md](./05-benchmark-spec.md)
- 서비스 명칭: `블라리요`

## 1. 목적

서비스명, 홈, OG와 푸터의 M0 Core 카피 및 배포 환경 properties/config key를 관리한다.

## 2. 확정 카피

| 적용 위치 | 확정값 |
| --- | --- |
| 메인 | `블라리요` |
| 홈 보조 문구 | `블라블라블라` |
| 홈 `<title>` | `블라리요 - 블라블라블라` |
| 홈 `description` | `블라리요에서 블라블라블라` |
| 홈 `og:title` | `블라리요` |
| 홈 `og:description` | `블라리요에서 블라블라블라` |
| 푸터 브랜드 한 줄 | `블라블라블라` |
| 푸터 일반 문의 | `문의·오류 제보` |
| 푸터 저작권 표시 | `© 2026 Blariyo. All rights reserved.` |

## 3. Properties/config 계약

| key | 값 | 사용 위치 |
| --- | --- | --- |
| `NUXT_PUBLIC_SITE_NAME` | `블라리요` | 홈 메인, `og:title`, site name |
| `NUXT_PUBLIC_HOME_TAGLINE` | `블라블라블라` | 홈 보조 문구 |
| `NUXT_PUBLIC_HOME_TITLE` | `블라리요 - 블라블라블라` | 홈 `<title>` |
| `NUXT_PUBLIC_HOME_DESCRIPTION` | `블라리요에서 블라블라블라` | 홈 `description` |
| `NUXT_PUBLIC_HOME_OG_DESCRIPTION` | `블라리요에서 블라블라블라` | 홈 `og:description`, 상세 TEXT 없음 fallback |
| `NUXT_PUBLIC_FOOTER_TAGLINE` | `블라블라블라` | 푸터 브랜드 한 줄 |

위 값은 public runtime config에서 관리한다. `apps/web/nuxt.config.ts`에 확정 기본값이 있으며
배포 환경변수로 덮어쓸 수 있다. production startup 검증은 기본값을 적용한 최종 config의 빈 값·
미정 placeholder를 거부한다. 환경변수를 생략해 확정 기본값을 사용하는 것 자체는 실패 조건이 아니다.

## 4. 상세 metadata 적용

게시글 상세의 title과 description은 게시글별 값을 우선한다. 첫 공개 TEXT block이 없을 때만
`NUXT_PUBLIC_HOME_OG_DESCRIPTION`을 기본 description으로 사용한다. IMAGE fallback과 본문 기반
description 생성 규칙은 [화면 설계 §7](./03-screen-design.md)을 따른다.

## 5. 결정 기준

- 서비스명을 먼저 보여주고 설명은 짧게 붙인다.
- 검증되지 않은 과장, 유행어와 과한 행동 유도를 피한다.
- 검색·공유 미리보기에서 잘려도 브랜드명이 남게 한다.
- 출퇴근·통학 맥락은 운영 전략에 남기되 대표 카피에는 과하게 넣지 않는다.

결정 상태는 [M0 Core 결정 색인](../development-specs/m0-core/decisions/open-decisions.md)의
OD-M0-013에서 추적한다. 광고 차단 안내 문구는 OD-M0-013 범위가 아니므로 별도 광고 정책·화면
계약에서 관리한다.

## 6. 푸터 보완 (2026-09-20)

브랜드 문구는 로고 아래에 배치한다. 정책·문의 링크 아래 저작권 표시를 두고, 사용자가 제외한 게시물 권리 귀속 문장은 추가하지 않는다. 연도는 서비스 시작 연도 2026으로 고정하며 방문 시점에 자동 변경하지 않는다.
