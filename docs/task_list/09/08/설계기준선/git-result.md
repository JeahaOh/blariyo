# 설계 기준선 Git 실행 결과

- 실행일: 2026-09-08
- 상태: local commit·main fast-forward·annotated tag·readback 완료, push 미수행
- 기준선 commit: `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854`
- 변경 규모: docs 파일 64개
- 기준선 manifest: [docs/baselines/README.md](../../../../baselines/README.md)

## Branch 결과

| Ref | 실행 전 | 실행 후 | 결과 |
| --- | --- | --- | --- |
| `main` | `3f9008fcebb5193957bb4868cfcb4ac4891b1954` | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | fast-forward 완료 |
| `planning-design-only` | 기준선 작성 branch | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | local `main`과 동일 |
| `feature/m0-core` | `2bb8396092d1d84bfc2fe939f3a51e1bf1ea6cea` | 동일 | 기존 ref 보존 |

이 실행 기록을 남기는 후속 commit은 기준선 commit이나 design tag를 이동하지 않는다. 후속 commit SHA는
문서 안에 자기 참조로 고정하지 않고 `git log`에서 확인한다. remote push는 수행하지 않았다. 주 검수의
`git ls-remote` 결과 remote `main`은 `3f9008fcebb5193957bb4868cfcb4ac4891b1954`, remote
`planning-design-only`는 `0ade2e4815e74af68d337f73bd10877da28cce2f`이며 remote design tag는 없다.

## Annotated tag readback

| Tag | Object type | Peeled target | Manifest |
| --- | --- | --- | --- |
| `design/m0-core/v1` | `tag` | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | [m0-core.md](../../../../baselines/m0-core.md) |
| `design/m0-collection-assist/v1` | `tag` | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | [m0-collection-assist.md](../../../../baselines/m0-collection-assist.md) |
| `design/m1/v1` | `tag` | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | [m1.md](../../../../baselines/m1.md) |
| `design/m1-5/v1` | `tag` | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | [m1-5.md](../../../../baselines/m1-5.md) |

주 검수에서 네 tag 각각을 직접 조회해 다음을 확인했다.

1. ref의 object type은 모두 annotated `tag`다.
2. peeled target은 모두 기준선 commit과 같다.
3. annotation에는 기준선 이름, manifest 경로, 선행 관계, `design only`, 구현 수용·production 공개 제외가
   단계에 맞게 들어 있다.
4. 각 tag에서 읽은 manifest byte는 기준선 commit의 현재 파일과 같다.

## 검증과 경계

- 기준선 작성 전 정본 구조 검사는 Markdown 73개, 상대 링크 702개, 표 358개, issues 0이었다.
- 신규 baseline·task 문서의 파일·heading anchor 검사는 링크 85개, issues 0이었다. 독립 검수 보고서까지
  포함한 별도 검사는 Markdown 8개, 상대 링크 99개, 표 10개, issues 0이었다.
- `git diff --check`는 통과했고 기준선 commit 직후 local `main` working tree는 clean이었다.
- Git metadata 쓰기는 보호된 `.git` 권한 경계에서 한 번 차단됐으며, 사용자 승인 범위로 재실행해
  commit·fast-forward·tag를 완료했다.
- 이 결과는 설계 문서와 local Git ref를 고정한 증거다. source·migration·test·build·runtime·browser·
  deployment, 외부 법무 검토, 운영 실값과 production 공개 승인은 별도다.
