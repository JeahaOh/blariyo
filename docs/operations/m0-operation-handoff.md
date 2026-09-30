# M0 로컬 구현 이후 운영 인수

상태: **실환경 인수 미실행**. 이 문서는 COL-03·OPS-01~05·CON-01의 입력, 실행 순서와 증거 양식이다.
현재 로컬 구현·시험 결과는 [실행 기록](../../worklog/2026-09-27/m0-implementation/README.md)을 따른다.
로컬 PASS, 서버 설치, 외부 수신, 운영자 수용, 실제 7일 관찰을 각각 기록한다.
로컬 goal의 최종 판정과 검사 결과는 [완료 감사](../../worklog/2026-09-27/m0-implementation/COMPLETION-AUDIT.md)를 따른다. 이 문서의 실제 인수값은 미실행 상태를 유지한다.

## 담당·입력·착수 조건

결정/확정 입력은 [로드맵 결정 목록](../roadmap.md#5-추가로-확정할-항목), 우선순위와 잔여 실행은
[로드맵 시작점](../roadmap.md#1-다음-시작점)을 따른다. 보존 기간·역할·저장 공급자는 재결정하지 않는다.
공용 로컬 준비 도구를 사용할 경우 [권한 정렬 후속](../implementation-tasks/contracts-maintenance.md#로컬-준비-도구-후속--2026-09-27-문서-대조)이 선행된다.
기존 구현 goal의 PASS를 해당 준비 도구·실제 장비까지 통과한 증거로 확대하지 않는다.

| 영역 | 담당 | 실행 직전 필요한 입력 | 현재 상태 |
| --- | --- | --- | --- |
| Core 12건 반복 업무 | 사용자/공동 운영자 | 격리 환경, 시험 콘텐츠, 조작 시간 | 수동 미실행 |
| Access/MFA·권한 | 사용자 | 두 사람의 개별 identity, OWNER/EDITOR, 승인된 비운영 대상 | 실제 계정 미검증 |
| 수집 장비·사설 경로 | 사용자 | 장비/OS, 가동 방식, 비운영 DB/R2 제한 계정과 prefix | (미정) |
| 출처 S1~S5 | 사용자 승인 후 수집 담당 | 선택 source/방식, 승인 설정, UA 연락처, 명시적 일일 한도, 표본 URL | 실제 출처 미검증 |
| 백업/회수 | 사용자만 | Drive 계정 종류/용량/폴더·권한, R2 사본 목록, age 복구키 별도 보관 | 실전송/삭제 미실행 |
| Discord | 사용자만 | bot/guild/channel 제한, 실제 수신 확인 시간 | 채널 생성 사용자 보고 / 실수신 미검증 |
| 고지·법무 | 사용자 | direct 보존/복원 손실 고지, Drive 계약/국외이전 검토 | 기존 출시 차단 유지 |

실값은 운영자의 비공개 설정 파일에 둔다. 토큰·쿠키·JWT·DB 주소/비밀번호·계정 식별값·원문을
Git/작업 기록에 복사하지 않는다. receipt에는 역할명, 안전 ID/hash, 건수, UTC/KST 시각, 결과만 남긴다.
장비·VM 동거·사설 연결 방식은 위 입력이 확정되기 전 추정하지 않는다.

## 인수 순서와 중단 시 조치

1. 대상 담당과 승인 범위를 확인하고 현재 SHA/image digest, API/Collector ledger, feature flag,
   timer와 최근 정상 백업을 읽기 전용으로 조회한다. 과거 운영 기록을 현재 관측값으로 재사용하지 않는다.
2. 수집·검수 쓰기를 정지하고 기존 적용 checksum을 검증한 뒤 additive migration/역할을 설치한다.
   API V009/V010, Collector V007~V010 및 적용 순서는 [Collector 운영 안내](../../apps/collector/ops/README.md)를 따른다.
   운영 설치 권한과 실행 시점은 별도다. API008/Collector006 full 사본의 새 스키마 이행은 로컬 시험으로 검증했다.
3. [선택 백업 runbook](../../deploy/backup/SELECTIVE-RUNBOOK.md)대로 R2 선택 dump의 독립 복원을 먼저 확인한다.
   7일 안의 기존 full snapshot 각각을 같은 snapshotAt/expiresAt의 선택 대체본으로 검증한 뒤 원본을 회수한다.
   기존 정상 R2 경로는 Drive 인수 완료 전 유지한다.
4. [회수 runbook](../../deploy/operations/collect-retention.md)의 dry-run manifest를 검토하고 승인된 비운영
   collect prefix에서 제한 삭제·HEAD/목록·DB readback을 확인한다. content/private/public 사본 hash는 유지돼야 한다.
   복원 후 reconcile과 orphan 회수가 끝나기 전 수집/검수는 재개하지 않는다. quota 손실 방지를 위한 다음 KST 정각 gate도 유지한다.
5. 아래 OPS-01/02/04와 출처별 S1~S5를 수행한다. 승인되지 않은 출처 전체 manifest를 일괄 실행하지 않는다.
   출처 편입은 선택한 source/방식/config hash/SHA/실환경 증거 단위로 판단한다.
6. Drive 병행 전송·독립 다운로드/복원·인증 실패·파기·Discord 수신을 확인한다. 2회 연속 정기 성공과
   배포 직전18시간 안의 복원 receipt가 있어야 사용자만 전환한다. Drive 장애 시 같은 선택 profile로 R2에 복귀한다.
7. Core 운영 시작 이후 실제 날짜로 7일 관찰한다. 수집 전환은 별도 시작 시각과 출처 증거를 연결한다.

권한 경계 위반, 원문 재생성, quota/robots 불확실, 회수 실패 backlog 또는 무결성 불일치가 생기면
새 수집/회수 활성화를 중지하고 Core 수동 운영을 유지한다. 이전 앱은 필요하면 read-only로 제한한다.
원문 복구·영구 dedup 삭제·raw 포함 full dump 복귀·legacy 자동 활성화로 되돌리지 않는다.

## OPS-01/02 — 사람의 조작·실제 인증

- [12건 인수 양식](../testing/operator-acceptance.md)을 사람이 직접 수행한다. 자동 브라우저 12건은
  회귀 증거이며 소요/혼동/재작업을 사람이 확인한 것으로 기입하지 않는다.
- OWNER와 EDITOR 각각 작성·편집·이미지·검수·승격·발행/예약·취소·숨김을 승인 범위에서 확인한다.
- EDITOR의 직접 설정/legacy 변경 API·서버·DB·R2·Drive 접근은 거부돼야 한다. 메뉴가 안 보이는 것만으로 판단하지 않는다.
- client role/service header 위조, Core port 직접 접근을 거부하고, active=false 회수 후 이미 열린 세션의 다음 요청도 거부한다.
  실제 Access 목록 회수도 함께 수행한다. 테스트 계정을 재허용할 때는 기존 개인 계정을 공유하지 않는다.
- 브라우저 HTML/API/네트워크에 storage credential이나 operator identity 원문이 없는지 확인한다.

| 역할 | 콘텐츠 작업 | 설정/관리 자원 거부 | 기존 세션 회수 | MFA 관측 시각 | 결과/근거 |
| --- | --- | --- | --- | --- | --- |
| OWNER | 미실행 | 역할별 허용 범위 대조 미실행 | 미실행 | (미정) | 미검증 |
| EDITOR | 미실행 | 미실행 | 미실행 | (미정) | 미검증 |

## COL-03 — 출처별 S1~S5 영수증

[출처 정책](../planning/content-collection/source-collection-policy.md#m0-admission)과
[현재 증거표](../planning/content-collection/reference-site-validation.md#m0-evidence-20260926)를 따른다.
21개 adapter·과거17개 개발 저장은 현재 운영 편입 증거가 아니다. COL-REANALYZE-01의 세 출처와
PGR21은 기존 보류를 유지한다. 로그인/CAPTCHA/차단 우회는 하지 않는다.

`--dry-run`도 외부 요청과 영속 quota 기록을 수행한다. 콘텐츠/object 무저장이라는 뜻이며 단순 조회로
취급하지 않는다. 실제 source 요청은 별도 승인 후 [batch 명령·readback 도구](../../apps/collector/ops/README.md)의
선택된 표본만 사용한다. 실행 로그/일반 backup에 원문을 복제하지 않는다.

| 항목 | 기록할 관측값 | 통과 기준 | 결과 |
| --- | --- | --- | --- |
| 기준 | source/방식/SHA/config hash, 장비, UTC/KST 시각, 담당 | 현재 실행의 조합 식별 가능 | 미실행 |
| S1 허용/통제 | 승인 근거, robots/UA, 간격·일일 한도, redirect/DNS/차단 결과 | 금지/미확인 목적지0, 실제 간격/누적 제한 충족 | 미실행 |
| S2 발견/원문 | 목록→상세 연결 또는 승인된 DETAIL_ONLY URL, since/skip | 실제 원문을 같은 실행으로 확인 | 미실행 |
| S3 내용 보존 | 문단/블록 순서·미디어·첨부·외부 링크/SNS 종류/수량 대조 | 누락0, 한도 초과 절단 저장0; 없는 종류는 N/A 근거 | 미실행 |
| S4 저장/복구 | run/item ID, DB/object GET bytes/hash/size, 실패·중복·재시작 | 제한 계정으로 실제 저장 readback, 미승인 공개0 | 미실행 |
| S5 운영 수용 | 장비/권한, 보존·선택복원/고지, 검수 조작, 수집/장애 알림 | 운영자 수용과 실수신, 입력·기록 누락 없음 | 미실행 |
| 편입 판단 | 통과 또는 제외/보류 사유, 담당·시각 | S1~S5 모두 현재 증거 연결 | 후보 유지 |

## OPS-03/04 — 장애·복원·장비·Discord

- 백업 D03-T1~T6: 폴더 밖 파일 거부, 업로드 중단/응답 유실/같은 ID 재개, 인증 갱신·401·권한 회수·429·용량 부족,
  snapshot+7일 정각 파기와 타 파일 보호, hash 오염/빈 격리 DB 독립 복원, R2 유지→Drive→R2 복귀를 분리한다.
  실패한 새 백업 때문에 이전 사본 기한을 연장하지 않는다. 만료 삭제 timer와 알림 timer도 별도로 관측한다.
- mailbox/queue: 장비 종료 전/후 requestId와 version, 재시작 중복 queue0, 60초 lease의 늦은 ack 거부,
  대기24시간 만료·URL 제거, runtime CURRENT/STALE/CONFLICT를 확인한다. API/Web 외부 원문 fetch는0이다.
- Discord: 같은 interaction 재전송1건만 접수, 확인 전 취소·10분 만료 후 URL/actor/channel 제거,
  비허용 사용자/채널 거부, 연결 중단·재시작을 확인한다. 내부 성공 receipt와 실제 사용자 수신을 따로 적는다.
- 전용 계정: API의 batch queue DML 거부, batch의 content/검수 쓰기 거부, retention의 content/public/private 삭제 거부,
  backup의 쓰기 거부와 R2/Drive 범위 밖 접근 거부를 실제 비운영 자원에서 확인한다.
- 예약/취소와 outbox 장애 복구에서 중복 공개0·취소 글 공개0, 안전한 경보 실수신·회복1회를 기록한다.

| 시나리오/시험 ID | 시작/종료 시각 | 대상 안전 ID·SHA/hash | 기대/실제 결과 | 복구/남은 입력 | 담당 |
| --- | --- | --- | --- | --- | --- |
| D03-T1~T6 각 행으로 기록 | (미정) | (미정) | 미실행 | 계정·시험 영역 | 사용자 |
| mailbox/장비/서비스 권한 | (미정) | (미정) | 미실행 | 장비·사설 경로 | 사용자 |
| Discord 취소/만료/중복/실수신 | (미정) | (미정) | 미실행 | 실제 채널 | 사용자 |
| 예약/outbox/복귀 | (미정) | (미정) | 미실행 | 승인 콘텐츠 | 사용자 |

## OPS-05 — Core 실제 7일 관찰

시작일/담당: **(미정)**. 실제 Core 운영 시작 이후의 연속 관찰이며 테스트 시계 전진이나 합성 결과를 입력하지 않는다.
수집 전환은 [별도 관찰표](collector-transition-observation.md)에 같은 날의 source/config 근거를 연결한다.

| 일 | 실제 날짜·관측 시각·담당 | 게시/예약/취소·오류·복구 | 최근 백업 나이·hash/복원·파기 지연 | DB/object 용량·회수 backlog | 알림 실수신·권리 요청 처리 | 장애/조치·근거 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |
| 2 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |
| 3 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |
| 4 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |
| 5 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |
| 6 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |
| 7 | (미정) | 미실행 | 미실행 | 미실행 | 미실행 | (미정) |

실제 7일과 미해결 장애 조치/수용이 기록된 뒤에만 OPS-05를 닫는다. 최신 정상 백업18시간 초과,
파기 지연, 중복 공개, 권한/보존 위반은 별도 장애로 남긴다. 운영 인수 판단: **미검증**.

## CON-01 조건부 인계

legacy는 비활성 유지한다. DTO/DB 상한1000과 웹40 차이·MIME·auth/readiness·저장 시험은
[계약 유지보수 task](../implementation-tasks/contracts-maintenance.md)의 재활성화 결정 이후 별도 범위다.
direct mailbox/역할/보존 변경을 legacy 재활성화 승인으로 해석하지 않는다.
