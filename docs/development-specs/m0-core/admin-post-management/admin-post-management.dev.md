# 운영자 게시글 관리 개발 보강서

## 1. 문서 정보와 입력 근거

- 문서 상태: `초안`
- milestone: `M0 Core` (`m0-core`)
- 기능: `admin-post-management` — 검색·이미지·초안·발행·예약·숨김·삭제
- 기준일: 2026-09-03
- 미검증: `/admin` source, 외부 관리자 adapter, migration, OpenAPI, test, R2·outbox·scheduler runtime
- 주요 근거:
  - [서비스 기획 §3~§5, §10, §14](../../../planning/01-service-plan.md)
  - [화면 설계 §2 관리자 게시글 화면](../../../planning/03-screen-design.md)
  - [시스템 아키텍처 §4·§5](../../../system-design/01-system-architecture.md)
  - [데이터 모델 §3·§5·§7·§9](../../../system-design/02-data-model.md)
  - [API 설계 §4·§5·§6](../../../system-design/03-api-design.md)
  - [보안·운영 §3~§5·§12](../../../system-design/05-security-operations.md)

## 2. 목표와 대상 milestone

인증된 운영자가 하루 20~40개의 짤을 같은 편집기에서 작성·예약·발행하고, 권리 문의가 오면 먼저
숨긴 뒤 재공개·수정·최종 제거할 수 있게 한다.

## 3. 행위자와 진입 조건

- 행위자: 외부 관리자 인증 allowlist를 통과한 운영자
- 진입: `/admin`
- 선행: BFF `AdminIdentityProvider`, Core service token·actor, 활성 게시판, R2 private/public 분리
- 외부 인증 장애는 관리자 작업만 중지하며 공개 목록·상세는 유지한다.

## 4. 범위와 범위 밖

범위:

- 상태·게시판·제목 prefix·수정일·page 검색과 편집 상세
- JPEG·PNG·WebP·GIF staging upload·preview·미연결 폐기
- TEXT/IMAGE block 초안 생성·수정, 즉시·예약 발행, 예약 취소
- 공개 글 숨김, 숨김 글 수정·재공개·최종 제거, cache/object outbox
- lockVersion·Idempotency-Key와 상태별 UI 제한

범위 밖:

- 수집 후보·출처 화면/API, 회원·사용자 작성, 광고
- 정책 시행 command, 물리 row 삭제, 권리 문의 form/API
- R2 account·bucket·custom domain 실값 확정과 infrastructure 생성

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| 상태·게시판·제목 prefix 검색 | 확정 | 화면 설계 §2 | `search-posts`, D08 | 반영 |
| TEXT/IMAGE·출처·공지 편집 | 확정 | 화면 설계 §2 | create/update API, D08 | 반영 |
| 즉시·예약·예약 취소 | 확정 | API 설계 §5 | publish/unschedule, D01 | 반영 |
| 기본 예약 슬롯·임의 예약·장애 복구 | 확정 | 인프라 계획 §8, 보안·운영 §12 | publish, D01 | `07:30`·`17:30` KST와 매분 due 처리 반영 |
| 숨김 후 재공개·최종 제거 | 확정 | 서비스 기획 §3 | hide/republish/remove, D01 | 반영 |
| 이미지 검증·private/public 분리 | 확정 | 보안 §4, 아키텍처 §5 | image API, D01 | 반영 |
| multi-file upload validation·object 회수 | 확정 | 데이터 모델 §5, API 설계 §5, 보안·운영 §4 | `upload-images`, D01·D08 | 요청 gate fields 없음·파일별 413 우선순위·503 fields 미제공·cleanup 반영 |
| 관리자 검색의 전체 page 초과 처리 | 확정 | API 설계 §5 | `search-posts` | `200` 빈 items 반영 |
| 관리자 `postId` 형식 오류 처리 | 확정 | API 설계 §5 | `get-post-editor` | `404 POST_NOT_FOUND` 반영 |
| staging 이미지 폐기 `202` 성공 body | 확정 | API 설계 §5 | `discard-image` | 공통 성공 envelope 반영 |
| 실제 R2·관리자 provider 운영값 | 미검증 | infra·보안 정본 | 전체 | 실행 전 확인 |
| 수집·회원·광고 | 범위 밖 | 서비스 기획 §1 | 전체 | 제외 |

## 6. 업무 규칙과 수용 조건

