# M0·Spring 수집 최종 확정 준비 검토

- 검토일: 2026-09-08
- 검토 성격: 정본 수정 없는 읽기 전용 감사
- 판정 기준: 보완된 현재 정본과 Spring 전환 인계 문서
- 범위: `docs/planning/content-collection/README.md`, `docs/planning/01-service-plan.md`, `docs/system-design/README.md`, `docs/system-design/01~05`, `collection-assist.dev.md`, Spring collector 인계 문서
- 심각도 기준: `High`는 **M0 수집 보조 상세 설계 확정 또는 기능 활성화**를 막는 항목이다. 별도 근거가 없는 한 `M0 Core` 공개 차단을 뜻하지 않는다.

## 결론

수집 의존성 관점에서 `M0 Core`와 수집 단계는 분리 확정할 수 있다. 기획은 첫 공개 필수 범위를 `M0 Core`로 두고 수집 보조·자동 수집을 독립 활성화 단계로 분리하며(`docs/planning/content-collection/README.md:42-50`), 관련 운영 실값이 미정이어도 Core 개발·공개를 진행할 수 있다고 명시한다(`docs/planning/content-collection/README.md:371-386`). 기술 계약도 `M0 Core`에서는 collector 중계와 내부 route를 등록하지 않는다(`docs/system-design/03-api-design.md:480-482`). 따라서 **다른 영역의 Core 차단 조건이 충족된다는 전제에서**, 수집 상세 미정만으로 Core 확정을 미룰 이유는 없다.

Spring 전환의 상위 방향도 확정 가능하다. 운영자 로컬 Spring Boot, Spring Batch, Quartz, REST·Discord 공통 실행 경로, Java 추출, 기존 BFF/Core API 경유, 서비스 DB·object storage 직접 쓰기 금지, 공개 서비스 독립성은 문서 간 일치한다(`docs/system-design/01-system-architecture.md:371-413`, `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:1051-1060`, 인계 문서 `2026-09-08-spring-collector-design-handoff.md:24-32`). Python 병행을 기본안으로 되돌리거나 목록 자동 발견·자동 발행을 포함할 근거는 없다.

반면 **M0 수집 보조의 구현 상세는 아직 최종 확정할 수 없다.** 아래 C01·C02는 현재 제품 요구와 API 계약 사이의 실제 공백이고, C03~C08은 미정 자체가 오류는 아니지만 구현 전에 수용 조건까지 설계해야 하는 작업이다. 운영값이나 새 API를 이 검토에서 임의로 확정하지 않았다.

아래 `사용자 실값`에 함께 적은 조회 기간·재시도·보존·코드 위치·버전 등의 기술 기본값은 AI가 근거와 권장안을 제시해 설계할 수 있다. 실제 연락처·계정·접속 허용 범위·운영 책임처럼 저장소에서 알 수 없는 외부 사실만 사용자 입력이 필요하며, 정본과 구현에 실제 적용하는 작업은 후속 변경 권한 범위에서 수행한다.

## 핵심 발견과 설계 작업

### C01. `/collect status`의 제품 범위를 충족할 조회 계약이 없다

- 중요도·구분: **High / 확정 계약 공백**
- 양쪽 근거:
  - 제품은 `/collect status`가 최근 Job, 대기 후보, 실패·비활성 출처를 읽기 전용으로 요약하도록 요구한다(`docs/planning/content-collection/README.md:267-272`).
  - collector용 계약은 후보 접수·claim·heartbeat·result·preview의 5개 endpoint뿐이다(`docs/system-design/03-api-design.md:484-490`, `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:146-154`). collector token으로 관리자 API를 호출할 수도 없다(`collection-assist.dev.md:156-164`).
  - 개발 명세는 조회 원천·응답 형식·보존 기간이 미정이라고 적는다(`collection-assist.dev.md:941-945`, `collection-assist.dev.md:975-985`). 아키텍처도 기존 API에 없는 조회 기능을 가정하지 말라고 한다(`docs/system-design/01-system-architecture.md:408-411`).
