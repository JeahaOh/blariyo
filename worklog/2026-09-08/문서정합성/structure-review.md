# 문서 구조·참조·상태·화면 정합성 감사

- 감사일: 2026-09-08
- 범위: `docs/planning/`, `docs/legal/`, `docs/system-design/`, `docs/development-specs/`의 Markdown 구조·상대 링크·앵커·표와, `docs/publishing/`, `docs/wireframes/`의 현재 단계 표기 및 화면 계약 대조
- 제외: source·migration·runtime·브라우저 실행 검증, 외부 URL의 응답·법률 내용 검증, `worklog/`의 과거 기록을 현행 사실로 판정하는 작업
- 판정 원칙: 정적 publishing/wireframe은 구현 증거가 아니다. 화면이 아직 구현되지 않았다는 사실은 결함으로 세지 않았고, 화면이 현행 정본에서 이미 확정된 사항을 `미정` 또는 다른 정책으로 표시할 때만 발견으로 기록했다.

## 확정 발견

### Medium — API 표의 미이스케이프 `|`가 열을 늘려 계약을 잘못 렌더링함

- 근거: `docs/system-design/03-api-design.md:512`; `docs/system-design/06-member-community-design.md:261`, `:265`, `:266`, `:278`, `:279`, `:281`, `:283`, `:287`, `:344`
- 문제: API enum·nullable 표기(`URL_ONLY|LIST_CRAWL`, `string|null`, `timestamp|null` 등)가 Markdown 표 셀 안에서 이스케이프되지 않았다. GFM은 inline code 안의 `|`도 열 구분자로 읽으므로, 2열/3열 표를 3~7열로 분할한다.
- 영향: 익게·운영 API의 성공 data와 내부 OAuth route 계약이 열 경계에서 어긋나 읽히므로, 구현자가 field/type을 잘못 해석할 수 있다.
- 최소 조치: 셀 내부의 union 표기를 ``string\|null``처럼 escape하거나, `null 가능` 같은 자연어로 바꾼다. 같은 표의 모든 row를 다시 렌더링해 열 수를 확인한다.

### Medium — 정적 정책 modal의 소셜 프로필 수집 설명이 현행 법무·M1 계약과 다름

- 근거: `docs/publishing/responsive/app.js:349-350`
- 정본: `docs/legal/privacy-policy.md:69`, `:83-94`; `docs/legal/signup-privacy-consent.md:19-28`
- 문제: 정적 modal은 소셜 제공자의 이메일·닉네임·프로필 이미지를 처리한다고 표시한다. 현행 M1 정본은 제공자 고유 식별자만 가입 키로 쓰고 이메일·닉네임·사진을 추가 요청·저장하지 않으며, 불가피하게 전달된 선택 프로필도 보관하지 않는다고 정한다.
- 영향: 이 파일은 정적 혼합 단계 검토물(`docs/publishing/responsive/README.md:9-14`, `:49-56`)이므로 운영 개인정보 처리나 실제 구현의 위반 증거는 아니다. 다만 화면 검토에서 법무 정본과 다른 수집 범위를 전달한다.
- 최소 조치: modal을 현행 법무 초안의 최소 수집 문구로 바꾸거나, M1 이전 참고 문구임을 화면 안에 명확히 표시한다. 실제 정책 전문을 보여주는 기능으로 승격할 때에는 전문·버전·시행일 확정본을 단일 출처로 사용한다.

### Low — 익게 참고 와이어프레임이 이미 확정된 M1.5 정책을 “미정”으로 표시함

- 근거: `docs/wireframes/community/index.html:71`, `:91`, `:94`, `:114-119`
- 정본: `docs/planning/08-member-community-plan.md:64-96`; 화면 참조 연결 `docs/planning/03-screen-design.md:421`
- 문제: 참고 화면은 댓글·신고·익명성·탈퇴 뒤 콘텐츠, 수정·삭제·운영 규칙을 “익게 개발 전에 결정”, “상세 정책 미정”이라고 한다. 현행 제품 계약에는 공개 읽기/회원 참여, 20개 페이지, 글·댓글 수정·삭제 조건, 글별 랜덤 이름, 신고와 숨김·삭제·제재 규칙이 이미 정해져 있다.
- 영향: 아직 초기 공개 대상이 아닌 정적 참고 화면인 점은 정상이며, 실행/브라우저 검증 미실행도 결함이 아니다. 다만 이후 화면 설계의 출발점으로 쓸 때 옛 보류 상태를 재도입할 위험이 있다.
- 최소 조치: 제목을 “M1.5 설계 참고”로 갱신하고 `미정` 탭에는 실제 미결정 항목만 남기거나, 현행 제품 계약 링크와 기준일을 화면에 표시한다.

## 구조 검증 결과

| 검사 | 범위·명령 | 결과 |
| --- | --- | --- |
| 상대 링크·Markdown 앵커 | `python3 docs/task_list/09/08/문서정합성/check_structure.py` | Markdown 71개, local relative link 660개 검사; 끊긴 파일·Markdown 앵커 0건 |
| fenced code block | 같은 명령 | 닫히지 않은 fence 0건 |
| Markdown 표 | 같은 명령 | 표 342개 검사; 위 확정 발견의 10개 행에서 열 수 불일치 |
| 변경 공백 오류 | `git diff --check` | 통과 |
| 단계·화면 계약 | publishing/wireframes 11개 파일을 `docs/planning/03-screen-design.md`, `08-member-community-plan.md`과 대조 | 위 정적 정책 문구 1건, 익게 상태 문구 1건 확정 |

`/private/tmp/blariyo-check-m1.py`는 변경·untracked Markdown만 대상으로 하므로 전체 정본 감사의 근거로 쓰지 않았다. 이번 `docs/task_list/09/08/문서정합성/check_structure.py`는 네 정본 디렉터리의 Markdown 전체를 검사한다. 링크 통과는 경로와 앵커 존재만 뜻하며, 정책·계약의 의미 정합성 점수로 환산하지 않았다. 외부 URL, HTML/JavaScript 내부 링크, 렌더러별 실제 시각 출력은 이 기계 검사 범위 밖이다.

## 상태

- 완료: 구조·상대 링크·앵커·표 검사와 정적 화면의 현행 계약 대조.
- 미검증: 브라우저 렌더링, source/migration/OpenAPI 생성, test/build/runtime/deployment, 외부 링크와 법무 확정값.
- 차단: 법무 전문의 운영 버전·시행일·실값, provider 설정과 공개 조건은 현행 정본에 남아 있으며 이번 감사로 해제되지 않았다.
