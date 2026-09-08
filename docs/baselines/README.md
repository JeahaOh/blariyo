# Blariyo 설계 기준선

- 기준일: 2026-09-08
- 상태: v1 범위 명세·문서 검수 완료, 기술·법무 조건부
- 현행 판정: [설계 준비 상태](../system-design/design-readiness.md)

이 디렉터리는 planning·legal·system-design·development-specs 정본을 복제하지 않고, 각 개발 단계가
어느 파일과 절을 입력으로 사용하는지 고정하는 범위 manifest다. 기준선 tag가 같은 commit을 가리켜도
manifest의 포함·제외 범위와 선행 기준선이 단계의 의미를 구분한다.

## 단계와 의존성

```text
design/m0-core/v1
  ├─ design/m0-collection-assist/v1
  └─ design/m1/v1
       └─ design/m1-5/v1
```

| 단계 | Manifest | 기준선 annotated tag | 선행 기준선 |
| --- | --- | --- | --- |
| M0 Core | [m0-core.md](m0-core.md) | `design/m0-core/v1` | 없음 |
| M0 수집 보조 | [m0-collection-assist.md](m0-collection-assist.md) | `design/m0-collection-assist/v1` | `design/m0-core/v1` |
| M1 회원 | [m1.md](m1.md) | `design/m1/v1` | `design/m0-core/v1`; collector 불필요 |
| M1.5 익게 | [m1-5.md](m1-5.md) | `design/m1-5/v1` | `design/m0-core/v1`, `design/m1/v1`; collector 불필요 |

M0 자동 수집은 네 기준선에서 제외한다. 목록·feed·pagination 자동 발견의 출처별 계약이 확정되면
별도 manifest와 새 design tag로 만든다.

## Manifest 해석 규칙

1. 각 manifest는 선행 기준선에 더하는 **단계별 delta**다. M0 Core만 독립 범위이며, 후속 manifest는
   선행 manifest의 파일 목록을 반복하지 않는다.
2. `전체`는 해당 tag가 가리키는 commit의 파일 전체다. `절`은 표에 적은 Markdown heading과 그 하위
   내용만 뜻한다. 한 표나 절에 여러 단계가 섞이면 manifest가 명시한 단계의 행·문장만 포함한다.
3. 정본이 tag 뒤 바뀌어도 기존 `v1` tag를 옮기거나 덮어쓰지 않는다. 영향 범위를 재검수하고 새
   manifest version과 annotated tag를 만든다.
4. tag 메시지는 기준선 이름, manifest 경로, 설계 전용이라는 점을 기록한다. commit SHA는 manifest에
   미리 쓰지 않고 annotated tag가 가리키는 객체를 readback해 후속 작업 기록에 남긴다.
5. manifest의 `조건부 설계 확정 가능`은 구현·법무·운영·production 공개 완료가 아니다.

## Git과 구현 release 분리

- 첫 docs commit을 main에 fast-forward한 뒤 같은 commit에 네 annotated design tag를 붙일 수 있다.
  같은 tree를 공유하므로 정본 복제나 단계별 인위적 commit 분할이 필요하지 않다.
- tag 생성 뒤 실제 object type·대상 commit·annotation·manifest 존재를 readback하고 별도 실행 기록
  commit을 main에 남긴다. 이 때문에 main이 design tag보다 한 commit 앞설 수 있다.
- 애플리케이션 구현 release는 `app-vX.Y.Z` 같은 별도 tag/release로 관리한다. release metadata에
  구현한 design tag 목록과 차이·미충족 gate를 적고 design tag를 구현 완료 증거로 사용하지 않는다.
- 실제 commit·main fast-forward·tag 생성과 readback 상태는
  [설계 기준선 작업 기록](../task_list/09/08/설계기준선/task.md)과 Git 조회 결과에서 확인한다. push는
  범위 밖이다.

## 공통 제외와 검증 경계

- `worklog/`, `docs/task_list/`, `docs/publishing/`, `docs/wireframes/`는 이력·검토 증거이며 제품·기술
  기준선 정본이 아니다. manifest나 readback 기록 자체는 기준선의 범위를 설명하는 metadata다.
- 운영자·담당자·이메일·시행일·수탁자·provider/Discord 계정·출처 허용 결과 같은 실값은 관련
  manifest의 공개 gate로 남긴다.
- source·migration·생성 타입·test·build·DB·runtime·browser·deployment는 실제 구현에서 별도 검증한다.
- 법무 문서는 초안과 차단 조건을 기준선에 포함하지만 법률 자문이나 적법성 확정으로 해석하지 않는다.
