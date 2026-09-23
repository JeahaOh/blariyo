# 최종 확정 전 최대 보완 주 검수

- 날짜: 2026-09-08
- 상태: R01~R10 보완·주 검수 완료, 추가 발견 해소
- 범위: M0 Core·M0 수집 보조·M1·M1.5의 정본, 기능 명세, 현행 상태 색인과 정적 정책 검토물
- 제외: 애플리케이션 source·migration·OpenAPI 구현, 실제 PostgreSQL·provider·외부 출처·Discord 실행,
  법률 자문, 운영 실값 입력, commit·push·merge·tag·배포

## 현재 결론

R01~R10에서 지적한 계약을 정본과 검토물에 반영했고 주 에이전트가 원문·diff·오프라인/화면 증거를
직접 재검수했다. R03~R07의 Spring 상세 설계와 상위 수집 계약, 추가 교차 검토의 redirect host 충돌,
cutover 제약 적용 순서, server 시각·replay, FK, refresh version 전달과 기존 DTO 보존까지 수정·확인했다.
[collector 결과](collector-result.md)의 설계 보완안을 반영해 시스템 README와 현행 상태 색인도 최신
판정으로 맞췄다.

이 판정은 설계 기준선 후보에 대한 문서 검수다. 구현 수용과 production 공개 승인은 별도이며,
[현행 설계 준비 상태](../../../docs/system-design/design-readiness.md)의 세 상태를 한 완료 상태로 합치지 않는다.

## R01~R10 반영·검수 매핑