- 영향: 로컬 Batch 메타데이터만으로는 Core의 대기 후보·실패 후보·비활성 출처를 알 수 없다. 현재 권한과 API를 그대로 구현하면 명령의 일부를 추측하거나 관리자 자격을 수집기에 주어야 하므로 제품 범위 또는 보안 경계를 위반한다.
- 최소 조치: `status` 각 필드의 권위 원천과 읽기 권한을 먼저 결정하고, 기존 API를 유지하면서 필요한 추가 읽기 계약 또는 제품 범위 조정을 별도 변경안으로 작성한다.
- 설계 수용 조건:
  1. 명령은 새 Job이나 후보 상태 변경을 일으키지 않는다.
  2. 로컬 Job 상태와 Core 후보·출처 상태가 한 응답에서 혼동되지 않도록 원천·기준 시각·지연 상태를 표시한다.
  3. Core 또는 Discord 장애 시 전체 정상으로 오인하지 않고 부분 실패를 표시한다.
  4. 원문 URL·후보 제목·사용자 원시 ID·secret·stack을 응답이나 로그에 싣지 않는다.
  5. collector 권한으로 관리자 command를 호출할 수 없다는 현재 경계를 유지한다.
- 결정 역할:
  - AI 설계: 로컬 집계와 Core 읽기 계약 대안, 응답·오류·권한·저하 모드 초안.
  - 사용자 실값: 조회 기간·최대 건수, 이력 보존 기간, 조회 허용 운영자 역할.
  - 외부 검증: Core/BFF contract test, 권한 음성 테스트, Discord 실제 응답과 장애 모드.

### C02. preview 업로드의 응답 유실 복구와 로컬 임시 파일 수명주기가 닫히지 않았다

- 중요도·구분: **High / 확정 복구 공백 + 일부 수명주기 의심**
- 양쪽 근거:
  - 접수·result만 `Idempotency-Key` 대상이고, result는 응답 유실 때 같은 key로 결과를 재확인할 수 있다(`collection-assist.dev.md:156-163`, `collection-assist.dev.md:240-245`).
  - preview는 매 성공마다 후보 version을 증가시키고 복수 이미지는 새 version으로 순차 업로드한다. preview 자체의 멱등 key나 collector용 현재 상태 조회는 없다(`collection-assist.dev.md:247-260`, `docs/system-design/03-api-design.md:492-499`).
  - 전환 계약은 응답 유실·중간 종료 복구를 수용 조건으로 요구한다(`docs/system-design/01-system-architecture.md:408-411`, `collection-assist.dev.md:1064-1071`).
  - 로컬 임시 파일은 반려·만료·재시도 교체 때 삭제 대상이지만(`docs/planning/content-collection/README.md:427-430`, `docs/system-design/02-data-model.md:741-748`), 원격 상태 변화를 로컬 collector가 관측하는 경로는 정해지지 않았다. 서버 private preview의 24시간 TTL·cleanup은 별도 계약이 있으므로(`collection-assist.dev.md:254-261`) 이 둘을 같은 결함으로 보아서는 안 된다.
- 영향: preview가 Core에 반영된 뒤 HTTP 응답만 유실되면 재전송은 이전 `lockVersion`으로 충돌할 수 있다. 첫 이미지의 성공 여부와 최신 version을 모르면 뒤 이미지도 안전하게 이어갈 수 없다. 로컬 파일을 원격 반려·승격까지 보관하는 안을 택하면 삭제 신호 부재로 잔존 파일이 생길 수 있다.
- 최소 조치: preview 업로드의 멱등 재전송 또는 상태 재확인 중 하나 이상을 계약하고, 이미지별 checkpoint와 로컬 파일 삭제 기준을 같은 설계에서 닫는다. 서버 24시간 private staging과 로컬 작업 파일의 수명주기를 분리해 쓴다.
- 설계 수용 조건:
  1. object·DB commit 뒤 응답 유실 시 같은 이미지와 payload의 재시도가 중복 object나 추가 version 증가 없이 기존 성공을 확인한다.
  2. 다른 파일을 같은 재시도 식별자로 보내면 충돌하며 기존 preview를 바꾸지 않는다.
  3. 여러 이미지 중 일부 성공 뒤 종료해도 마지막 확정 이미지 다음부터 이어가고, 이미 성공한 이미지를 다시 만들지 않는다.
  4. 반려·재시도·승격과 업로드가 경합하면 고아 object를 보상 삭제하고 terminal 후보를 되돌리지 않는다.
  5. 로컬 파일은 삭제 가능 시점과 crash 후 TTL 청소가 정해져 원격 이벤트를 영구 대기하지 않는다.
