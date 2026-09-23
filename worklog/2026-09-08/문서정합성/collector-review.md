# Spring 수집 전환 문서 정합성 감사

- 검토일: 2026-09-08
- 범위: Spring 수집 서버 전환 인계와 현행 `planning`, `system-design`, `development-specs` 정본의 정합성
- 권한: 검토 보고서 작성만. 정본·구현·Git 상태는 수정하지 않음
- 판정: **Critical 0 / High 0 / Medium 2 / Low 3 / 추가 확인 의심 2**
- 구현 상태: Spring 구현 미착수·미검증. 현재 브랜치에서 애플리케이션 source를 구현 증거로 확인하지 않음

## 결론

확정된 큰 방향은 정본 사이에서 일치한다. 운영자 로컬의 별도 Spring Boot 상시 서버, Spring Batch 작업,
Quartz 예약 실행, REST·Discord 공통 배치 실행 경로, 기존 Web/BFF collector 중계와 Core API 유지,
Spring 수집 서버의 서비스 DB·object storage 직접 쓰기 금지가 모두 반영돼 있다.

구현 전에 고쳐야 할 핵심 불일치는 두 가지다. 첫째, 제품 기획에 포함된 `/collect status`가 기능 명세에서는
제외된 것처럼 적혀 있다. 둘째, 기능 명세의 정상 흐름이 `result`와 별도 `preview upload`의 순서를 합쳐 써서,
Spring Job이 기존 API가 요구하는 `candidateImageId`와 최신 `lockVersion`을 잘못 다룰 수 있다.

## 확정된 오류

### Medium-01. `/collect status`의 초기 범위와 Spring Collector 수용 조건이 다르다

- 구분: **확정**
- 상위 근거: `docs/planning/content-collection/README.md:267-273`은 초기 명령으로 상태를 바꾸는
  `/collect url`과 읽기 전용 `/collect status`를 모두 포함한다.
- 상충 근거: `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:1007-1015`는
  Discord 일반 메시지를 감시하지 않고 `/collect url` 명령만 처리하는 것을 프로그램 수용 조건으로 둔다.
  같은 문서의 Spring 이벤트 표 `:962-973`에도 `/collect status` 처리가 없다.
- 연관 미정: `docs/system-design/05-security-operations.md:508-515`는 Spring 전환의 상태 조회·이력 보존을
  상세 설계 미정으로 둔다. 미정 자체는 오류가 아니지만, 현재 기능 명세는 상위 기획에 이미 있는 명령까지
  제외하는 문장이라 단순한 상세 미정으로 읽을 수 없다.
- 영향: 기능 명세를 구현 기준으로 사용하면 `/collect status`가 누락된다. 반대로 기획만 따르면 어떤 저장소에서
  최근 Job과 후보 상태를 조합할지 계약 없이 구현해야 한다.
- 권장 조치: planning을 기준으로 `/collect status`를 유지할지 먼저 확인한다. 유지하면 기능 명세의 이벤트·수용
  조건에 읽기 전용 명령을 추가하고, 조회 원천·응답·인증은 값이나 API 경로를 추측하지 말고 `(미정)`으로 둔다.
  제외하기로 결정하면 planning을 먼저 후속 단계로 변경한 뒤 하위 문서를 맞춘다.

### Medium-02. D01 정상 흐름이 `result`와 `preview upload`의 필수 순서를 합쳐 놓았다

- 구분: **확정**
- 문제 근거: `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:628-638`은
  추출 뒤 한 단계에서 후보·이미지 metadata와 preview 식별자를 BE에 제출하는 것으로 적는다.
- 반증 근거 1: 같은 문서의 기존 collector API `:239-257`은 `result` 성공 응답에서
  `{position, candidateImageId}`와 새 `lockVersion`을 받은 뒤, 각 이미지를 별도 preview endpoint에 순차
  업로드하고 매 응답의 새 version을 다음 호출에 쓰도록 한다.
- 반증 근거 2: `docs/system-design/03-api-design.md:492-499`도 result의 이미지 ID 매핑 후 NEW 상태에서
  preview를 업로드하도록 정한다. Spring 전환 흐름 역시 기능 명세 `:1048-1053`에서 `result -> preview` 순서를
  분리한다.
- 영향: D01만 따라 구현하면 아직 발급되지 않은 `candidateImageId`를 사용하거나, result payload에 preview
  정보를 넣거나, 여러 preview를 같은 `lockVersion`으로 병렬 업로드해 `409` 충돌을 일으킬 수 있다.
