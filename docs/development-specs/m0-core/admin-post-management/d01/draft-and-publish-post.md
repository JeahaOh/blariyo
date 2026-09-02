# 초안 작성과 즉시 발행 D01

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [아키텍처 §5 이미지 등록과 발행](../../../../system-design/01-system-architecture.md), [관리 API](../admin-post-management.dev.md)
- 미검증: upload 부분 실패 계약, UI·R2·DB·outbox runtime

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

- upload 실패: 해당 파일 오류를 표시하고 초안 생성에 포함하지 않는다. multipart 일부 실패 처리 방식은 결정 필요다.
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

upload 일부 실패 계약 확정 전 `초안`. 실제 공개·cache·object 증거는 없다.
