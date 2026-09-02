# Blariyo 개발 Spec 산출물 계약

이 문서는 `blariyo-plan-to-development-spec`이 만드는 Markdown 파일의 이름과 최소 내용을 정의한다.
항목이 해당되지 않으면 삭제하거나 공란으로 두지 말고 `해당 없음`과 이유를 적는다. 다만 API 자체가
없는 기능에는 빈 API Spec 파일을 만들지 않는다.

## 디렉터리와 이름

```text
docs/development-specs/<milestone>/<feature-slug>/
├── <feature-slug>.dev.md
├── api/
│   └── <operation>.md
├── d01/
│   └── <process>.md
└── d08/
    └── <screen-or-program>.md
```

- `<milestone>`: planning에서 사용하는 단계명과 일치하는 lowercase kebab-case. 예: `m0-core`, `m0-collection-assist`, `m1`.
- `<feature-slug>`: route 변경과 무관하게 기능을 식별할 안정적인 lowercase kebab-case.
- `<operation>`: `search-posts`, `publish-post`처럼 하나의 API 작업을 나타내는 동사 중심 slug.
- `<process>`: `browse-posts`, `publish-post`처럼 하나의 시작·종료 경계를 가진 업무 흐름 slug.
- `<screen-or-program>`: `meme-list`, `post-detail`, `admin-post-editor`처럼 화면 또는 사용자 프로그램 slug.

## 공통 문서 정보

모든 파일은 다음 정보를 포함한다.

| 항목 | 규칙 |
| --- | --- |
| 문서 상태 | `초안`, `작성 완료`, `차단` 중 하나 |
| milestone | planning의 단계명과 출처 |
| 기능 | feature slug와 사람이 읽는 기능명 |
| 기준일 | 실제 작성·갱신 날짜 |
| 입력 근거 | 상대 링크와 절·표·항목 |
| 미검증 | source·test·runtime 등 확인하지 않은 증거 |

문서 상태 `작성 완료`는 해당 Markdown 계약과 문서 검증이 끝났다는 뜻이다. source 구현, 테스트 또는
배포가 끝났다는 뜻으로 사용하지 않는다.

## 개발 보강서 `<feature-slug>.dev.md`

최소 섹션:

1. 문서 정보와 입력 근거
2. 목표와 대상 milestone
3. 행위자와 진입 조건
4. 범위와 범위 밖
5. 요구사항 추적표
6. 업무 규칙과 수용 조건
7. 데이터·권한·법무 영향
8. API 작업 목록 또는 `API 해당 없음`
9. D01 프로세스 목록
10. D08 화면·프로그램 목록
11. 결정·가정·미정·차단 항목

요구사항 추적표는 최소한 `요구사항`, `분류`, `출처`, `반영 산출물`, `상태`를 가진다. 분류는
`확정`, `가정`, `결정 필요`, `미검증`, `범위 밖`만 사용한다.

## API Spec `api/<operation>.md`

API 작업 하나당 파일 하나를 사용한다. 외부 BFF와 내부 Core 호출이 나뉘면 consumer·provider와
호출 경계를 명시하되 같은 작업 계약을 불필요하게 복제하지 않는다.

최소 섹션:

1. 작업 목적과 호출 주체·제공 주체
2. Method·path·인증·권한
3. request path·query·header·body
4. response와 공통 envelope 참조
5. validation과 정규화
6. 정상 처리와 데이터·상태 전이
7. 오류·권한·충돌·timeout·부분 실패
8. 멱등성·동시성·재시도
9. pagination·cache·호환성 중 해당 항목
10. 예시 request·response
11. contract test와 미검증 항목

필드 표는 최소한 `필드`, `타입`, `필수`, `제약`, `출처·소유권`, `설명`을 가진다. 예시 값은 실제
credential·개인정보를 쓰지 않고 계약을 설명하는 비식별 값만 사용한다.

## D01 프로세스 명세 `d01/<process>.md`

최소 섹션:

1. 프로세스 목적과 범위
2. 행위자·시작 조건·선행 조건
3. 정상 흐름 번호 목록
4. 대안·실패 흐름
5. 단계별 호출 API 매핑 또는 `API 해당 없음`
6. 데이터·상태 전이
7. 권한·트랜잭션·멱등성·재시도
8. 완료 조건과 수용 기준
9. 미정·차단·미검증 항목

Mermaid가 순서나 분기를 실제로 더 명확하게 만들 때만 보조 흐름도를 넣는다. 다이어그램만 두지 말고
동일한 단계 번호를 가진 텍스트 흐름을 유지한다.

## D08 프로그램 명세 `d08/<screen-or-program>.md`

최소 섹션:

1. 화면·프로그램 목적, route와 milestone
2. 진입·이탈·권한 조건
3. UI 영역과 구성요소
4. 필드·표시값·validation
5. 이벤트·버튼·이동·후처리
6. loading·empty·error·권한 없음·부분 실패 상태
7. 반응형과 접근성
8. 이벤트별 D01·API 매핑 또는 `API 해당 없음`
9. 메시지와 사용자 피드백
10. 화면 수용 조건
11. 미정·차단·미검증 항목

D08은 planning의 화면 규칙을 구현 단위로 구체화한다. publishing·wireframe과 다르면 어느 쪽이
stale인지 추측하지 않고 planning 근거, 관측 차이와 필요한 결정을 기록한다.
