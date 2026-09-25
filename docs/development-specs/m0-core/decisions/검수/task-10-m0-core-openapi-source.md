# Task 10 — M0 Core OpenAPI source 초안 작성

## 요청

- M0 Core 구현 착수 전 실제 OpenAPI source 초안을 작성한다.
- 기존 `docs/system-design/03-api-design.md`와 기능별 API Spec의 method·path·operationId를 기준으로 한다.
- `M0 수집 보조` endpoint는 M0 Core OpenAPI에 포함하지 않는다.

## 반영 결정

| 항목        | 결정                                                          |
| ----------- | ------------------------------------------------------------- |
| 파일 위치   | `docs/development-specs/m0-core/openapi/m0-core.yaml`         |
| 성격        | 구현 완료 증거가 아니라 구현 입력 계약                        |
| 포함 범위   | health, 공개 boards/posts/views/policies, 관리자 posts/images |
| 제외 범위   | 수집 출처·수집 후보 API, Discord `/collect url` API           |
| method 정정 | 게시글 수정은 `PATCH /api/v1/admin/posts/{postId}`            |
| method 정정 | 게시글 최종 제거는 `DELETE /api/v1/admin/posts/{postId}`      |

## 작성 내용

- OpenAPI `3.1.0`
- 공통 success/error envelope
- pagination meta
- 공개 게시판·목록·상세·조회 수 증가
- 정책 조회
- 관리자 게시글 검색·상세·초안 생성·수정·발행·예약 취소·숨김·재공개·최종 제거
- 관리자 이미지 업로드·preview·폐기
- 주요 오류 응답과 cache header

## 검수 결과

- YAML 문법 파싱: Ruby `YAML.load_file` 통과
- OpenAPI 내부 `$ref` 존재 검사: 통과
- `git diff --check`: 통과 예정
- schema validator, generated client/server, contract test: 미수행

## 후속 작업

- OpenAPI schema validator 도입
- 예시 request/response validation 자동화
- DB migration 초안 작성
- M0 Core source scaffold 생성 후 generated client/server 연결
