# Blariyo 확정 카피 계약

- 문서 상태: OD-M0-013 확정
- 기준일: 2026-09-03
- 정합성 검토일: 2026-09-03
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

## 3. Properties/config 계약

| key | 값 | 사용 위치 |
| --- | --- | --- |
| `NUXT_PUBLIC_SITE_NAME` | `블라리요` | 홈 메인, `og:title`, site name |
| `NUXT_PUBLIC_HOME_TAGLINE` | `블라블라블라` | 홈 보조 문구 |
| `NUXT_PUBLIC_HOME_TITLE` | `블라리요 - 블라블라블라` | 홈 `<title>` |
| `NUXT_PUBLIC_HOME_DESCRIPTION` | `블라리요에서 블라블라블라` | 홈 `description` |
| `NUXT_PUBLIC_HOME_OG_DESCRIPTION` | `블라리요에서 블라블라블라` | 홈 `og:description`, 상세 TEXT 없음 fallback |
| `NUXT_PUBLIC_FOOTER_TAGLINE` | `블라블라블라` | 푸터 브랜드 한 줄 |

위 값은 source에 흩어 넣지 않고 public runtime config로 주입한다. production은 빈 문자열을
허용하지 않으며 누락 시 build 또는 startup 단계에서 실패하도록 검증한다.

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