- 결정 역할:
  - AI 설계: 멱등 key·파일 digest·재확인 대안, 이미지 checkpoint, race·cleanup 상태표.
  - 사용자 실값: 로컬 파일 최대 보존 시간과 디스크 상한.
  - 외부 검증: 응답 강제 유실, 부분 업로드 종료, 반려·승격 동시성, R2 장애·orphan cleanup 통합 테스트.

### C03. 출처별 quota의 단일 권위와 원자적 예약 규칙이 없다

- 중요도·구분: **High / 확정 책임 공백, 저장 기술은 정상 미정**
- 양쪽 근거:
  - Core가 요청 상한 기록을 책임지고(`docs/system-design/01-system-architecture.md:176-178`), 시스템 요약은 BE가 요청 상한 결과를 검증한다고 적는다(`docs/system-design/README.md:74-77`).
  - `collect.source`에는 최소 간격·일일 상한·최근 요청 시각만 있고 일일 사용량이나 예약 상태는 없다(`docs/system-design/02-data-model.md:624-645`).
  - claim은 이 설정값을 collector에 반환하고 collector가 fetch 직전 다시 검증하도록 한다(`collection-assist.dev.md:183-198`). Spring의 지속 quota 저장·잠금·날짜 경계는 명시적으로 미정이다(`docs/system-design/01-system-architecture.md:412-426`, `docs/system-design/02-data-model.md:954-960`).
- 영향: Quartz·REST·Discord 실행이나 여러 Job이 겹치면 각 실행이 같은 남은 quota를 보고 동시에 외부 요청할 수 있다. 재시작, 날짜 경계, 응답 유실에서 카운터가 줄거나 중복 차감되면 일일 상한을 실제로 보장할 수 없다.
- 최소 조치: 서비스 DB 직접 쓰기 금지를 유지하면서, fetch 전에 한 곳에서 요청 권한을 원자적으로 예약하고 요청 발생 여부에 따라 확정·해제하는 권위 계약을 설계한다. 저장 제품·테이블·시간대는 이 검토에서 고르지 않는다.
- 설계 수용 조건:
  1. 모든 진입점과 동시 Job이 같은 출처별 interval·daily budget을 사용한다.
  2. fetch 전에 원자적으로 예약하며 같은 예약의 재시도는 중복 차감하지 않는다.
  3. DNS 연결 전 실패, 요청 전 crash, 요청 송신 후 응답 유실을 서로 다른 차감 규칙으로 판정한다.
  4. 프로세스·PC 재시작과 날짜 경계에서도 사용량이 초기화되거나 이중 계산되지 않는다.
  5. lease 재선점이 동일 원격 요청을 반복할 때 quota와 중복 fetch 위험을 함께 검증한다.
- 결정 역할:
  - AI 설계: 단일 권위 후보 비교, reserve/commit/release 상태와 잠금·복구 알고리즘, migration/API 변경안.
  - 사용자 실값: 출처별 interval·daily limit, 기준 시간대, 운영 예외 승인 절차.
  - 외부 검증: 병렬·재시작·자정 경계 fault test와 실제 출처 정책 확인.

### C04. 만료 lease의 두 회수 경로에 우선순위와 시도 한계가 없다

- 중요도·구분: **Medium / 확정 모호성, 상호 배타적 모순으로 단정하지 않음**
- 양쪽 근거:
  - 데이터 모델은 만료 `RUNNING`을 `PENDING`으로 회수하거나 운영자 확인이 필요한 `FETCH_FAILED`로 전환한다고 한다(`docs/system-design/02-data-model.md:741-745`). 24시간 미완료 정리도 두 결과를 모두 허용한다(`docs/system-design/02-data-model.md:892-900`).
  - claim API는 60~900초 lease가 만료된 `RUNNING`을 직접 다시 선점한다(`collection-assist.dev.md:183-198`, `docs/system-design/03-api-design.md:486-490`). 두 경로는 공존할 수 있지만 어느 시점에 누가 어떤 결과를 택하는지 없다.