- 권장 조치: D01 정상 흐름을 `result 제출 -> ID 매핑과 최신 lockVersion 수신 -> preview 순차 업로드 ->
  각 응답의 새 lockVersion 적용 -> 화면 조회`로 분리한다. Spring의 Job/Step 구성은 여전히 `(미정)`으로
  유지하고 기존 HTTP 호출 순서만 명확히 한다.

### Low-01. Discord 상태 변경 명령의 확인 interaction이 D01 Spring 흐름에서 빠졌다

- 구분: **확정**
- 상위 근거: `docs/planning/content-collection/README.md:288-300`은 상태 변경 명령이 실행 범위와 출처 상태를
  보여준 뒤 확인 interaction을 거치도록 한다.
- API 근거: `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:166-181`도
  guild·channel·user 검증과 확인 interaction 후 후보 접수 API를 호출하도록 한다.
- 누락 근거: 같은 문서의 D01 정상 흐름 `:628-636`과 Spring 이벤트 표 `:964-973`은 권한·URL 검증 직후
  공통 배치 실행 경로 또는 후보 접수로 넘어가며 확인 단계를 적지 않는다.
- 영향: 요약 흐름만 구현 기준으로 읽으면 운영자 확인 없이 상태 변경 Job을 시작할 수 있다.
- 권장 조치: 권한·URL 검증과 공통 실행 경로 호출 사이에 확인 interaction을 명시하고, 확인된 같은 interaction
  ID를 기존 멱등 key 계약에 사용한다고 연결한다.

### Low-02. 데이터 모델의 “Core API만 변경한다”는 API 유지 계약과 문언상 충돌한다

- 구분: **확정 문언 오류**
- 문제 근거: `docs/system-design/02-data-model.md:954-960`은 기존 `collect`·`content` 모델을 유지하면서
  “Core API만 변경한다”고 적는다.
- 반증 근거: `docs/system-design/03-api-design.md:787-798`은 Spring 전환이 호출자 교체이며 기존 collector
  5개 endpoint와 후보 관리 API를 유지한다고 명시한다. `docs/system-design/01-system-architecture.md:402-409`도
  Spring이 서비스 테이블을 직접 변경하지 않고 기존 API를 사용한다고 정한다.
- 영향: 문맥상 의도는 Core가 서비스 데이터의 유일한 쓰기 주체라는 뜻이지만, 현재 문장은 Core API 계약 자체를
  바꾼다는 뜻으로 읽혀 기존 API 유지 결정과 충돌한다.
- 권장 조치: “서비스 `collect`·`content` 데이터는 Core API만 변경한다” 또는 “서비스 데이터 변경은 Core API를
  통해서만 수행한다”로 주어와 목적어를 명확히 한다.

### Low-03. 후속 자동 수집에 Node 단발성 command가 선결정돼 있다

- 구분: **확정된 문서 drift, 현재 M0 수집 보조 차단 아님**
- 문제 근거: `docs/system-design/03-api-design.md:641-646`은 후속 M0 자동 수집에서
  `npm run collect:crawl-due` 단발성 command를 도입한다고 적는다.
- 상충 근거: `docs/system-design/01-system-architecture.md:73-80`은 후속 자동 수집의 실행 주체를 로컬 collector
  반복 실행과 서버 worker 중에서 다시 결정하도록 두고, `:306-310`은 목록·feed·scheduler 설계를 후속 결정으로
  둔다. Spring 전환 계약 `:398-400`도 Java/Spring 추출 전환을 기본으로 하되 자동 수집은 이번 범위에서 확정하지
  않는다.
- 영향: 현재 수집 보조 구현에는 영향이 없지만, 후속 자동 수집 설계가 시작되기 전에 Node/API image command를
  기술 선택으로 고정한다. Spring collector 재사용 여부를 결정할 때 불필요한 충돌이 생긴다.
- 권장 조치: 해당 절을 기술 중립적인 후속 실행 계약으로 바꾸고, 실행 주체·명령은 M0 자동 수집 기획과
  아키텍처 결정 뒤 확정한다. 현재 Spring 수집 보조의 Quartz가 새 URL 목록을 발견하지 않는다는 경계는 유지한다.

## 추가 확인이 필요한 의심

### Suspect-01. VM 이전 절차의 “수집 cron” 소유 주체가 불명확하다

- 구분: **의심**
- 근거: `docs/system-design/04-infrastructure-design.md:424-435`는 기존 서버의 scheduler·outbox·수집 cron을
  함께 중지하고 새 서버에서 다시 시작하는 순서로 적는다. 같은 문서 `:442-449`는 Spring collector와 Quartz를
  운영자 PC의 별도 장애·배포 경계로 둔다.