| ID | 반영 상태 | 주요 근거 | 검수와 남은 경계 |
| --- | --- | --- | --- |
| R01 제재 ACTIVE 판정 | 완료·주 검수 | [06 회원·익게 설계](../../../docs/system-design/06-member-community-design.md)의 `전이·잠금·정리`와 `신고·운영` 절, M1.5 참여·moderation 명세에 `status=ACTIVE`, 시작·종료 시각을 모두 포함한 동일 predicate를 반영했다. | 주 에이전트가 REVOKED 무기한·미래 종료, 만료 ACTIVE, 시작 전 ACTIVE를 포함한 오프라인 6건을 재실행해 통과했다. 실제 Core/DB 경쟁 시험은 미검증이다. |
| R02 Unicode 길이 | 완료·주 검수 | [06 회원·익게 설계의 API 공통 계약](../../../docs/system-design/06-member-community-design.md#api)에 잘못된 scalar·U+0000 거부→줄바꿈 통일/거부→C0/C1 검사→NFC→ECMAScript trim→code point 계산 순서와 UI/API/DB 계약을 고정했다. M1/M1.5 네 기능 명세도 같은 순서를 참조한다. | 주 에이전트 재실행에서 Unicode 35건을 통과했고 Node 오프라인 6건도 통과했다. 실제 browser UI counter와 PostgreSQL 18 CHECK는 미검증이다. |
| R03 preview 응답 유실 | 완료·주 검수 | [07 Spring 상세 설계](../../../docs/system-design/07-spring-collector-design.md)의 §5·§9·§10에 2xx 7일 replay, file/result digest, execution-state 조정, 이미지별 checkpoint와 24시간 local temp 경계를 반영했다. | §15 설계 수용 시험이 있다. process kill·R2·Core integration 실행은 미검증이다. |
| R04 `/collect status` | 완료·주 검수 | [07 Spring 상세 설계](../../../docs/system-design/07-spring-collector-design.md)의 §5.2·§5.3·§13에 local/Core 원천 분리, 읽기 scope, partial·stale, 조회가 claim을 만들지 않는 계약을 반영했다. | Core/BFF OpenAPI·권한 음성 시험·Discord 실제 응답은 미검증이다. |
| R05 quota 권위 | 완료·주 검수 | [07 Spring 상세 설계](../../../docs/system-design/07-spring-collector-design.md)의 §6.2·§7에 Core budget/reservation, `Asia/Seoul` 날짜, 10초 permit, 전역 `next_request_at`, 실제 HTTP 시도별 차감과 응답 유실 규칙을 반영했다. | 동시 100개·자정·crash·network 시작 뒤 응답 유실 시험은 설계 수용 조건이며 아직 실행하지 않았다. |
| R06 lease 회수 | 완료·주 검수 | [07 Spring 상세 설계](../../../docs/system-design/07-spring-collector-design.md)의 §8에 lease 300초, heartbeat 60초, attempt 3회 미만·요청 후 24시간 미만의 직접 재선점, 초과 시 FETCH_FAILED, 운영자 retry만 PENDING 복귀를 반영했다. | 실제 clock·DB lock·stale worker fencing 시험은 미검증이다. |
| R07 Spring 구현 기준선 | 완료·주 검수 | [07 Spring 상세 설계](../../../docs/system-design/07-spring-collector-design.md)의 §1·§2·§11~§14에 `apps/collector`, 전용 PostgreSQL 18, Batch/Quartz/REST·Discord, Keychain, launchd, 알림과 cutover/rollback을 정했다. [인프라](../../../docs/system-design/04-infrastructure-design.md)의 `로컬 Spring 수집 서버 배치 경계`와 [보안·운영](../../../docs/system-design/05-security-operations.md)의 `Spring 수집 전환의 보안·운영 조건`도 07을 따라 최소 동기화했다. | 04/05 추가 수정 전 사본은 `/private/tmp/blariyo-final-policy-spring-sync-before-20260908/04-05-before.tar`다. source·runtime과 실제 외부 연동은 미검증이다. |
| R08 법무 차단 색인 | 완료·주 검수 | [법무 출시 차단 색인](../../../docs/legal/README.md#출시-차단-항목)에 M0 요청 처리·권리 이메일/고지/3년, M1 탈퇴 ledger 8주, M1.5 신고 90일과 단계별 실값·법무 조건을 분리했다. | 법무 문서 6개를 수정 전 tar와 대조해 placeholder가 전후 동일함을 확인했다. 약관 1개는 이미 확정한 제품 정책을 다시 미정 취급하지 않도록 법무 검토·M1.5 시행일로 범위만 좁혔다. 법무 적정성은 확정하지 않았다. |
| R09 세 상태 분리 | 완료·주 검수 | [현행 설계 준비 상태](../../../docs/system-design/design-readiness.md)의 `현재 판정`·`상태 변경 규칙`이 설계 기준선·구현 수용·production 공개 승인을 분리하고, 과거 `member-readiness-review`를 현행 판정으로 사용하지 않는다. | `조건부 확정 가능`은 별도 기준선 분리·tag·merge 완료가 아니다. M0 수집 보조도 구현·활성화와 분리했다. |
| R10 정적 정책 modal | 완료·주 검수 | [responsive app.js](../../../docs/ui/publishing/responsive/app.js)의 `policyPreviewBody()`·`renderPolicyDocument()`에서 현재 개인정보 본문, Apple refresh credential 예외, 가상 과거 본문 전환과 전환 후 dialog focus를 반영했다. | Playwright 1280×900·390×844와 별도 desktop CUA에서 `현재 보기→이전 보기 예시 A`, 본문 전환, dialog focus를 확인했다. 모바일 full-page·실제 390×844 viewport 이미지에서 예시 B와 닫기 접근도 확인했다. 실제 정책 발행/API/법무 증거는 아니다. |

추가 교차 검토에서 07의 CDN·redirect host 문구가 상위 same-host 계약과 충돌했으나,
[07 Spring 상세 설계](../../../docs/system-design/07-spring-collector-design.md)의 §7을 원래 source와 같은 host만
허용하도록 수정했다. 이 발견을 별도 미해결 R 항목으로 남기지 않는다.

## 직접 검증 기록

- 주 에이전트가 `check-member-design.py`를 직접 재실행해 이름 262,144조합·최대 19 code point·명시
  금칙어 일치 0건, Unicode 35건, 제재 6건, 연령·SQLite 제약 21건 통과를 확인했다. 이는
  `offline_design_model_not_implementation`이며 사람에 의한 전체 이름 적정성이나 PostgreSQL/provider 검증이 아니다.
- R02 별도 Node 검사는 `isWellFormed()`·NFC·ECMAScript trim·`Array.from`의 한글 NFC, emoji, ZWJ,
  결합문자, FEFF, 단독 surrogate 6건을 통과했다.
- 법무 수정 전 사본 `/private/tmp/blariyo-final-policy-before-20260908/owned-files.tar`와 현재 법무 문서
  6개를 대조해 placeholder가 파일별로 전후 동일함을 주 에이전트가 확인했다. 운영자·담당자·이메일·시행일·
  수탁자·법무 판단을 채우지 않았다.
- 작업 전 SHA inventory를 현재와 대조해 기존 문서 23개 변경, 신규 정본 2개와 승인된 task 산출물,
  삭제 0개, 승인 영역 밖 변경 0개임을 확인했다. 기존 사용자 변경은 보존했다.
- R10은 `node --check`, Playwright 정책 검사와 CUA 접근성 트리 검수를 통과했다. 증거와 이미지 경로는
  [R10 결과의 실행 검증](visual-result.md#실행-검증)에 있다.
- Spring 오프라인 불변조건 모델은 중복 reservation, stale execution, preview 응답 유실, attempt 3 경계,
  7일 만료 경계 5건을 통과했다. 애플리케이션 테스트는 아니다.
- 최종 상태 동기화 뒤 재실행한 구조 검사는 Markdown 73개·상대 링크 700개·표 358개, 오류 0건이며
  `git diff --check`도 통과했다.

## 완료·미검증 책임 분리

| 구분 | 현재 판정 |
| --- | --- |
| AI가 설계한 항목 | R01~R10의 제품·기술 계약, 수용 시나리오, 법무 blocker 색인과 정적 검토물 보완을 반영하고 주 검수를 마쳤다. |
| 사용자·운영자 실값 | 운영자·담당자·접수 이메일, 시행일, provider/Discord 앱·계정, 수탁자, 설치 경로와 운영 책임자는 미입력이다. |
| 외부 검증 | 연령 확인·보존·권리 요청·국외이전·약관의 법무 적정성, 실제 수집 출처·robots·이용 조건과 provider 계약은 미검증이다. |
| 구현 수용 | source·migration·OpenAPI·build·PostgreSQL·Core/BFF·provider·R2·Batch/Quartz·복구/장애 시험은 수행하지 않았다. |
| production 공개 승인 | 법무 색인의 해당 단계 조건, 운영 실값, 실계정, 복구 훈련과 실제 runtime 증거가 없어 승인하지 않았다. |

## 다음 단계

1. 조건부 설계 기준선을 실제로 분리·tag·merge하려면 별도 작업으로 실행한다. 이번 작업에서는 수행하지 않았다.
2. source·migration·OpenAPI·test·build·runtime 증거를 확보한 뒤 단계별 구현 수용을 판정한다.
3. 운영 실값·실계정·법무·복구 훈련을 충족한 기능만 production 공개 승인한다.
