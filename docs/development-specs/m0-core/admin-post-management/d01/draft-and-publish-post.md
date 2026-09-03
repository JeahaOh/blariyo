# 초안 작성과 즉시 발행 D01

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-03
- 입력 근거: [아키텍처 §5 이미지 등록과 발행](../../../../system-design/01-system-architecture.md), [관리 API](../admin-post-management.dev.md)
- 미검증: UI·R2·DB·outbox runtime

## 1. 프로세스 목적과 범위

운영자가 이미지를 staging하고 TEXT/IMAGE block 초안을 저장한 뒤 즉시 공개한다.

## 2. 행위자·시작·선행 조건

인증된 운영자가 `/admin` 새 글 편집기를 열며 활성 게시판과 R2·DB 쓰기가 가능해야 한다.

## 3. 정상 흐름

1. 운영자는 필요 이미지를 업로드하고 각 preview를 확인한다.
2. 제목·본문 block·alt·출처·공지 위치를 입력한다.
3. client가 새 Idempotency-Key로 초안 생성 API를 호출한다.
4. Core가 image를 선점하고 `DRAFT`·block·상태 이력을 한 transaction에 저장한다.
5. 운영자가 저장 결과와 lockVersion을 확인하고 `즉시 발행`을 선택한다.
6. client가 새 key와 현재 version으로 발행 API를 호출한다.
7. Core가 image를 public으로 promote하고 글·image·이력·purge outbox를 commit한다.
8. 화면은 `PUBLISHED`와 갱신 version을 표시하고 공개 상세 link를 제공한다.

## 4. 대안·실패 흐름

- upload 요청 gate 실패: 파일 개수 10개 또는 전체 합계 100MiB를 초과하면 `413`으로 반환하고
  `fields`는 표시하지 않는다. 파일별 validation과 storage를 시작하지 않는다.
- upload 파일 validation 실패: 요청 gate 통과 뒤 storage 전에 모든 파일을 검사하고 성공 파일도
  반환·preview·초안 생성에 사용하지 않는다. 개별 크기 오류가 하나라도 있으면 `413`, 그 외
  형식·decode 오류는 `415`이며 `fields[]`의 모든 실패 index와 일반화 reason을 표시한다.
  validation 실패에는 storage가 없다.
- upload dependency 실패: validation 통과 뒤 R2·DB 장애는 `503`으로 반환하고 `fields`는 표시하지 않는다.
  생성된 image row는 rollback하고 저장된 object는 즉시 보상 삭제한다. 삭제 실패는 rollback과 분리된
  cleanup transaction에서 `aggregate_type=STORAGE_OBJECT`, `aggregate_id=NULL`인
  `OBJECT_DELETE_PRIVATE` outbox로 재시도한다.
  process crash로 outbox도 없으면 생성 후 24시간이 지난 `staging/` object inventory가 DB image key와
  미완료 cleanup outbox key에 없는 object만 회수한다.
- image 선점·version 충돌: 최신 편집 상세를 다시 읽고 운영자가 병합한다.
- R2 실패: 글은 DRAFT에 남고 공개 성공으로 표시하지 않는다.
- purge 실패: 발행 성공을 유지하고 운영 상태로 재시도한다.

## 5. 단계별 API 매핑

1 [upload](../api/upload-images.md)·[preview](../api/preview-image.md), 3~4 [create](../api/create-post.md),
6~7 [publish](../api/publish-post.md), 미사용 image는 [discard](../api/discard-image.md).

## 6. 데이터·상태 전이

`STAGED` image → `DRAFT`에 연결 → `PUBLIC`; post `없음→DRAFT→PUBLISHED`.

## 7. 권한·트랜잭션·멱등성·재시도

관리자 인증 필수. 초안·발행은 각각 key를 사용하고 domain 변경·history·outbox와 함께 commit한다.

## 8. 완료 조건과 수용 기준

공개 API에서 본문·이미지·alt·출처가 보이고 관리자 상태·version이 PUBLISHED와 일치해야 한다.

## 9. 미정·차단·미검증

upload all-or-nothing·storage 전 전체 validation·오류 우선순위·즉시 보상 삭제·별도 cleanup
transaction·24시간 orphan inventory 계약은 확정됐다. 실제 공개·cache·object·보상 삭제·inventory
실행 증거는 없다.
