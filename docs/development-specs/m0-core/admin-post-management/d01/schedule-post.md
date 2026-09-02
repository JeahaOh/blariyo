# 예약 발행 관리 D01

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [아키텍처 §5 예약 발행](../../../../system-design/01-system-architecture.md), [발행 API](../api/publish-post.md)
- 미검증: cron·scheduler·R2·outbox runtime

## 1. 프로세스 목적과 범위

초안을 미래 시각으로 예약하고 필요하면 취소하며, due scheduler가 한 번만 공개한다.

## 2. 행위자·시작·선행 조건

운영자는 저장된 DRAFT와 현재 version을 가진다. scheduler는 매분 실행된다.

## 3. 정상 흐름

1. 운영자가 수신 시각보다 최소 1분 뒤 시각을 선택한다.
2. 발행 API `mode=SCHEDULED`를 호출해 `DRAFT→SCHEDULED`로 바꾼다.
3. 매분 scheduler가 due candidate를 선택하고 private image를 결정적 public key로 copy한다.
4. `status=SCHEDULED`와 lockVersion 조건부 transaction 한 건만 `PUBLISHED`로 바꾼다.
5. history·cache purge outbox를 commit하고 worker가 purge한다.

## 4. 대안·실패 흐름

- 취소: due 전 예약 취소 API로 `SCHEDULED→DRAFT`.
- R2 실패: SCHEDULED 유지 후 다음 실행에서 재시도.
- 조건부 update 실패: 다른 worker가 처리한 것으로 보고 DB 변경 없이 종료.
- 공지 제약 예외: DRAFT로 되돌리고 `PINNED_ORDER_CONFLICT` 운영 알림, 무한 재시도 금지.

## 5. 단계별 API 매핑

운영자 예약·즉시 전환은 [publish](../api/publish-post.md), 취소는 [unschedule](../api/unschedule-post.md).
Scheduler는 HTTP API가 아니라 같은 service/repository를 쓰는 `posts:publish-due` command다.

## 6. 데이터·상태 전이

`DRAFT→SCHEDULED→PUBLISHED` 또는 `SCHEDULED→DRAFT`. image는 실제 공개 성공 때 PUBLIC이다.

## 7. 권한·트랜잭션·멱등성·재시도

운영자 command는 key·version, scheduler는 system actor·조건부 update를 사용한다. R2 copy는 결정적 key다.

## 8. 완료 조건과 수용 기준

예약 전 비공개, due 후 1회 공개, 취소 시 비공개, 장애 복구 후 지난 예약 발행을 확인해야 한다.

## 9. 미정·차단·미검증

정확한 하루 두 차례 운영 시각은 `(미정)`이며 per-post 예약 계약을 막지 않는다. runtime은 미검증이다.
