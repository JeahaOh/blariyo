# 예약 발행 관리 D01

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-03
- 입력 근거: [인프라 계획 §8](../../../../planning/02-infra-plan.md), [아키텍처 §5 예약 발행](../../../../system-design/01-system-architecture.md), [보안·운영 §12 예약 발행 실패](../../../../system-design/05-security-operations.md), [발행 API](../api/publish-post.md)
- 미검증: cron·scheduler·R2·outbox runtime

## 1. 프로세스 목적과 범위

초안을 미래 시각으로 예약하고 필요하면 취소하며, due scheduler가 장애 중 지난 예약을 포함해 한 번만 공개한다.

## 2. 행위자·시작·선행 조건

운영자는 저장된 DRAFT와 현재 version을 가진다. 기본 운영 슬롯은 `07:30`, `17:30`
KST(`Asia/Seoul`)지만 게시글별 임의 미래 시각도 허용한다. scheduler는 매분 실행된다.

## 3. 정상 흐름

1. 운영자가 기본 슬롯 또는 수신 시각보다 최소 1분 뒤인 임의 시각을 선택한다.
2. 발행 API `mode=SCHEDULED`를 호출해 `DRAFT→SCHEDULED`로 바꾼다.
3. 매분 scheduler가 `scheduledAt <= now`인 due candidate를 선택한다. 장애 중 지난 예약도 복구 후
   다음 실행에서 같은 기준으로 선택하고 private image를 결정적 public key로 copy한다.
4. `status=SCHEDULED`와 lockVersion 조건부 transaction 한 건만 `PUBLISHED`로 바꾼다.
5. history·cache purge outbox를 commit하고 worker가 purge한다.

## 4. 대안·실패 흐름

- 취소: due 전 예약 취소 API로 `SCHEDULED→DRAFT`.
- 일시 R2·DB·network 실패: `SCHEDULED` 유지, 첫 실패부터 운영 알림, 다음 분 실행에서 재시도.
  같은 게시글·오류의 반복 알림은 묶고, 성공하거나 운영자가 취소할 때까지 자동 재시도 횟수를
  제한하지 않는다.
- 조건부 update 실패: 다른 worker가 처리한 것으로 보고 DB 변경 없이 종료.
- 공지 제약 예외: 같은 입력으로 성공할 수 없는 영구 업무 오류이므로 `DRAFT`로 되돌리고
  `PINNED_ORDER_CONFLICT`를 한 번 운영 알림한 뒤 자동 재시도하지 않는다.

## 5. 단계별 API 매핑

운영자 예약·즉시 전환은 [publish](../api/publish-post.md), 취소는 [unschedule](../api/unschedule-post.md).
Scheduler는 HTTP API가 아니라 같은 service/repository를 쓰는 `posts:publish-due` command다.

## 6. 데이터·상태 전이

`DRAFT→SCHEDULED→PUBLISHED` 또는 `SCHEDULED→DRAFT`. image는 실제 공개 성공 때 PUBLIC이다.

## 7. 권한·트랜잭션·멱등성·재시도

운영자 command는 key·version, scheduler는 system actor·조건부 update를 사용한다. R2 copy는 결정적
key다. 일시 장애는 `SCHEDULED` 상태를 재시도 표지로 사용하고 별도 시도 횟수로 발행을 포기하지 않는다.

## 8. 완료 조건과 수용 기준

기본 슬롯·임의 예약 모두 예약 전 비공개, due 후 1회 공개, 취소 시 비공개, 장애 복구 후 지난 예약
발행, 일시 실패 알림·재시도, 영구 업무 오류의 `DRAFT` 전환·재시도 중단을 확인해야 한다.

## 9. 미정·차단·미검증

기본 슬롯은 `07:30`, `17:30` KST로 확정됐고 per-post 임의 예약도 허용한다. cron·scheduler·알림·
R2·DB·outbox runtime은 미검증이다.