- 영향: 짧은 lease 재선점과 24시간 정리 작업이 같은 후보를 다르게 처리할 수 있다. 무제한 재선점, 늦은 heartbeat/result 충돌, 반복 외부 요청과 알림 폭주가 구현마다 달라진다.
- 최소 조치: 직접 재선점, `PENDING` 회수, `FETCH_FAILED` 전환의 실행 주체·우선순위·attempt/시간 경계를 하나의 상태표로 확정한다.
- 설계 수용 조건:
  1. 만료 시각 전후의 claim·heartbeat·result 경합 결과가 결정적이다.
  2. stale collector의 heartbeat/result는 새 소유자의 상태나 이미지에 부수 효과를 남기지 않는다.
  3. 재선점 횟수 또는 경과 시간이 한계를 넘으면 운영자 확인 상태로 끝나며 무한 반복하지 않는다.
  4. 정상 shutdown, 강제 종료, PC 절전·복귀를 같은 규칙으로 복구한다.
  5. lease 회수와 quota 예약의 해제·재사용 규칙이 일치한다.
- 결정 역할:
  - AI 설계: 상태 전이·경합표, fencing 검사, Batch 종료·restart 연결.
  - 사용자 실값: 실제 lease, heartbeat, 최대 시도·운영자 개입 기준.
  - 외부 검증: clock boundary·동시 claim·stale worker·절전 복귀 테스트.

### C05. 공통 실행 경로의 Job 식별·중복·동시 실행·중지 계약이 없다

- 중요도·구분: **High / 정상 미정이지만 구현 전 확정 필요**
- 양쪽 근거:
  - Quartz·REST·Discord가 공통 배치 경로를 호출하는 것은 확정이다(`docs/system-design/01-system-architecture.md:382-395`, `docs/system-design/03-api-design.md:792-797`).
  - Job/Step, 실행 제어, 동시성·중복·중지는 미정이다(`docs/system-design/01-system-architecture.md:419-425`, `docs/system-design/05-security-operations.md:506-510`). Discord URL은 확인 interaction 뒤 후보 접수와 Job 실행을 이어야 한다(`docs/planning/content-collection/README.md:288-300`, `collection-assist.dev.md:973-985`).
- 영향: 동일 Discord interaction, REST 재전송, Quartz 겹침·misfire가 서로 다른 JobInstance로 실행되면 후보 URL 멱등만으로 외부 fetch 중복과 불명확한 응답을 막을 수 없다. 반대로 지나치게 넓은 단일 실행 잠금은 서로 다른 후보까지 막는다.
- 최소 조치: 진입점 공통 실행 요청 모델, JobParameters의 식별 필드, 동일 요청·동일 후보·다른 후보의 중복 판정, 동시성 한계, stop/shutdown 의미를 먼저 설계한다.
- 설계 수용 조건:
  1. 같은 Discord interaction과 같은 REST 요청 재전송은 같은 실행 결과를 돌려준다.
  2. Quartz와 수동 실행이 같은 후보를 동시에 겨뤄도 claim 성공자는 하나다.
  3. 다른 후보 실행을 허용할지 직렬화할지는 quota·PC 자원 한계와 함께 명시한다.
  4. stop은 새 claim 중지, 진행 중 heartbeat·외부 요청·result 처리 중 무엇을 완료/중단하는지 단계별로 정의한다.
  5. Quartz misfire·중복 fire·프로세스 재시작이 신규 URL 자동 발견이나 자동 발행으로 확장되지 않는다.
- 결정 역할:
  - AI 설계: 공통 command 모델, JobParameters canonicalization, JobInstance·Execution 중복표, stop 상태도.
  - 사용자 실값: cron·시간대·misfire 정책, 최대 동시 수, 종료 유예, REST 허용 운영자.
  - 외부 검증: Spring Batch restart, Quartz overlap/misfire, 세 진입점 병렬 contract test.

### C06. Job/Step checkpoint와 Core 원격 상태의 복구표가 없다

