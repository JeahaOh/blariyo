# 로컬 Collector 프로그램 D08

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-04
- 입력 근거: [콘텐츠 수집 기획 §3.2](../../../../planning/content-collection/README.md), [시스템 아키텍처 §4·§5](../../../../system-design/01-system-architecture.md), [인프라 설계 §6](../../../../system-design/04-infrastructure-design.md), [보안·운영 §4 수집](../../../../system-design/05-security-operations.md), [Collector 내부 API](../api/collector-internal-api.md)
- 미검증: collector source, Discord Gateway·Slash Command, 실제 출처 fetch, local secret 저장, contract test, runtime

## 1. 프로그램 목적·route·milestone

화면 route 해당 없음. 운영자 로컬 컴퓨터에서 실행되는 별도 프로세스로, Discord `/collect url` 명령과
관리자 화면에서 접수된 `PENDING` 후보 작업을 처리한다. BE·FE runtime 안에서 외부 사이트를 fetch하지
않고, collector가 등록·활성 출처의 단일 상세 페이지 1건만 가져와 parser 결과를 Core 내부 API로 제출한다.

## 2. 진입·이탈·권한 조건

- 실행 주체는 승인된 운영자 로컬 PC다.
- Discord 명령은 허용 guild, channel, user만 처리한다.
- Core 내부 API 호출에는 collector service token이 필요하다.
- token, Discord bot token, webhook URL은 서버 `.env`와 분리해 로컬 secret으로 관리한다.
- 종료되거나 네트워크가 끊겨도 공개 목록·상세, 관리자 수동 작성과 발행은 계속 동작해야 한다.

## 3. UI 영역과 구성요소

직접 UI 없음. CLI 또는 local process log만 제공한다.

- stdout/stderr에는 실행 상태, 처리 후보 수, 일반화된 오류 code만 출력한다.
- 원문 URL 전체, 후보 제목 전체, 원문 HTML, 이미지 binary, local temp path, token, stack trace는 출력하지 않는다.
- Discord 응답은 접수·실패·완료 상태를 짧게 알리고 내부 오류 상세를 노출하지 않는다.

## 4. 필드·표시값·validation

- `collectorId`: 운영 환경에서 고유해야 하며 log와 API 요청에 사용한다.
- `CORE_BASE_URL`: collector 내부 API base URL. public browsing route로 호출하지 않는다.
- `COLLECTOR_SERVICE_TOKEN`: Core 내부 API 전용 bearer token.
- `DISCORD_BOT_TOKEN`, `DISCORD_ALLOWED_GUILD_ID`, `DISCORD_ALLOWED_CHANNEL_ID`, `DISCORD_ALLOWED_USER_IDS`: Discord 명령 수신 gate.
- `COLLECT_MAX_RESPONSE_BYTES`, `COLLECT_TIMEOUT_MS`, `COLLECT_USER_AGENT`: 출처 요청 제한.
- 출처 host, robots, 요청 간격, 일일 상한, DNS 안전성, redirect 3회 제한은 fetch 직전 다시 확인한다.
- `https`가 아니거나 사설·loopback·link-local·metadata 주소로 해석되는 대상은 요청하지 않는다.

## 5. 이벤트·후처리

| 이벤트 | 처리 |
| --- | --- |
| process start | secret 존재, Core 연결, Discord 연결 설정을 검증하고 준비 상태로 전환 |
| Discord `/collect url` | 허용 guild·channel·user와 URL 형식을 확인한 뒤 단일 상세 페이지 추출 결과를 Core에 제출 |
| claim loop | `/internal/collect/candidates/claim`으로 `PENDING` 후보를 선점 |
| heartbeat | 긴 fetch·parser 처리 중 lease를 연장 |
| result submit | 성공은 `NEW`, 실패는 `FETCH_FAILED`로 제출 |
| preview upload | 검수용 이미지 후보 preview 파일을 private staging으로 업로드 |
| shutdown | 진행 중 작업은 heartbeat를 멈추고 lease 만료 뒤 재선점 가능하게 둔다 |

## 6. 프로그램 상태

- `disabled`: local flag 또는 필수 secret 부재로 실행하지 않음
- `ready`: Core와 Discord 연결 준비
- `idle`: 처리 가능한 후보 없음
- `running`: 후보 1건 처리 중
- `rate_limited`: 출처 요청 간격 또는 일일 상한 초과
- `blocked`: robots 금지, host 비활성, DNS·redirect·content-type·응답 크기 제한으로 fetch 차단
- `failed`: Core API, Discord, parser, preview upload 오류

오류는 후보별 실패와 프로세스 치명 오류를 구분한다. 후보별 실패는 공개 서비스 장애로 확대하지 않는다.

## 7. 반응형과 접근성

UI 없음. CLI는 색 없이도 상태와 exit code를 구분할 수 있어야 하며, 비대화형 실행과 로그 수집이 가능해야 한다.

## 8. 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| Discord `/collect url` 또는 관리자 후보 claim | [URL 후보 생성과 검수](../d01/create-and-review-candidate.md) | [collector-internal-api](../api/collector-internal-api.md), [create-candidate-from-url](../api/create-candidate-from-url.md) |
| 실패 후보 재처리 | [후보 재시도와 반려](../d01/retry-or-reject-candidate.md) | [retry-candidate](../api/retry-candidate.md), [collector-internal-api](../api/collector-internal-api.md) |
| preview 재업로드 | [후보 초안 승격](../d01/promote-candidate-to-draft.md) | [collector-internal-api](../api/collector-internal-api.md), [promote-candidate-to-draft](../api/promote-candidate-to-draft.md) |

## 9. 메시지와 사용자 피드백

- Discord: 후보 생성을 접수했습니다.
- Discord: 허용되지 않은 채널 또는 사용자입니다.
- Discord: 이 URL은 수집할 수 없습니다.
- Discord: 후보 생성에 실패했습니다. 관리자 화면에서 사유를 확인해 주세요.
- CLI: `ready`, `idle`, `processing`, `submitted`, `blocked`, `failed` 상태와 일반 오류 code를 출력한다.

## 10. 프로그램 수용 조건

- BE·FE runtime이 외부 사이트를 직접 fetch하지 않는다.
- Discord 일반 메시지를 감시하지 않고 `/collect url` 명령만 처리한다.
- 등록·활성 출처, robots, 요청 상한, DNS 안전성, redirect, content-type, 응답 크기, timeout gate를 fetch 직전 적용한다.
- 성공 결과는 원문 HTML·이미지 binary·local temp path 없이 metadata와 preview 식별자만 제출한다.
- 실패 결과는 `FETCH_FAILED`와 허용된 `fetchErrorCode`로 남긴다.
- collector 중단·lease 만료 뒤 후보는 재선점 가능하고 공개 목록·상세와 수동 발행은 계속 동작한다.
- token과 Discord secret이 log, Discord 메시지, Git, error response에 남지 않는다.

## 11. 미정·차단·미검증

- 결정 필요: collector 배포 방식, 실행 명령, 로컬 secret 저장 방식, 운영자 PC 식별 규칙.
- 결정 필요: 첫 출처별 parser package와 fixture 위치.
- 차단: 출처별 source spec의 운영 위험·robots 확인 전 production 활성화 불가.
- 미검증: source, Discord Gateway·Slash Command, 실제 출처 fetch, contract test, runtime.