- 판단: VM 전환 중 서비스 쓰기를 막기 위해 외부 Spring collector까지 함께 멈추라는 운영 절차일 수 있으므로
  확정 오류로 보지 않는다. 다만 “새 서버에서 수집 cron을 시작”하는 의미로 읽히면 배치 위치가 잘못된다.
- 권장 조치: 이후 운영 runbook에서 `공개 VM scheduler/outbox`와 `운영자 PC Quartz`를 이름으로 분리하고,
  중지·재개 명령을 어느 호스트에서 수행하는지 적는다.

### Suspect-02. 알림 실패 처리의 제품 결정과 기술 미정 범위가 겹친다

- 구분: **의심**
- 근거 1: `docs/planning/content-collection/README.md:321-326`은 Discord 발송 실패 시 보고서를 저장하고 제한
  재전송 뒤 관리자 화면에 실패를 표시하도록 한다.
- 근거 2: 같은 문서 `:441-442`, `docs/system-design/01-system-architecture.md:415-427`,
  `docs/system-design/05-security-operations.md:506-515`는 이력·알림 운영, Discord 재연결·알림 실패 재처리를
  `(미정)`으로 둔다.
- 판단: planning의 제품 동작은 확정하고 재시도 횟수·backoff·저장소·보존 기간만 미정이라는 뜻일 수 있다.
  현재 “알림 실패 재처리 전체가 미정”으로도 읽혀 경계가 모호하지만, 값을 임의로 확정한 오류는 아니다.
- 권장 조치: 제품 불변 조건과 기술 미정을 분리한다. 예를 들어 “최종 실패를 운영자가 볼 수 있어야 함”은 유지하고,
  재시도 횟수·간격·저장소·보존 기간은 `(미정)`으로 둔다.

## 정상 정합성 확인

- **Boot·Batch·Quartz와 공통 경로:** `docs/planning/content-collection/README.md:434-442`,
  `docs/system-design/01-system-architecture.md:378-396`, 기능 명세 `:1038-1050`이 같은 역할 분리를 사용한다.
- **기존 BFF/Core API 유지:** `docs/system-design/03-api-design.md:473-501`과 기능 명세 `:130-164`가
  `/api/collector/v1/* -> /internal/collect/*` 5개 경로와 Core 직접 접근 금지를 동일하게 유지한다.
- **서비스 DB 직접 쓰기 금지:** 아키텍처 `:402-409`, 데이터 모델 `:954-960`, 기능 명세 `:1045-1047`이
  Spring은 Batch 메타데이터만 자신의 저장소에 기록하고 서비스 데이터와 object storage는 기존 API를 통하도록 한다.
- **Batch 상태와 후보 상태 분리:** 데이터 모델 `:962-971`은 Batch 실패·중지·완료가 후보 상태를 자동
  rollback하거나 발행 완료로 뜻하지 않는다고 명시한다. 상세 `BatchStatus`·`ExitStatus`, checkpoint는 `(미정)`으로
  보존됐다.
- **이미지 생명주기:** planning `:142-147`, 아키텍처 `:313-320`, 데이터 모델 `:782-787`, 기능 명세
  `:247-261`의 로컬 임시 파일, 최대 24시간 private preview, 초안 승격 시 영구 private 원본은 서로 다른 단계다.
  “후보 단계 영구 저장 금지”와 충돌하지 않는다.
- **Python 잔여 표현:** 대상 정본의 Python 언급은 기존 구현값을 Spring 확정값으로 승계하지 않는다는 설명과
  구현 미착수 증거뿐이다. `aiohttp`, `croniter`, `server.py`, `runtime.py`, `SourceFetcher`를 현행 Spring 실행
  계약으로 사용하는 잔여 문구는 찾지 못했다.
- **정상 미정:** 코드 위치, JDK·Boot·Batch·Quartz 버전, Batch DB·Quartz 저장소, Job/Step, REST 경로·포트·
  인증, 동시 실행·중지·종료, cron 운영값, quota 저장, 관측·알림 상세는 아키텍처 `:415-430`에서 미정으로
  유지됐다. 이번 감사에서 임의 값으로 해결하지 않았다.

## 검증 상태

- 완료: 인계 문서와 지정 planning·system-design·development spec의 문언·범위·상태 대조
- 완료: 대상 문서의 `Python`, scheduler/cron, 이미지 preview·영구 저장, Batch/후보 상태, API 멱등성·
  lockVersion·lease 관련 검색과 근거 재확인
- 완료: 지정 정본의 `git diff --check`
- 미검증: Spring source, migration, OpenAPI 구현, test, build, runtime, 실제 Discord·출처 연결과 운영 배포
- 차단: 구현 상세 미정 항목. 이는 현재 문서 오류가 아니라 후속 설계 입력이다.
