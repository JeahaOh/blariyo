# 수집 보조 개발 보강서

## 1. 문서 정보와 입력 근거

- 문서 상태: `초안`
- milestone: `M0 수집 보조` (`m0-collection-assist`)
- 기능: `collection-assist` — 로컬 collector 기반 Discord·운영자 URL 지정 후보 생성·검수·반려·초안 승격
- 기준일: 2026-09-04
- 미검증: source, migration, OpenAPI, test, runtime, browser, 실제 출처별 운영 위험·robots 확인
- 주요 근거:
  - [콘텐츠 수집 기획](../../../planning/content-collection/README.md)
  - [출처 명세 템플릿](../../../planning/content-collection/source-spec-template.md)
  - [서비스 기획 §1·§5·§8](../../../planning/01-service-plan.md)
  - [화면 설계 §2 수집 후보 검수](../../../planning/03-screen-design.md)
  - [시스템 아키텍처 §4·§5 수집 흐름](../../../system-design/01-system-architecture.md)
  - [데이터 모델 §6 수집 데이터](../../../system-design/02-data-model.md)
  - [API 설계 §5 수집 API](../../../system-design/03-api-design.md)
  - [보안·운영 §4 수집](../../../system-design/05-security-operations.md)

## 2. 목표와 대상 milestone

운영자가 관리자 화면 또는 Discord `/collect url`로 등록·활성 출처의 단일 상세 페이지 원문 URL을
한 건 입력하면, 운영자 로컬 컴퓨터의 collector가 제목과 이미지 후보 metadata를 추출해 BE에 제출하고
운영자가 검수·반려·초안 승격을 수행하게 한다. BE·FE는 외부 사이트를 직접 fetch하지 않는다. 수집
결과는 자동 발행하지 않고, `M0 Core`의 수동 작성·발행 경로를 재사용한다.

## 3. 행위자와 진입 조건

- 행위자: 외부 관리자 인증 allowlist를 통과한 운영자
- 진입: `/admin/collect`, 로컬 collector의 Discord `/collect url`
- 선행: `M0 Core`의 관리자 인증, 수동 초안·이미지·발행·숨김 흐름 검증
- 출처 선행: 출처별 명세의 운영 위험 판정, `robots.txt`, 등록·활성 host, parser 방식 사용 결정

## 4. 범위와 범위 밖

범위:

- 관리자 화면 또는 Discord 명령의 운영자 URL 한 건으로 후보 작업 접수·결과 제출
- `PENDING`, `RUNNING`, `NEW`, `FETCH_FAILED`, `APPROVED`, `REJECTED` 후보 목록·상세 검수
- 실패 후보 재시도와 후보 반려
- 선택 이미지 후보를 저장하고 기존 초안 생성 경로로 승격
- 중복 후보·기존 게시글 경고와 승격 전 확인

범위 밖:

- 사용 결정된 출처 목록·feed의 주기 자동 수집
- Discord 일반 메시지 감시, 목록 수집 강제 실행, 후보 검수·발행 명령
- 출처 신규 등록·삭제·robots 판정 변경 UI
- 자동 발행, 로그인·CAPTCHA·유료 장벽·차단 우회
- 원문 HTML 전체 저장, 이미지 binary의 DB·영구 object storage 후보 단계 저장

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| 수집 기능은 M0 Core 뒤 별도 활성화 | 확정 | 콘텐츠 수집 기획 §2 | 전체 | 반영 |
| 로컬 collector가 관리자 화면 또는 Discord `/collect url`의 URL 한 건 후보 생성 | 확정 | 콘텐츠 수집 기획 §3.2·§8 | `create-candidate-from-url`, D01, D08 | 반영 |
| 등록·활성되지 않은 host·robots 금지 거부 | 확정 | 보안·운영 §4 | API·D01 | 반영 |
| 후보 단계는 metadata와 임시 preview만 저장 | 확정 | 콘텐츠 수집 기획 §4, 데이터 모델 §6 | API·D01·D08 | 반영 |
| 이미지는 Python 작업 경로에 임시 저장 후 게시 결정 시 영구 저장 | 확정 | 콘텐츠 수집 기획 §4, API 설계 §5 | API·D01·D08 | 반영 |
| 실패 후보 재시도·반려 | 확정 | API 설계 §5 | `retry-candidate`, `reject-candidate` | 반영 |
| 초안 승격은 기존 게시글 command 재사용 | 확정 | 아키텍처 §5 | `promote-candidate-to-draft`, D01 | 반영 |
| 후보 화면에 원문 HTML·내부 오류 노출 금지 | 확정 | 화면 설계 §2, 보안·운영 §7 | D08 | 반영 |
| 자동 목록 수집과 Discord 목록 실행 명령 | 범위 밖 | 콘텐츠 수집 기획 §2·§8 | 전체 | M0 자동 수집으로 분리 |
| 출처별 실제 selector·요청 간격 | 결정 필요 | 출처 명세 템플릿 | 전체 | 출처별 spec 필요 |

