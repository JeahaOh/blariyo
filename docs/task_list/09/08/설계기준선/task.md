# M0·M1·M1.5 설계 기준선 manifest 작성

- 날짜: 2026-09-08
- 상태: 진행
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

| 단계 | Manifest | 생성 예정 annotated tag | 선행 기준선 |
| --- | --- | --- | --- |
| M0 Core | [m0-core.md](../../../../baselines/m0-core.md) | `design/m0-core/v1` | 없음 |
| M0 수집 보조 | [m0-collection-assist.md](../../../../baselines/m0-collection-assist.md) | `design/m0-collection-assist/v1` | `design/m0-core/v1` |
| M1 회원 | [m1.md](../../../../baselines/m1.md) | `design/m1/v1` | `design/m0-core/v1`; collector 불필요 |
| M1.5 익게 | [m1-5.md](../../../../baselines/m1-5.md) | `design/m1-5/v1` | `design/m0-core/v1`, `design/m1/v1`; collector 불필요 |

## 완료 조건

1. 각 manifest가 포함 파일·절, 선행 기준선, 제외 범위, 법무·운영·구현 미검증을 명시한다.
2. M0 자동 수집·광고·제휴·뉴스 등 후속 기능을 현재 네 기준선에 임의 포함하지 않는다.
3. 같은 commit에 네 design tag를 붙일 수 있음을 기록하되 manifest 범위로 의미를 구분한다.
4. design tag와 애플리케이션 release tag를 분리하고 release metadata에서 적용 design tag를 연결한다.
5. 문서 구조·상대 링크·표와 변경 범위를 검증한다.

## Git 실행 상태

Manifest 작성 단계다. `design/*/v1` annotated tag, 기준선 commit, main fast-forward는 아직
실행하지 않는다. 첫 docs commit과 main 반영 후 네 tag를 생성하고, 실제 tag readback은 후속 실행 기록에
남긴다. 그 기록 commit 때문에 main이 design tag보다 한 commit 앞설 수 있으나 정본 내용은 같게 유지한다.
push는 이번 전체 범위에 포함하지 않는다.