- 중요도·구분: **High / 정상 미정이지만 구현 전 확정 필요**
- 양쪽 근거:
  - Batch transaction은 원격 Core API와 원자 transaction이 아니며 실패 지점별 재확인은 미정이다(`docs/system-design/01-system-architecture.md:408-411`).
  - 데이터 모델은 Batch 성공과 후보 `NEW/FETCH_FAILED`, 검수·발행이 서로 다른 상태라고 구분한다(`docs/system-design/02-data-model.md:962-971`).
  - 개발 명세도 result 반영 뒤 Batch 기록 전 중단 가능성과 Job/Step·checkpoint·restart 미정을 명시한다(`collection-assist.dev.md:1061-1068`).
- 영향: 단순히 Step을 재실행하면 외부 fetch, result, preview, 알림이 중복될 수 있고, 반대로 Batch를 완료로만 기록하면 preview 누락이나 알림 최종 실패를 잃는다. 기술적 Job 성공을 콘텐츠 성공·발행으로 오해할 위험도 있다.
- 최소 조치: Step 이름이나 chunk 크기를 먼저 고르기보다, 원격 side effect별 checkpoint와 재확인 가능성을 표로 만든 뒤 그 표를 만족하는 Job/Step 구조를 선택한다.
- 설계 수용 조건:
  1. claim 전, claim 후 fetch 전, 요청 송신 후, result commit/응답 전후, 각 preview 전후, 알림 전후, Batch 기록 전후 중단을 모두 판정한다.
  2. result 응답 유실은 기존 key·동일 payload로 복구하고 24시간 멱등 보존 경계를 넘는 restart 전략을 별도 명시한다.
  3. Core 최신 lease/version을 알 수 없는 경우 임의 진행하지 않고 재확인 불가 상태로 멈춘다.
  4. BatchStatus/ExitStatus와 후보 상태를 1:1로 오해하지 않고 후보 ID·실행 ID 상관관계를 남긴다.
  5. `FETCH_FAILED` 제출 성공, preview 일부 실패, Discord 알림 최종 실패를 서로 다른 결과로 관측한다.
- 결정 역할:
  - AI 설계: failure-window 표, Step/checkpoint 대안, restart·skip·retry 분류와 상관 ID 계약.
  - 사용자 실값: Job 이력 보존 기간, 자동 재시도와 수동 개입 경계.
  - 외부 검증: 각 경계의 process kill·timeout·lost response fault injection과 실제 BFF/Core 연동.

### C07. 로컬 REST 제어면의 노출·인증·secret 운영이 미정이다

- 중요도·구분: **High / 정상 미정, REST 활성화 차단**
- 양쪽 근거:
  - 로컬 REST의 경로·포트·인증·응답·중지 계약은 미정이고 BFF 중계와 다른 제어 API다(`docs/system-design/03-api-design.md:786-794`).
  - 공개 Tunnel route에 자동 추가하지 않고 서비스 DB 포트를 공개하지 않는 경계는 확정이다(`docs/system-design/04-infrastructure-design.md:444-451`).
  - 제어 API에 collector/Discord token을 무조건 재사용하거나 외부 공개·무인증 실행하는 것은 승인되지 않았다(`docs/system-design/05-security-operations.md:502-507`). Job 메타데이터·로그에 secret, 원문, binary, 개인정보, 절대 경로를 남기지 않는 조건도 확정이다(`docs/system-design/05-security-operations.md:515-516`).
- 영향: 기본 bind나 인증을 프레임워크 기본값에 맡기면 같은 네트워크의 임의 실행, secret 권한 확대, 실행·중지 CSRF/재전송이 생길 수 있다. 반대로 Discord 장애를 readiness 실패로 묶으면 REST·Quartz까지 불필요하게 중단된다.
- 최소 조치: 로컬 위협 모델, bind/접근 경계, 독립 인증·권한, 요청 재전송 보호, secret 보관·회전, readiness 분리를 운영값 없이 먼저 설계한다.
- 설계 수용 조건:
  1. 기본 설정에서 외부 인터페이스와 기존 Tunnel에 노출되지 않는다.
  2. 실행·중지·상태 조회 권한을 분리하고 collector service token·Discord bot token의 권한을 확대하지 않는다.
  3. 무인증·잘못된 권한·재사용 요청은 Job을 만들지 않고 감사 가능한 일반화 코드로 거부한다.
  4. token과 Discord 장애를 각각 회전·격리할 수 있고, 한 의존성 장애가 다른 진입점과 공개 서비스를 멈추지 않는다.
  5. 로그·Batch/Quartz metadata·알림의 금지 데이터 검사가 자동화된다.