## 6. 업무 규칙과 수용 조건

- 로컬 collector만 등록·활성 출처 host를 fetch한다.
- M0 수집 보조는 입력된 단일 상세 페이지 1건만 fetch하고 목록·feed·pagination·scheduler를 호출하지 않는다.
- Discord `/collect url`은 BE 내부 scraper가 아니라 로컬 collector가 처리한다.
- Discord incoming webhook은 결과 알림용이며 URL 수신에는 사용하지 않는다.
- URL은 `https`만 허용하고 정규화 뒤 중복 후보를 검사한다.
- 같은 출처 host 안에서만 최대 3회 redirect를 따른다.
- 사설·loopback·link-local·metadata 주소로 해석되는 대상은 거부한다.
- `robots.txt` 금지 또는 미확인 경로는 후보를 만들지 않는다.
- 요청 간격과 일일 상한을 넘으면 collector가 fetch하지 않고 `SOURCE_RATE_LIMITED` 결과를 제출한다.
- fetch 실패·timeout·비HTML·parser 실패는 `FETCH_FAILED` 후보로 남겨 운영자가 재시도 또는 반려한다.
- 후보 단계에는 원문 URL, 제목, 이미지 후보 URL, 경고·실패 사유 metadata와 관리자 preview 식별자만 저장한다.
- Python extractor는 운영자 검수 미리보기에 필요한 이미지 후보를 로컬 작업 경로에 임시 저장할 수 있다.
- 임시 이미지 파일은 DB image row나 영구 object storage가 아니며, 반려·만료·재시도 교체 시 삭제한다.
- 초안 승격 때 선택한 이미지 후보는 collector preview upload 또는 운영자 업로드 파일을 사용하고,
  관리자 업로드와 같은 검증·재인코딩을 적용한다. BE는 원격 이미지 URL을 직접 fetch하지 않는다.
- 초안 생성 transaction 실패 시 후보는 `NEW`로 유지하고 저장된 이미지는 staging orphan 정리 대상으로 둔다.

## 7. 데이터·권한·법무 영향

- 읽기·쓰기: `collect.source`, `collect.candidate`, `collect.candidate_image`.
- 초안 승격 시 기존 `content.board_post`, `content.board_post_block`, `content.board_post_image` command를 재사용한다.
- 외부 fetch는 로컬 collector만 수행하고 BFF·Core는 직접 외부 사이트를 호출하지 않는다.
- 후보 제목·원문 URL 전체·HTML·이미지 binary·로컬 Python 임시 파일 내부 경로를 application log나 Discord 보고서에 남기지 않는다.
- 출처별 운영 위험 판정과 robots 확인 전에는 production 활성화하지 않는다. 이용약관은 자동 차단 조건이 아니라 운영 위험 참고값으로 기록한다.

## 8. API 작업 목록

- [수집 작업 접수와 후보 결과 생성](api/create-candidate-from-url.md)
- [Collector 내부 API](api/collector-internal-api.md)
- [후보 재시도](api/retry-candidate.md)
- [후보 반려](api/reject-candidate.md)
- [후보 초안 승격](api/promote-candidate-to-draft.md)

출처 조회·수정 API는 상위 API 설계에 구현 순서로 언급되어 있으나 세부 request·response가 아직
분리되어 있지 않다. 출처 관리 UI를 구현하려면 system-design API 계약을 먼저 보강한다.

## 9. D01 프로세스 목록

- [URL 후보 생성과 검수](d01/create-and-review-candidate.md)
- [후보 재시도와 반려](d01/retry-or-reject-candidate.md)
- [후보 초안 승격](d01/promote-candidate-to-draft.md)

## 10. D08 화면·프로그램 목록

- [수집 후보 검수 화면](d08/collect-candidate-review.md)

## 11. 결정·가정·미정·차단 항목

- 확정: M0 수집 보조는 자동 발행하지 않는다.
- 확정: 수집 실패는 공개 목록·상세와 수동 게시를 막지 않는다.
- 확정: 후보 단계에서 이미지는 Python 작업 경로에 임시 저장할 수 있고, 영구 저장소에는 초안 승격 때만 저장한다.
- 확정: Discord 연결 scraper는 운영자 로컬 컴퓨터에서 별도 프로세스로 실행하고 BE·FE runtime과 분리한다.
- 결정 필요: 첫 출처별 source spec, 실제 사용 URL, selector, 요청 간격, 일일 상한.
- 결정 필요: 출처 관리 API의 세부 request·response.
- 차단: 출처별 운영 위험 판정·robots 확인 전 production 활성화 불가.
- 미검증: source, migration, OpenAPI, test, runtime, browser.
