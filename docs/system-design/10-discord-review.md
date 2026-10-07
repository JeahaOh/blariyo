# Discord 수집 검수 기술 계약

제품 기준은 [수집 기획 §8](../planning/content-collection/README.md#8-discord-보고실행-연동)이다.
이 문서는 구현 계약이며 실제 실행 상태는 [구현 기록](../../worklog/2026-10-07/discord-review-implementation/README.md)에서 확인한다.

## 소유권과 실행 경계

- API는 공통 검수 결정·본문 선택·초안/발행·영속 작업 상태를 소유한다. Collector의 content 테이블 쓰기 권한을 늘리지 않는다.
- BATCH는 전용 REST CLI로 export/scan/maintain을 수행한다. 수집과 검수 lock을 분리한다. 기존 Gateway·slash command와 별도 기능 flag를 사용한다.
- 관리자 결정은 같은 item의 decision epoch를 증가시키고 미완료 Discord 명령을 취소한다. 실제 초안/발행 commit에서 epoch·버전·내용 digest·실행자 권한을 다시 확인한다. 일반 게시글 publish 경로에서도 반려된 수집 초안 발행을 막는다.
- Discord 사용자와 내부 active OWNER/EDITOR operator를 명시적으로 연결한다. 수집 allowlist와 발행 권한을 혼용하지 않는다. 서비스 인증과 사용자 업무 권한은 별도 검증한다.
- API의 공통 문장 분리/manifest가 원본 block·문자 offset·이미지 position과 unit ID를 고정한다. BATCH는 이를 렌더하며 재분리하지 않는다. 긴 문장의 조각은 같은 unit의 제외 여부를 공유한다. 최종 selection digest는 원본 digest·단위 목록·renderer version에 바인딩한다.

## 영속 상태

| API 소유 테이블 | 역할 |
| --- | --- |
| `collect.batch_review_control` | item별 authority·decision epoch·active command |
| `collect.discord_review_delivery` | 환경·원본 snapshot·head/thread·준비/만료·lease·삭제/안내 상태 |
| `collect.discord_review_part` | unit/fragment·메시지 ID·전송/기본 반응·응답 불명확 복구 표식 |
| `collect.batch_review_command` | 결정과 actor·버전·반응 증거·선택·멱등 key·단계별 결과·post ID |
| `collect.discord_review_scan_run` | 환경/정시 slot별 cutoff·cursor·lease·완료 여부 |

신규5표는 선택 백업에서 복구 대상으로 보존한다. delivery manifest는 unit ID·kind·원본 offset·hash만 저장하며 본문 text/binary와 저장 key를 복제하지 않는다. 명령에는 원본 본문 대신 digest·제외 ID·운영자 지정 제목/board·최소 반응 증거를 저장한다. 복원 시 원문이 없으면 업무 실행을 중단하고 메시지 cleanup을 이어간다.

기존 `batch_review`와 게시글이 업무 결과 정본이다. 무승인은 결과를 덮어쓰지 않는다. 삭제 대상 ID는 원문 retention 삭제의 cascade로 잃지 않는다. 작업 claim/ack는 짧은 transaction이며 lease token과 attempt ID로 중복 ACK를 제거한다.

## 작업 API와 정시 처리

- `/internal/discord-review/v1` 아래 claim·delivery ACK/media·scan 시작/목록/관찰/완료·command 실행/조회 경로를 둔다. 고정 내부 API origin만 사용하고 공개 edge에서 차단한다. worker 전용 인증·기능 flag·작업 scope를 확인한다.
- 관리자 공통 command는 `/api/v1/admin/collect/batch-items/:id/commands`로 전달한다. 기존 item/snapshot/lock 검증을 유지하고 관리자 상세에서 최종 선택 내용과 업무/삭제 상태를 구분한다. 연결된 미발행 DRAFT를 재승인할 때는 실제 postVersion을 추가로 검증하고 기존 초안을 재사용하며, 반려해도 연결 ID를 보존한다.
- 정기 scan은07:30/17:00 KST, maintenance는1분 간격이다. maintenance는 정시 slot의 누락·중단만 재개하며 완료 slot을 다시 판정하지 않는다. export·이미 접수된 명령·cleanup/notice도 복구한다. 배포 초기 cutoff 이전 데이터는 자동 소급 전송하지 않는다.
- readyAt은 헤드·모든 조각·기본 반응 전송 완료 뒤 설정한다. 준비 전에 누른 헤드 반응은 READY 직전 제거/조회 완료가 확인되어야 한다. 만료는 readyAt+48시간이다.
- 각 scan은 cutoff와 `(ready_at,id)` cursor를 고정한다. 누락 회차 복구는 현재 반응을 확인하며 과거 반응 시점 복원을 주장하지 않는다. 정상/강화 반응의 모든 사용자 페이지를 읽고 누락·읽기 실패·120초 초과 관찰은 재조회한다.
- 등록 검수자 반응만 판정한다. 헤드 두 반응/무반응은 재확인, 만료 후에도 현재👍단독이면 승인한다. 본문 전체 제외는 NEEDS_ADMIN으로 남겨 자동 발행/무승인 만료 반려를 막는다.
- 선정된 이미지에만 hash/크기 검증·업로드를 적용하며 원본 R2 object를 부분 제외 때문에 지우지 않는다.

## transaction 밖의 비동기 삭제

- 관리자 결정과 삭제 PENDING outbox는 같은 transaction으로 저장한다. Discord 승인 명령은 발행 완료 후, 반려 명령은 반려 확정 후 등록한다.
- 최상위 commit 성공 이후 모든 session advisory lock과 QueryRunner가 반환된 시점에 task ID만 실행기에 전달한다. rollback·commit 불명확 시 즉시 알림을 하지 않는다. 영속 PENDING은 maintenance가 복구한다.
- 메모리 알림은 빠른 시작 수단이다. 동시 실행1개·제한 큐·shutdown drain을 적용하고 큐 포화/종료에서 작업을 잃었다고 업무 결정을 반복하지 않는다.
- 실행기는 짧은 claim transaction을 종료한 후 Discord HTTP를 호출하고, 별도 ACK transaction으로 결과를 기록한다. 외부 HTTP 동안 DB transaction·연결·행/세션 잠금을 점유하지 않는다. 관리자 응답은 Discord HTTP를 기다리지 않는다.
- 헤드→스레드 순서로 삭제하고 헤드 실패 시 스레드를 보존한다. 정상적인 not-found는 멱등 성공으로 간주한다. 초기 시도 외부 HTTP 총 상한3초, 재시도1/5/15분 이후15분과 jitter; 더 긴 Retry-After 우선.401/403은 BLOCKED다.
- API 최초 시도와 BATCH 재시도는 같은 lease·attempt·실패 카운터를 사용한다. 실패2회부터 최신 승인/반려·발행 결과 안내1건을 스레드에 남기고 갱신한다. 안내 실패 카운터와 재시도 시각은 cleanup과 분리한다. 접근 불가/삭제된 스레드는 관리자 경고로 남긴다.
- 전송 중 관리자 선점이면 새 전송을 막고 늦게 도착한 ACK의 메시지 ID는 cleanup에만 수용한다. 미확인 전송이 남으면 cleanup을 DONE으로 닫지 않는다. 응답 유실 시 nonce/표식으로 찾고 중복 여부 불명확 시 BLOCKED로 남긴다.
- API/worker에 필요한 token만 비공개 mount한다. 로그에 token·본문 binary·저장 key를 남기지 않는다. 환경과 channel을 고정하고 intake JSON은 런타임 설정으로 자동 소비하지 않는다.

## 검증 기준

- 반응 조합·등록/회수·전체 제외·긴 문장·페이지 누락·만료 직전/직후·다음 회차 재확인.
- 관리자 선점이 관찰·이미지 준비·초안 이후·발행 commit 직전에 발생하는 경합과 일반 publish 우회 차단.
- 동일 명령·응답 유실·중복 ACK·프로세스 종료에도 초안/발행1회. 삭제 재시도에서 업무 실행0회.
- rollback 시 외부 호출0회, 중첩 commit·잠금 반환 이전 호출0회, 느린 Discord와 응답 분리, 종료/큐 포화 후 DB 복구.
- 실제 Discord 쓰기/삭제, 로컬 DB/브라우저, 운영 배포/검수, 실제48시간 관찰을 합성 시계 시험과 구분한다.
