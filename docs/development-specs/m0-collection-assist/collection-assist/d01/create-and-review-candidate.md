# URL 후보 생성과 검수 D01

## 1. 프로세스 목적과 범위

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-04
- 입력 근거: [수집 보조 개발 보강서](../collection-assist.dev.md)
- 미검증: source, test, browser, 실제 출처 fetch

운영자가 원문 URL을 입력해 후보를 만들고, 후보 목록·상세에서 결과를 확인한다.

## 2. 행위자·시작 조건·선행 조건

- 행위자: 인증된 운영자
- 시작 조건: `/admin/collect` 진입 후 원문 URL 입력 또는 로컬 collector의 Discord `/collect url` 명령
- 선행 조건: 등록·활성 출처와 parser, 관리자 인증 또는 Discord 운영자 권한, M0 Core 수동 초안 경로

## 3. 정상 흐름

1. 운영자가 관리자 화면에서 원문 URL을 입력하고 `후보 만들기`를 선택하거나 Discord `/collect url` 명령을 실행한다.
2. 화면은 중복 제출을 막고 생성 중 상태를 표시한다.
3. 관리자 화면은 BFF를 통해 후보를 `PENDING`으로 접수한다.
4. Discord 명령은 로컬 collector가 직접 받고 guild·channel·user 권한을 검증한다.
5. 로컬 collector는 관리자 접수 작업을 claim하거나 Discord 명령 URL을 내부 작업으로 만든다.
6. collector는 출처·robots·요청 상한·DNS 안전성·redirect 경계를 확인한다.
7. collector는 상세 페이지를 1회 fetch하고 parser를 실행한다.
8. Python extractor는 미리보기에 필요한 이미지 후보를 로컬 작업 경로에 임시 저장한다.
9. collector는 후보와 이미지 후보 metadata, preview 식별자를 BE에 제출한다.
10. 화면은 후보 목록에 새 후보 또는 실패 후보를 표시한다.
11. 운영자는 원문 링크, 제목, 이미지 후보 preview, 중복 표시, 실패 사유를 확인한다.

## 4. 대안·실패 흐름

- 등록되지 않은 host: 후보를 만들지 않고 허용되지 않은 출처로 표시한다.
- robots 금지: 후보를 만들지 않고 수집 금지로 표시한다.
- 요청 상한 초과: `Retry-After` 기준으로 재시도 가능 시점을 표시한다.
- fetch·parser 실패: `FETCH_FAILED` 후보를 표시하고 재시도·반려만 허용한다.
- 중복 후보: 기존 후보를 안내하고 새 후보를 만들지 않는다.

## 5. 단계별 호출 API 매핑

| 단계 | API |
| --- | --- |
| 3 | [수집 작업 접수와 후보 결과 생성](../api/create-candidate-from-url.md) |
| 5~9 | [Collector 내부 API](../api/collector-internal-api.md) |

## 6. 데이터·상태 전이

- 없음 -> `PENDING`: 관리자 화면 URL 입력 접수
- `PENDING` -> `RUNNING`: 로컬 collector 작업 claim
- `PENDING` 또는 `RUNNING` -> `NEW`: 제목·이미지 후보 추출 성공
- `PENDING` 또는 `RUNNING` -> `FETCH_FAILED`: 요청 허용 후 fetch·parser 실패
- 후보 이미지 metadata는 `DISCOVERED`로 저장한다.
- Python 임시 이미지 파일은 DB image row가 아니며 반려·만료·재시도 교체 시 삭제 대상이다.

## 7. 권한·트랜잭션·멱등성·재시도

- 관리자 인증과 Core service token·actor가 필요하다.
- Discord 명령은 로컬 collector가 guild·channel·user 권한을 먼저 검증하고 내부 actor로 변환한다.
- 생성 API는 `Idempotency-Key`를 사용한다.
- Discord interaction id는 같은 명령 중복 실행을 막는 멱등 key로 사용한다.
- 같은 정규화 URL은 unique constraint로 중복 생성을 막는다.

## 8. 완료 조건과 수용 기준

- 후보 또는 명시적 실패 상태로 끝난다.
- BE·FE는 외부 사이트를 직접 fetch하지 않는다.
- 원문 HTML 전체와 내부 오류 상세를 화면·로그에 노출하지 않는다.
- Python 임시 파일 내부 경로와 image binary를 화면·로그에 노출하지 않는다.
- 수집 실패가 공개 목록·상세와 수동 게시를 막지 않는다.
- 일반 Discord 채널 메시지를 감시하지 않는다.

## 9. 미정·차단·미검증 항목

- 차단: 출처별 약관·robots·parser spec 전 production 활성화 불가
- 미검증: source, contract test, browser
