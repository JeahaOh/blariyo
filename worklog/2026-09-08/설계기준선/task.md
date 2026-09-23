# M0·M1·M1.5 설계 기준선 manifest 작성

- 날짜: 2026-09-08
- 상태: 완료
- 요청: 공유 정본을 복제하지 않고 단계별 범위 manifest와 annotated design tag 계획을 작성한다.
- 전체 범위: baseline 문서 작성·독립 검수, docs 기준선 commit, main fast-forward, annotated design tag
  4개 생성·readback, 후속 실행 기록 commit.
- 문서 담당 범위: `docs/baselines/`, 이 task 기록, 필요한 AI·현행 readiness 색인만 최소 동기화한다.
- 제외: 제품·법무·기술 결정 변경, 애플리케이션 구현, push·배포.

## 담당

| 담당 | 역할 |
| --- | --- |
| root | 전체 범위·정본·최종 diff 검수와 작업 종료 판정 |
| policy_review | task와 단계별 baseline manifest, AI·readiness 색인 작성 |
| collector_review | 승인된 commit·main fast-forward·annotated tag 생성과 실제 readback 기록 |
| structure_review | manifest 범위·의존성·링크·표·상태 표현 독립 검수 |

## 산출물

| 단계 | Manifest | 생성된 annotated tag | 선행 기준선 |
| --- | --- | --- | --- |
| M0 Core | [m0-core.md](../design-baselines/m0-core.md) | `design/m0-core/v1` | 없음 |
| M0 수집 보조 | [m0-collection-assist.md](../design-baselines/m0-collection-assist.md) | `design/m0-collection-assist/v1` | `design/m0-core/v1` |
| M1 회원 | [m1.md](../design-baselines/m1.md) | `design/m1/v1` | `design/m0-core/v1`; collector 불필요 |
| M1.5 익게 | [m1-5.md](../design-baselines/m1-5.md) | `design/m1-5/v1` | `design/m0-core/v1`, `design/m1/v1`; collector 불필요 |

## 완료 조건

1. 각 manifest가 포함 파일·절, 선행 기준선, 제외 범위, 법무·운영·구현 미검증을 명시한다.
2. M0 자동 수집·광고·제휴·뉴스 등 후속 기능을 현재 네 기준선에 임의 포함하지 않는다.
3. 같은 commit에 네 design tag를 붙일 수 있음을 기록하되 manifest 범위로 의미를 구분한다.
4. design tag와 애플리케이션 release tag를 분리하고 release metadata에서 적용 design tag를 연결한다.
5. 문서 구조·상대 링크·표와 변경 범위를 검증한다.

## Git 실행 상태

기준선 문서 64개를 commit `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854`로 고정하고, local `main`을
`3f9008fcebb5193957bb4868cfcb4ac4891b1954`에서 해당 commit으로 fast-forward했다. 네 annotated design
tag는 모두 이 기준선 commit을 가리킨다. object type·peeled commit·annotation·manifest 원문을 주
검수에서 readback했고 [독립 문서 검수](review.md)도 통과했다. 상세 실행 증거는
[Git 실행 결과](git-result.md)에 기록했다.

`planning-design-only`도 기준선 commit을 가리키며 `feature/m0-core`의 기존
`2bb8396092d1d84bfc2fe939f3a51e1bf1ea6cea`는 보존했다. 실행 기록용 후속 commit은 이 두 기록 파일만
담으며, 그 결과 local main은 design tag보다 한 commit 앞서게 된다. push는 수행하지 않았다.