- 새 초안과 기존 글은 같은 편집기를 사용하고 저장되지 않은 변경이 있으면 상태 명령을 막는다.
- 상태 명령은 `lockVersion`과 허용 상태를 모두 확인한다. command는 `Idempotency-Key`가 필요하다.
- `REMOVED`는 terminal이며 물리 삭제하지 않는다. 최종 제거 전 되돌릴 수 없음을 확인한다.
- 숨김 commit 직후 공개 API는 404이고 image 삭제·purge 실패는 outbox로 재시도한다.
- public image 삭제 대기 중에는 재공개·최종 제거와 숨김 글 block 교체를 막는다.
- 기본 예약 슬롯은 `07:30`, `17:30` KST(`Asia/Seoul`)이며 게시글별 임의 미래 시각도 허용한다.
- scheduler는 매분 due 글을 확인하고 장애 중 지난 예약도 복구 후 처리한다. 일시 장애는 첫 실패부터
  알림 후 성공 또는 운영자 취소까지 재시도하며, 영구 업무 오류는 알림 후 자동 재시도하지 않는다.

## 7. 데이터·권한·법무 영향

- 소유 데이터: `content.board_post`, image, block, status history; `ops.outbox_task`, idempotency request.
- BFF만 외부 identity를 검증하고 provider-neutral actor·service token만 Core에 보낸다.
- 이메일 본문·소명 자료·관리자 identity 원문은 DB·application log에 저장하지 않는다.
- 최종 제거 private 원본은 30일 복구 유예 뒤 삭제한다.

## 8. API 작업 목록

- [검색](api/search-posts.md), [편집 상세](api/get-post-editor.md)
- [이미지 업로드](api/upload-images.md), [preview](api/preview-image.md), [폐기](api/discard-image.md)
- [초안 생성](api/create-post.md), [수정](api/update-post.md)
- [발행·예약](api/publish-post.md), [예약 취소](api/unschedule-post.md)
- [숨김](api/hide-post.md), [재공개](api/republish-post.md), [최종 제거](api/remove-post.md)

## 9. D01 프로세스 목록

- [초안 작성과 즉시 발행](d01/draft-and-publish-post.md)
- [예약 발행 관리](d01/schedule-post.md)
- [권리 문의 게시글 처리](d01/handle-rights-request.md)

## 10. D08 화면·프로그램 목록

- [관리자 게시글 편집기](d08/admin-post-editor.md)

## 11. 결정·가정·미정·차단 항목

- 확정: 다중 파일 업로드는 all-or-nothing이며 하나라도 실패하면 성공 item 없이 전체 실패한다.
  요청 단위 파일 개수·전체 합계 gate 초과는 `413`이며 `fields`를 넣지 않는다. gate를 통과한 뒤
  storage 전에 모든 파일 validation을 끝낸다. 개별 크기 오류가 하나라도 있으면 top-level `413`, 그 외
  형식·decode 오류는 `415`이며 `fields[]`에는 모든 실패 파일 index와 일반화 reason을 넣는다. R2·DB
  `503`에도 `fields`를 넣지 않는다. storage 중 생성된 image row는 rollback하고 저장된 object는 즉시
  보상 삭제한다. 즉시 삭제 실패는 rollback과 분리된 `STORAGE_OBJECT` cleanup outbox가 처리하고,
  outbox 전 process crash는 식별 가능한 `staging/` key의 24시간 inventory가 회수한다. rollback된 image
  ID는 참조하지 않는다.
- 확정: 관리자 검색의 유효한 `page`가 전체 page를 넘으면 `200`과 빈 `items`를 반환한다.
- 확정: 관리자 상세의 `postId` 형식 오류·미존재·접근 불가는 `404 POST_NOT_FOUND`로 일반화한다.
- 확정: staging 이미지 폐기는 `202 Accepted`와 `imageId`, `PRIVATE_DELETE_PENDING`, `requestId`를
  담은 공통 성공 envelope를 반환하고 실제 object 삭제는 outbox가 처리한다.
- 확정: 기본 예약 발행 슬롯은 `07:30`, `17:30` KST이며 per-post 임의 시각을 허용한다. scheduler는
  매분 due 글과 장애 중 지난 예약을 처리하고 일시 실패와 영구 업무 오류의 재시도 경계를 분리한다.
- 미정: 실제 관리자 allowlist·provider 운영 설정과 R2 production 식별값.
- 미검증: 앱 source가 없는 현재 브랜치에서 구현·test·runtime은 확인하지 않았다.
- 후속 원칙: 일반 사용자 업로드를 추가할 때도 같은 all-or-nothing·보상 삭제를 적용하되 M0 Core에는
  해당 endpoint를 추가하지 않는다.