- 결정 역할:
  - AI 설계: 위협 모델, bind·인증·권한 대안, secret 흐름, readiness/liveness 계약.
  - 사용자 실값: 실행 PC·OS 계정, 접속 허용 범위, 인증 방식 선택, secret 발급·회전 담당자.
  - 외부 검증: 포트 노출 확인, 권한 음성 테스트, token 회전, Discord 단절·Core 단절 runtime test.

### C08. Batch·Quartz 저장과 관측·알림을 운영 가능한 최소 단위로 확정해야 한다

- 중요도·구분: **High / 정상 미정, 운영 활성화 차단**
- 양쪽 근거:
  - Batch DB, Quartz 저장, 코드 위치, 버전, cron 값, 관측·알림이 미정이다(`docs/system-design/01-system-architecture.md:415-430`).
  - Batch 메타데이터와 서비스 데이터는 분리하며 Spring이 `collect.*`·`content.*` 또는 object storage를 직접 변경할 수 없다(`docs/system-design/01-system-architecture.md:404-407`, `docs/system-design/02-data-model.md:954-960`).
  - 알림 최종 실패를 관리자 화면에 표시하는 제품 동작은 유지하지만 상태 조회 원천·이력·재시도 횟수·간격·저장소는 미정이다(`docs/system-design/05-security-operations.md:511-516`, `collection-assist.dev.md:1066-1068`).
- 영향: 저장소가 휘발성이면 restart·misfire·중복 판정·`/collect status`를 증명할 수 없다. 상관 ID와 결과 분류가 없으면 후보 실패, 기술 실패, preview 누락, 알림 실패를 구분하지 못한다. 저장 위치를 잘못 고르면 서비스 DB 직접 쓰기 금지나 공개 DB 금지 경계를 침범한다.
- 최소 조치: 저장 제품을 바로 확정하기 전에 필요한 durability, transaction 경계, 최소 metadata, 보존·backup·복구, 지표·알림·redaction 수용 조건을 정하고 후보 저장소를 비교한다.
- 설계 수용 조건:
  1. JobInstance·JobExecution·Quartz fire·후보·API request를 secret 없는 상관 ID로 추적한다.
  2. restart와 misfire 판단에 필요한 이력이 PC 재시작 뒤에도 남고, backup/restore 뒤 중복 실행을 만들지 않는다.
  3. 후보 결과, preview 결과, 알림 결과, 프로세스 readiness를 별도 상태·지표로 기록한다.
  4. `/collect status`와 관리자 알림이 같은 원천을 사용하거나 차이를 명시하며, 데이터 지연을 숨기지 않는다.
  5. 이력·로그·알림은 원문 URL 전체, 제목 전체, 사용자 원시 ID, token, binary, 절대 경로를 저장하지 않는다.
  6. 수집 서버와 저장소 장애 중에도 공개 읽기·관리자 수동 작성·발행·백업이 계속된다.
- 결정 역할:
  - AI 설계: durability 요구표, 저장소 대안 비교, 최소 metadata·상관 ID·지표·알림·복구 절차.
  - 사용자 실값: 코드 위치, 저장소 운영 방식, 보존·backup 기간, 알림 채널·재시도·당직 기준, JDK/배포 운영 선택.
  - 외부 검증: 선택 버전 호환성, crash/restore/misfire, log redaction, 관리자 알림 표시, 장시간 운영 시험.

## 확정 단계와 순서

