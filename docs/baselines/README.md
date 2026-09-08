# Blariyo 설계 기준선

- 기준일: 2026-09-08
- 상태: 과거 v1 단계별 범위 정의 참고본, 현행 Git 기준선 아님
- 현행 판정: [설계 준비 상태](../system-design/design-readiness.md)
- Git ref 상태: 당시 생성한 `design/*/v1` tag는 삭제됐으며 현재 재생성하지 않는다.

이 디렉터리는 planning·legal·system-design·development-specs 정본을 복제하지 않고, 각 개발 단계가
어느 파일과 절을 단계별 입력으로 삼았는지 남긴 범위 manifest다. 당시에는 같은 commit을 가리키는
여러 tag와 manifest로 단계를 구분했으나 이 Git 전략은 폐기됐다. 아래 포함·제외 범위는 참고할 수 있지만
현재 정본의 version pin 또는 활성 Git ref로 해석하지 않는다.

## 단계와 의존성

```text
M0 Core
  ├─ M0 수집 보조
  └─ M1 회원
       └─ M1.5 익게
```

| 단계 | Manifest | 선행 범위 |
| --- | --- | --- |
| M0 Core | [m0-core.md](m0-core.md) | 없음 |
| M0 수집 보조 | [m0-collection-assist.md](m0-collection-assist.md) | M0 Core |
| M1 회원 | [m1.md](m1.md) | M0 Core; collector 불필요 |
| M1.5 익게 | [m1-5.md](m1-5.md) | M0 Core, M1 회원; collector 불필요 |

M0 자동 수집은 네 범위에서 제외한다. 목록·feed·pagination 자동 발견의 출처별 계약이 확정되면
별도 범위와 누적 commit으로 검수한다.

## Manifest 해석 규칙

1. 각 manifest는 선행 기준선에 더하는 **단계별 delta**다. M0 Core만 독립 범위이며, 후속 manifest는
   선행 manifest의 파일 목록을 반복하지 않는다.
2. `전체`와 `절`은 manifest 작성 당시의 범위 표현이다. 현재 파일 내용이 바뀌었으면 현행 정본을 직접
   읽고 영향 범위를 다시 검수한다.
3. 다음 기준선을 Git으로 고정할 때는 M0 Core부터 후속 단계까지 서로 다른 누적 commit으로 만든다.
   같은 commit에 여러 단계 tag를 붙여 의미를 나누지 않는다.
4. 현재 design tag는 만들지 않는다. commit 또는 tag를 새로 만드는 작업은 별도 승인과 readback 뒤
   현행 기록에 남긴다.
5. manifest의 `조건부 설계 확정 가능`은 구현·법무·운영·production 공개 완료가 아니다.

## 현행 Git과 구현 release 분리

- 삭제된 `design/*/v1` tag를 현행 기준선으로 주장하거나 재생성하지 않는다.
- 다음 Git 기준선이 필요하면 M0 Core와 각 후속 단계의 누적 범위를 서로 다른 commit으로 고정하고,
  실제 commit SHA와 포함 범위를 현행 기록에서 readback한다. 현재 병합에서는 새 tag를 만들지 않는다.
- 애플리케이션 구현 release는 `app-vX.Y.Z` 같은 별도 tag/release로 관리한다. release metadata에
  대응하는 설계 commit과 차이·미충족 gate를 적고 설계 문서 자체를 구현 완료 증거로 사용하지 않는다.
- [설계 기준선 작업 기록](../task_list/09/08/설계기준선/task.md)은 당시 실행 이력으로 보존한다. 현행
  branch·commit·tag 상태는 Git을 직접 조회한다.

## 공통 제외와 검증 경계

- `worklog/`, `docs/task_list/`, `docs/publishing/`, `docs/wireframes/`는 이력·검토 증거이며 제품·기술
  기준선 정본이 아니다. manifest나 readback 기록 자체는 기준선의 범위를 설명하는 metadata다.
- 운영자·담당자·이메일·시행일·수탁자·provider/Discord 계정·출처 허용 결과 같은 실값은 관련
  manifest의 공개 gate로 남긴다.
- source·migration·생성 타입·test·build·DB·runtime·browser·deployment는 실제 구현에서 별도 검증한다.
- 법무 문서는 초안과 차단 조건을 기준선에 포함하지만 법률 자문이나 적법성 확정으로 해석하지 않는다.