| 단계 | 현재 판정 | 확정 전에 필요한 최소 작업 | 결정권 |
| --- | --- | --- | --- |
| M0 Core의 수집 분리 경계 | **확정 가능** | collector route·`collect` schema·Spring runtime이 Core 첫 공개 차단 조건에 섞이지 않는지 최종 체크 | 제품·아키텍처 정본, 사용자 승인 |
| Spring 전환 상위 방향 | **확정 가능** | Boot/Batch/Quartz, 공통 경로, Java 추출, 기존 BFF/Core 경유, 직접 쓰기 금지를 변경 불변조건으로 고정 | 사용자 승인 |
| M0 수집 보조 제품 범위 | **조건부 확정 가능** | C01의 `/collect status` 정보 범위와 C02의 로컬/서버 이미지 수명주기 경계 결정 | 사용자 제품 결정 + AI 계약 초안 |
| collector API·데이터 계약 | **확정 보류** | C01~C04의 조회·preview 복구·quota 권위·lease 규칙을 API/데이터 명세에 반영 | 사용자 선택 + AI 상세 설계 |
| Spring Job/운영 상세 | **확정 보류** | C05~C08의 Job/Step, checkpoint, 제어면 보안, 저장·관측 설계와 수용 테스트 명세 | AI 상세 설계 후 사용자 운영값 승인 |
| 수집 가능성 검증 | **외부 검증 대기** | 실제 출처 URL·약관·robots·parser fixture·User-Agent 연락 수단 확인 | 사용자 출처 선택 + 외부 검증 |
| production 수집 활성화 | **불가** | 위 계약 확정, 구현 source/migration/OpenAPI/test/build/runtime, 실제 Discord·출처·배포 검증 | 사용자 go-live 승인 |

권장 순서는 `C01/C02 API 복구 결정 → C03/C04 quota·lease 상태 규칙 → C05/C06 Job·restart 구조 → C07/C08 보안·저장·관측 → fixture contract test → 실제 외부 검증`이다. 이 순서를 따르면 Job/Step 이름이나 저장 제품을 먼저 골라 API 공백을 뒤늦게 발견하는 재작업을 줄일 수 있다.

## 검토 시점 파일 해시

아래 SHA-256은 이 보고서가 읽은 시점을 식별하기 위한 값이다. 구현 완료나 Git clean 상태의 증거는 아니다.

| 파일 | SHA-256 |
| --- | --- |
| `docs/planning/content-collection/README.md` | `dceed6ce1fb0645aae95a5d018b788a802616e7f701765631223bfa18fd2b415` |
| `docs/planning/01-service-plan.md` | `f7ddd956aefcaebe9c36a363ffe5e4d7b74a45f9fa7b27371a4b8fd3afde90fa` |
| `docs/system-design/README.md` | `070a1030cd39a6ea36f959adf95702d2156c3ca1bb8d227ea393e02923d317d1` |
| `docs/system-design/01-system-architecture.md` | `c6b174d02fc0c8810b48e5d14bcb314e99ce921d2a84c73307f59ba108af3dfb` |
| `docs/system-design/02-data-model.md` | `54d3abcb2d63005641f136316bcbc4c1107a15f0b97f28bfa373701c9beb5b36` |
| `docs/system-design/03-api-design.md` | `ec484aa11f4ef825d56c451511af4cfcc2e30c98241f05b22b70f70aa6fffbfb` |
| `docs/system-design/04-infrastructure-design.md` | `1bf0e263f6fb7144ef2a75d013f062764e3bdab6fb068a70ada4772060e4c67b` |
| `docs/system-design/05-security-operations.md` | `261f639d2ec9351e727020a770975fdf00cfd57a57fc33b968978372e954e155` |
| `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md` | `cd64b11b8fef1da83f755a93e5a98ce2d4eb38aae6e98d6279cd0ec2d7b88620` |
| Spring collector 인계 문서 | `aac1a772c1495c3b451963a46409739abf48121c3b82337694d399745fc38d46` |

## 검증 한계

- 이번 검토는 문서 대조다. Spring source, migration, OpenAPI, test, build, runtime이 없으므로 구현 완료·통과를 주장하지 않는다.
- 실제 출처, 이용약관, robots, parser, Discord Gateway/webhook, R2, 운영 배포는 실행 검증하지 않았다.
- 정상적으로 `(미정)`인 버전, 저장 제품, cron, retention, retry 수치를 결함으로 세거나 임의 값으로 채우지 않았다.
- 정본은 수정하지 않았고 이 검토 보고서만 추가했다.
