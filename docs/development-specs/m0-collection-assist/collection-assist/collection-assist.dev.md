# 수집 보조 기능 명세

## 1. 문서 정보와 입력 근거

- 문서 상태: `조건부 설계 확정 가능(개발 입력) · 주 검수 완료`, 구현 수용·production 공개 승인 별도
- milestone: `M0 수집 보조` (`m0-collection-assist`)
- 기능: `collection-assist` — 로컬 collector 기반 Discord·운영자 URL 지정 후보 생성·검수·반려·초안 승격
- 기준일: 2026-09-08, 현행/legacy 계약 정합성 갱신: 2026-09-23
- 구현 판정: direct source·migration·OpenAPI와 격리 검증은 [요구사항 대조](../../../implementation/m0-interim-2026-09-23/requirements.md)의 현재 증거를 따른다. 실제 운영자·Access·원격 DB/object·Discord Gateway·출처 활성화·보존/고지는 별도 미검증이다.
- 기존 구현 증거: Node/Core·Python collector 구현과 전환 전 로컬 검증 범위는 [main 병합 구현 상태 인계](../../../ai/handoffs/2026-09-08-main-merge-implementation-status.md)를 따른다. 이 증거를 Spring 구현 완료로 해석하지 않는다.
- 주요 근거:
  - [콘텐츠 수집 기획](../../../planning/content-collection/README.md)
  - [출처 명세 템플릿](../../../planning/content-collection/source-spec-template.md)
  - [서비스 기획 §1·§5·§8](../../../planning/01-service-plan.md)
  - [화면 설계 §2 수집 후보 검수](../../../planning/03-screen-design.md)
  - [시스템 아키텍처 §4·§5 수집 흐름](../../../system-design/01-system-architecture.md)
  - [데이터 모델 §6 수집 데이터](../../../system-design/02-data-model.md)
  - [API 설계 §5 수집 API](../../../system-design/03-api-design.md)
  - [보안·운영 §4 수집](../../../system-design/05-security-operations.md)

## 2. 목표와 대상 milestone

운영자가 관리자 화면 또는 Discord `/collect url`로 등록·활성 출처의 단일 상세 페이지 원문 URL을
한 건 입력하면, 별도 컴퓨터의 batch가 확인 후 공통 대기열을 통해 원문 본문·이미지·첨부·SNS 링크를
수집해 collect DB/object에 직접 저장한다. API는 운영자의 검수·반려·초안 승격과 별도 발행을 처리한다.
API·Web은 외부 원문 사이트를 fetch하지 않으며 batch는 글마다 API에 결과를 전송하지 않는다.
아래 초기 candidate/metadata/preview 절은 legacy 호환 계약이다. 현행 direct batch에는 문서 후반의
2026-09-21 자동 수집 확장과 2026-09-23 batch 고도화·Discord queue 계약을 적용한다.
Web URL 입력의 direct 전달·source 변경 권한은 `(미정)`이다. 기존 URL 폼이 공통 batch queue에 연결됐다고 보지 않는다.

## 3. 행위자와 진입 조건

- 행위자: 외부 관리자 인증 allowlist를 통과한 운영자
- 진입: direct 결과 검수 `/admin/batch`, 로컬 collector의 Discord `/collect url`. `/admin/collect`는 legacy 후보 경로이며 direct URL 입력 전달 계약은 별도 미정이다.
- 선행: `M0 Core`의 관리자 인증, 수동 초안·이미지·발행·숨김 흐름 검증
- 출처 선행: 출처별 명세의 운영 위험 판정, `robots.txt`, 등록·활성 host, parser 방식 사용 결정

## 4. 범위와 범위 밖

| 경로 | 이번 계약 범위 | 구현·검증 경계 |
| --- | --- | --- |
| direct 수집 보조 | 상세 URL 확인·공통 queue·원문/이미지/첨부/SNS의 비공개 저장 | CLI/Discord 코드와 실제 Gateway·다른 PC 실행을 구분 |
| direct 검수 | `/admin/batch` 목록/상세·필터·인증 preview·검수 시작/승인/반려·선택 초안 편집 이동 | 로컬 브라우저·API 증거와 실제 운영자/Access/원격 object 인수 분리 |
| Web URL 전달·source 변경 | API 외부 fetch·batch queue 무제한 쓰기 없이 입력 전달 | 소유권·전달 계약 미정, 구현 완료 아님 |
| legacy 후보 | 기존 `/admin/collect`·candidate·임시 preview·선택 이미지 승격 API 호환 | 아래 legacy 절에만 적용. direct source 설정이나 queue를 수정하지 않음 |
| 자동 목록 수집 | 2026-09-21 확장의 허용 HOT/GENERAL 목록·pagination | source별 실제 검증·기능 활성화는 별도 |

자동 발행, Discord 일반 메시지 감시·검수/발행 명령, 로그인·CAPTCHA·유료 장벽·차단 우회,
비공개 collect 원본의 익명 다운로드·raw HTML 렌더링은 범위 밖이다.
DB에는 binary 자체가 아니라 object 참조·hash·size를 저장한다. direct의 비공개 원본 object 저장은 범위에
포함되며 legacy의 임시 preview만 저장하는 규칙과 구분한다.

## 5. 요구사항 추적표

### 5.1 현행 direct 요구사항

| 요구사항 | 계약·구현 근거 | 남은 수용 조건 |
| --- | --- | --- |
| API 외부 fetch 없이 batch가 직접 저장 | [direct 기술 설계](../../../system-design/07-spring-collector-design.md#2026-09-23-direct-batch-검수승격-구현-계약) | 실제 다른 PC·원격 제한 계정 |
| Web URL 입력 전달·source 변경 권한 | [미정 경계](../../../implementation/m0-interim-2026-09-23/next-plan.md#관리자-url-입력의-미정-경계) | QD-03 확정·구현, 기존 source UI와 direct 설정 분리 |
| 목록·출처/수집/검수 필터·private preview | OpenAPI `listBatchItems`, `getBatchItem`, `previewBatchImage` | 실제 운영자·Access·원격 object 인수 |
| 검수·승인/반려와 snapshot/버전·멱등 | OpenAPI `reviewBatchItem`, 아래 Batch 검수 snapshot 계약 | 내용 변경·경합·인증 실패 수용 |
| 승인→전체 본문과 검증된 이미지의 DRAFT | OpenAPI `promoteBatchItem`, 별도 Core 발행 명령 | 누락·중복·부분 실패·원격 private/public 경계 |
| 본문·이미지·첨부/SNS 원문 보존 | 아래 2026-09-21/23 확장 계약 | 실제 표본과 fixture 분리, 차단 출처 유지 |
| direct 원본·report·queue 보존 | [수집 기획의 적용 경계](../../../planning/content-collection/README.md#12-현행-direct와-legacy의-적용-경계) | 기간/승격 후 원본 미정, 자동 파기·고지 검증 |
| 기능별 OFF·운영 활성화 분리 | Core·수집 보조·자동 수집 gate | 로컬 통과만으로 활성화하지 않음 |

### 5.2 Legacy 후보 요구사항 — 기존 호환 경로

다음 표의 metadata/임시 preview·API 결과 제출은 legacy 후보에만 적용한다.

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| 수집 기능은 M0 Core 뒤 별도 활성화 | 확정 | 콘텐츠 수집 기획 §2 | 전체 | 반영 |
| 로컬 collector가 관리자 화면 또는 Discord `/collect url`의 URL 한 건 후보 생성 | 확정 | 콘텐츠 수집 기획 §3.2·§8 | `create-candidate-from-url`, D01, D08 | 반영 |
| 등록·활성되지 않은 host·robots 금지 거부 | 확정 | 보안·운영 §4 | API·D01 | 반영 |
| 후보 단계는 metadata와 임시 preview만 저장 | 확정 | 콘텐츠 수집 기획 §4, 데이터 모델 §6 | API·D01·D08 | 반영 |
| 이미지는 Spring 수집 서버의 작업 경로에 임시 저장 후 게시 결정 시 영구 저장 | 확정 | 콘텐츠 수집 기획 §4, API 설계 §5 | API·D01·D08 | 반영 |
| 실패 후보 재시도·반려 | 확정 | API 설계 §5 | `retry-candidate`, `reject-candidate` | 반영 |
| 초안 승격은 기존 게시글 command 재사용 | 확정 | 아키텍처 §5 | `promote-candidate-to-draft`, D01 | 반영 |
| 후보 화면에 원문 HTML·내부 오류 노출 금지 | 확정 | 화면 설계 §2, 보안·운영 §7 | D08 | 반영 |
| 자동 목록 수집 CLI / Discord URL 명령 | M0 확장 범위 | 콘텐츠 수집 기획 2026-09-21 확장 | 아래 확장 계약 | 사이트별 증거와 활성화는 별도 |
| 출처별 실제 selector·요청 간격 | 결정 필요 | 출처 명세 템플릿 | 전체 | 출처별 spec 필요 |

## 6. 업무 규칙과 수용 조건

### 6.1 Direct batch

- batch가 수집/queue 상태를, API가 검수/content 상태를 소유한다. 같은 database를 쓰더라도 역할별 쓰기 범위는 다르다.
- item의 DISCOVERED/FETCHING/FETCHED/FAILED/BLOCKED/SKIPPED_DUPLICATE/SKIPPED_POLICY와
  API의 UNREVIEWED/REVIEWING/APPROVED/REJECTED를 분리한다. FETCHED 결과만 검수/승격 대상이다.
- REVIEWING의 원문·미디어 snapshot이 바뀌면 재검수한다. 승인 없는 승격·버전 충돌·기존 원문 중복을 거부한다.
- raw/media/report는 비공개 collect 저장소에 보관하고, API는 고정된 읽기 경로에서 hash/size를 대조한다.
  원격 원문 URL로 대체 fetch하지 않는다. 첨부는 원문 링크이며 이미지 실패를 정상 preview로 처리하지 않는다.
- 초안 승격 뒤 별도 즉시/예약 발행이 필요하다. 제목 보정·긴 본문/이미지 한도·실패 복구는 아래 direct 계약을 따른다.
- 요청 전달·보존 기간·고지 정합성이 결정되지 않은 항목을 자동 추정하거나 legacy 값으로 채우지 않는다.

### 6.2 Legacy 후보·preview

아래 NEW/FETCH_FAILED·Quartz·preview upload 규칙은 기존 후보 중계 API의 호환 계약이다.

- 로컬 collector만 등록·활성 출처 host를 fetch한다.
- M0 수집 보조는 입력된 단일 상세 페이지 1건만 fetch하고 목록·feed·pagination을 호출하지 않는다. Quartz는 이미 접수된 후보 처리만 예약 실행한다.
- Discord `/collect url`은 BE 내부 scraper가 아니라 로컬 collector가 처리한다.
- Discord incoming webhook은 결과 알림용이며 URL 수신에는 사용하지 않는다.
- URL은 `https`만 허용하고 정규화 뒤 중복 후보를 검사한다.
- 같은 출처 host 안에서만 최대 3회 redirect를 따른다.
- 사설·loopback·link-local·metadata 주소로 해석되는 대상은 거부한다.
- `robots.txt` 금지 또는 미확인 경로는 fetch하지 않고 성공 후보 `NEW`로 만들지 않는다. 이미 접수된 작업은 `FETCH_FAILED`로 기록한다.
- 요청 간격과 일일 상한을 넘으면 collector가 fetch하지 않고 `SOURCE_RATE_LIMITED` 결과를 제출한다.
- fetch 실패·timeout·비HTML·parser 실패는 `FETCH_FAILED` 후보로 남겨 운영자가 재시도 또는 반려한다.
- 후보 단계에는 원문 URL, 제목, 이미지 후보 URL, 경고·실패 사유 metadata와 관리자 preview 식별자만 저장한다.
- Java/Spring 추출기는 운영자 검수 미리보기에 필요한 이미지 후보를 로컬 작업 경로에 임시 저장할 수 있다.
- 임시 이미지 파일은 DB image row나 영구 object storage가 아니며, 반려·만료·재시도 교체 시 삭제한다.
- 초안 승격 때 선택한 이미지 후보는 collector preview upload 또는 운영자 업로드 파일을 사용하고,
  관리자 업로드와 같은 검증·재인코딩을 적용한다. BE는 원격 이미지 URL을 직접 fetch하지 않는다.
- 초안 생성 transaction 실패 시 후보는 `NEW`로 유지하고 저장된 이미지는 staging orphan 정리 대상으로 둔다.

## 7. 데이터·권한·법무 영향

- direct: batch 결과 7개 테이블은 API SELECT only, 검수·receipt는 API 소유다. batch queue/confirmation과 content 쓰기 권한을 서로 공유하지 않는다.
- legacy 읽기·쓰기: `collect.source`, `collect.candidate`, `collect.candidate_image`와 기존 중계 허용 목록.
- source 설정 파일을 읽는 direct 실행기와 legacy 출처 수정 UI를 구분한다. 후자의 변경이 direct 설정에 적용됐다고 보고하지 않는다.
- 초안 승격 시 기존 `content.board_post`, `content.board_post_block`, `content.board_post_image` command를 재사용한다.
- 외부 fetch는 로컬 collector만 수행하고 BFF·Core는 직접 외부 사이트를 호출하지 않는다.
- 후보 제목·원문 URL 전체·HTML·이미지 binary·로컬 수집기 임시 파일 내부 경로를 application log나 Discord 보고서에 남기지 않는다.
- 출처별 운영 위험 판정과 robots 확인 전에는 production 활성화하지 않는다. 이용약관은 자동 차단 조건이 아니라 운영 위험 참고값으로 기록한다.

## 8. API 작업 목록

현행 direct API는 [OpenAPI](../openapi/m0-collection-assist.yaml)의 `listBatchItems`, `getBatchItem`,
`previewBatchImage`, `reviewBatchItem`, `promoteBatchItem`과
[direct 기술 계약](../../../system-design/07-spring-collector-design.md#2026-09-23-direct-batch-검수승격-구현-계약)을 따른다.
아래 anchor는 legacy 호환 API다.

- [수집 작업 접수와 후보 결과 생성](#api-create-candidate-from-url)
- [Collector 내부 API](#api-collector-internal-api)
- [후보 재시도](#api-retry-candidate)
- [후보 반려](#api-reject-candidate)
- [후보 초안 승격](#api-promote-candidate-to-draft)

- [출처 조회·설정과 관리 화면](#api-source-management)

## 9. 처리 흐름 찾아보기

- 현행 direct: [검수 snapshot·승격](#batch-검수-snapshot과-제목-보정), [저장 실행 소유권](#batch-저장-실행-소유권), [Discord queue](#2026-09-23-discord-direct-queue-정렬).
- 아래 D01 anchor는 legacy 후보 흐름이다.

- [URL 후보 생성과 검수](#d01-create-and-review-candidate)
- [후보 재시도와 반려](#d01-retry-or-reject-candidate)
- [후보 초안 승격](#d01-promote-candidate-to-draft)

## 10. 화면·프로그램 찾아보기

- 현행 direct: [검수 화면과 실패 복구](#direct-검수-화면과-실패-복구).
- 아래 D08 anchor는 legacy 후보 UI·중계 프로그램 계약이다.

- [수집 후보 검수 화면](#d08-collect-candidate-review)
- [로컬 Collector 프로그램](#d08-local-collector)

## 11. 결정·가정·미정·차단 항목

- 확정: M0 수집 보조는 자동 발행하지 않는다.
- 확정: 수집 실패는 공개 목록·상세와 수동 게시를 막지 않는다.
- 확정: direct batch는 비공개 원문 object를 저장하고, API는 승격 시 검증된 private 사본을 만든다. 기존 legacy 후보만 임시 preview 계약을 적용한다.
- 확정: Discord 연결 scraper는 운영자 로컬 컴퓨터에서 별도 프로세스로 실행하고 BE·FE runtime과 분리한다.
- 결정/검증 필요: 출처별 실제 접근·parser·요청 간격·상한과 활성화 상태. 등록 또는 fixture 통과를 실제 수집 성공으로 대체하지 않는다.
- legacy 출처 조회·수정은 [시스템 API](../../../system-design/03-api-design.md#수집-출처)를 따른다. direct Web 입력·source 변경 소유권은 별도 미정이다.
- 차단: 출처별 운영 위험 판정·robots 확인 전 production 활성화 불가.
- 미검증/미정: 실제 운영자·Access·원격 DB/object·Discord Gateway·지원 OS, direct 보존 기간과 고지/파기. 현재 로컬 구현·검사 증거는 요구사항 대조표로 추적한다.

## 12. 기능 계약 상세

아래 candidate/collector 접수·결과 제출·preview API와 API/D01/D08 anchor는 **legacy 호환 계약**이다.
direct 경로의 상태·DB/object 소유권·검수 UI는 위 5.1·6.1과 문서 후반의 2026-09-21/23 확장 절을 따른다.

이 파일은 관리자 업무 흐름·화면·기존 Collector API의 DTO·validation·수용 기준을 관리한다. [Spring 수집 서버 상세 설계](../../../system-design/07-spring-collector-design.md)는 Spring 전환에서 추가된 실행, 멱등, quota, lease, spool 계약의 정본이다. 두 문서의 공통 조건은 함께 충족해야 하며, 문서 통합은 구현 완료를 뜻하지 않는다.

<a id="api-collector-internal-api"></a>

### Collector 내부 API

- 계약 상태: `초안`

#### 작업 목적과 호출 경계

- 입력 근거: [API 설계 §5-1](../../../system-design/03-api-design.md), [아키텍처](../../../system-design/01-system-architecture.md), [데이터 모델](../../../system-design/02-data-model.md)
- 미검증: source, OpenAPI, contract test, 실제 Discord Gateway·출처 fetch

로컬 collector는 service origin의 `/api/collector/v1/*`를 HTTPS로 호출한다. Web은 허용 method·path를
Core `/internal/collect/*`로 중계한다. 예를 들어 `/api/collector/v1/candidates/claim`은
`/internal/collect/candidates/claim`으로 매핑한다. Core 직접 공개 주소는 만들지 않는다.
이 경로는 관리자 session·공개 브라우저 API와 분리하며 M0 Core에서는 등록하지 않는다.

#### Endpoint 목록

| Method | Core path | 역할 |
| --- | --- | --- |
| `POST` | `/internal/collect/candidates` | Discord URL 작업 접수 |
| `POST` | `/internal/collect/candidates/claim` | `COLLECT` 또는 `PREVIEW_REFRESH` 선점 |
| `POST` | `/internal/collect/candidates/{candidateId}/heartbeat` | 처리 중 lease 연장 |
| `POST` | `/internal/collect/candidates/{candidateId}/result` | 추출 성공·실패 결과 제출 |
| `POST` | `/internal/collect/candidates/{candidateId}/images/{candidateImageId}/preview` | 관리자 preview 파일 업로드 |
| `GET` | `/internal/collect/status` | 읽기 전용 후보·출처 집계 |
| `GET` | `/internal/collect/candidates/{candidateId}/execution-state` | 응답 유실·restart 조정 |
| `POST` | `/internal/collect/sources/{sourceId}/request-reservations` | 외부 HTTP quota 원자 예약 |
| `POST` | `/internal/collect/operational-events` | 일반화 운영 event 멱등 기록 |

#### 공통 인증·응답·권한

- `Authorization: Bearer <collector service token>` 필수다. Core가 token hash·scope와 등록 collectorId를 검증한다. Web은 외부 입력의 Core service token·admin actor header를 제거하며 collector token은 관리자 API 권한이나 cookie를 대신하지 않는다.
- token·원문 HTML·storage key·로컬 경로는 응답·로그·Discord 메시지에 남기지 않는다. JSON 응답은 공통 envelope와 `meta.requestId`, `Cache-Control: private, no-store`를 사용한다.
- `SPRING_V2` state-changing 요청은 `Idempotency-Key`와 canonical request hash를 사용한다. 2xx 완료 receipt만 7일 보관하며 429·503·일시 dependency 오류와 400·401·403·409는 durable 완료 receipt로 저장하지 않는다. 같은 key·다른 요청은 `409 IDEMPOTENCY_CONFLICT`다.
- heartbeat·result·preview·quota reservation은 `collectorExecutionId`와 current lockVersion을 함께 검증한다. 일반 COLLECT claim은 새 execution을 만드는 시작 요청이므로 current execution 일치를 요구하지 않으며, PREVIEW_REFRESH는 요청 `lockVersion`으로 NEW 후보를 compare-and-set한다. `execution-state`는 요청 execution이 current owner가 아니면 다른 owner·digest·이미지 정보를 숨기고 409을 반환한다.

#### Discord URL 작업 접수

`POST /internal/collect/candidates` body는 `collectorId`, `originUrl`을 가지며 `Idempotency-Key`가 필수다. Discord guild·channel·user 검증과 확인 interaction 후 호출한다. Core는 Discord 수집 flag, 등록·활성 출처, HTTPS·길이·정규화 URL 중복을 확인하고 외부 fetch는 수행하지 않는다. 성공은 `202`, `candidateId`, `status=PENDING`, `lockVersion=1`이며 동일 정규화 URL은 `409 CANDIDATE_DUPLICATE`다.

#### 후보 Claim

`POST /internal/collect/candidates/claim` body는 `collectorId`, `jobRequestId`, `collectorExecutionId`, `mode=COLLECT|PREVIEW_REFRESH`, `leaseSeconds`와 선택 `candidateId`, `maxItems`를 가진다. `maxItems`는 1~5이나 기본 single-active Spring Job은 항상 1을 보낸다. `leaseSeconds`는 60~900초다. `candidateId`가 있으면 해당 후보만 대상으로 하고 `maxItems=1`이다.

- `COLLECT`는 선택 candidateId 또는 PENDING·만료 RUNNING을 `FOR UPDATE SKIP LOCKED`로 선점하고 `status=RUNNING`, collector/execution, claimedAt, leaseUntil, attemptCount, lockVersion을 갱신한다. 성공 item은 candidateId, sourceId/host, originUrl, discoveryMode, attemptCount, lockVersion, leaseUntil, requestIntervalMs, dailyFetchLimit, robotsAllowed, robotsCheckedAt을 가진다. 대상이 없거나 이미 선점됐으면 빈 items다.
- `PREVIEW_REFRESH`는 candidateId와 현재 `lockVersion`이 필수이고 NEW 후보의 만료·누락 preview만 대상으로 한다. `(status, lockVersion)` compare-and-set으로 새 execution·version을 만들되 status·attemptCount·`lease_until=NULL`은 바꾸지 않는다. 새 execution owner에게만 position·candidateImageId·remoteUrl을 준다.
- 접수 이전이나 COLLECT claim 성공 이전에는 출처를 요청하지 않는다. source 활성·robots·quota gate는 fetch 직전 다시 검사한다.

#### Heartbeat와 Result Submit

heartbeat body는 `collectorId`, `collectorExecutionId`, `leaseSeconds`, `lockVersion`이다. RUNNING·current execution·lockVersion·유효 lease가 모두 일치할 때만 연장하고 새 lockVersion·leaseUntil을 반환한다.

result body는 `collectorId`, `collectorExecutionId`, `lockVersion`, `status`, 성공 시 `title`, `canonicalUrl`, `sourcePublishedAt`, `parserVersion`, `warnings`, `imageCandidates`를 가진다. 실패는 `status=FETCH_FAILED`, 필수 `fetchErrorCode`, `warnings`를 가진다. 성공은 NEW, 실패는 FETCH_FAILED만 허용하며 원문 HTML·binary·local path는 받지 않는다.

- `canonicalUrl`은 등록 출처의 정규화 HTTPS URL이어야 한다. 기존 후보와 중복이면 새 결과를 연결하지 않고 `409 CANDIDATE_DUPLICATE`다. 성공 시 `origin_url`과 hash를 같이 갱신한다. title은 trim 1~300자, parserVersion은 trim 1~100자, sourcePublishedAt은 UTC로 정규화하거나 null이고 warnings는 일반화 코드 0~20개(각 1~100자)다.
- 성공 imageCandidates는 1~20개, position은 1부터 연속, remoteUrl은 HTTPS·최대 2048자다. 성공 시 기존 image metadata를 교체하고 이전 preview를 cleanup 대상으로 기록한다.
- RUNNING의 current execution·lockVersion·유효 lease만 result를 처음 반영한다. 상태 변경·image metadata·result digest·멱등 결과는 한 transaction으로 commit하며 성공·실패 모두 fetchedAt을 기록하고 leaseUntil을 NULL로 비운다. 성공 응답은 candidateId, status, 새 lockVersion, `{position,candidateImageId}` 매핑을 반환하고 실패의 imageCandidates는 빈 배열이다.

#### Preview Upload와 관리자 읽기

preview multipart는 `collectorId`, `collectorExecutionId`, `lockVersion`, `file`과 `X-Content-SHA256`을 필수로 가진다. 파일은 10MiB 이하 JPEG·PNG·WebP·GIF다. NEW·current execution·current lockVersion·후보 이미지 소속을 확인하며 결과 뒤 종료된 처리 lease는 요구하지 않는다.

- 관리자 업로드와 같은 MIME·magic byte·decode·pixel·metadata 제거·재인코딩 검증을 적용하고 private `collect-preview/` object와 preview expiry 24시간을 기록한다. commit 직전에 상태·version을 재확인하고 충돌하면 저장 object를 보상 삭제한다. 성공 응답은 candidateImageId, previewPath, previewExpiresAt, 새 lockVersion을 반환한다.
- 같은 key·같은 bytes replay는 version을 다시 올리지 않는다. 복수 파일은 순차 업로드하며 매번 새 version을 사용한다. 만료 preview는 `PREVIEW_REFRESH` execution을 얻은 뒤에만 교체하며 이전 object는 삭제 대상으로 기록한다.
- 관리자 읽기는 `GET /api/v1/admin/collect/candidates/{candidateId}/images/{candidateImageId}/preview`를 사용하며 `private, no-store`로 stream한다. storage key·signed URL은 반환하지 않고 미존재·만료는 `404 IMAGE_NOT_FOUND`다.

#### 오류·수용 기준

| HTTP | code | 조건 |
| --- | --- | --- |
| 400 | VALIDATION_FAILED | schema·필수 execution·형식 오류 |
| 401 / 403 | COLLECTOR_AUTH_REQUIRED / COLLECTOR_FORBIDDEN | token·scope·collectorId 불일치 |
| 403 | SOURCE_NOT_ALLOWED | 출처 미등록·비활성·host gate |
| 404 | CANDIDATE_NOT_FOUND / IMAGE_NOT_FOUND | 대상 없음 |
| 409 | CANDIDATE_LEASE_CONFLICT / CANDIDATE_EXECUTION_CONFLICT / CANDIDATE_VERSION_CONFLICT | stale lease·execution·version |
| 409 | CANDIDATE_STATE_CONFLICT / CANDIDATE_DUPLICATE / IDEMPOTENCY_CONFLICT / IDEMPOTENCY_IN_PROGRESS | 상태·중복·재전송 충돌·진행 중 |
| 413 / 415 | UPLOAD_TOO_LARGE / UNSUPPORTED_MEDIA_TYPE | preview 크기·decode·형식 제한 |
| 429 / 503 | SOURCE_RATE_LIMITED / DEPENDENCY_UNAVAILABLE / MAINTENANCE_READ_ONLY | quota 또는 dependency·유지보수 |

- result 성공 뒤 checkpoint가 유실되면 execution-state의 digest·version으로 preview부터 조정하며 fetch/result를 추측 재실행하지 않는다. `NETWORK_STARTED` 뒤 응답 유실은 같은 request를 자동 재송신하지 않고 새 quota reservation을 사용한다.
- 반려·재시도·승격과 preview 경쟁에서 stale execution/version은 Core 상태·object·quota를 바꾸지 않고, 고아 object는 cleanup한다. 실제 source·OpenAPI·contract/integration/fault test는 아직 수행하지 않았다.

<a id="api-create-candidate-from-url"></a>

### 수집 작업 접수와 후보 결과 생성 API

- 계약 상태: `초안`

#### 작업 목적과 호출 주체·제공 주체

- 호출 주체: Nuxt BFF 관리자 화면, 운영자 로컬 collector
- 제공 주체: Nest Core API
- 입력 근거: [API 설계 §5 관리자 URL 지정 수집 작업 접수](../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test, 실제 출처 fetch

운영자가 관리자 화면에서 입력한 단일 상세 페이지 원문 URL은 BE가 `PENDING` 후보 작업으로 접수한다.
운영자 로컬 collector는 관리자 접수 작업을 claim한다. Discord `/collect url`도 먼저 작업을 접수하고 claim한 뒤 등록·활성
출처 규칙으로 한 번 조회해 후보 결과를 BE에 제출한다. 목록·feed·pagination은 이 API 범위에서
호출하지 않는다.

#### Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates`
- 관리자 인증 필수
- `Idempotency-Key` 필수
- cache: `private, no-store`

Discord에서 시작한 경우에도 BE 공개 Interactions endpoint를 추가하지 않는다. 로컬 collector가 Discord
guild·channel·user 권한을 검증한 뒤 collector service token으로 BE에 후보 결과를 제출한다. Discord
incoming webhook은 처리 결과 알림용으로만 사용한다.

#### Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `originUrl` | string | Y | `https`, 최대 2048자 | 입력값 | 운영자가 지정한 원문 URL |

```json
{ "originUrl": "https://example.com/board/12345" }
```

#### Response

공통 성공 envelope를 사용한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `candidateId` | number | 접수된 후보 ID |
| `status` | string | 접수 성공 시 `PENDING` |
| `lockVersion` | number | 최초 `1` |
| `duplicatePostId` | number 또는 null | 같은 원문 URL의 기존 게시글 |


#### Validation과 정규화

- `originUrl`은 `https`만 허용한다.
- 관리자 접수 시 서버 정규화 뒤 host가 등록 출처와 일치해야 한다.
- collector claim 뒤 실행 직전 host 활성 상태를 다시 확인한다.
- 이용약관 판단은 자동 차단 조건이 아니라 운영 위험 참고값이다.
- collector가 DNS 해석 결과를 확인하고 사설·loopback·link-local·metadata 주소면 거부한다.
- collector가 출처 `robots.txt` 금지 경로를 확인하면 fetch하지 않고 실패 결과를 제출한다.
- collector가 요청 간격과 일일 상한을 넘으면 fetch하지 않고 `SOURCE_RATE_LIMITED` 결과를 제출한다.

#### 정상 처리와 데이터·상태 전이

1. 관리자 actor와 idempotency key를 검증한다.
2. URL을 정규화한다.
3. `collect.source` 활성 출처와 host를 대조한다.
4. 외부 fetch 없이 `collect.candidate`를 `PENDING`으로 저장하고 `202`를 반환한다.
5. 로컬 collector가 대기 후보를 claim해 `RUNNING`으로 바꾼다.
6. collector가 robots·요청 상한·DNS 안전성·redirect 경계를 확인한다.
7. collector가 상세 페이지를 1회 fetch하고 출처별 parser로 제목과 이미지 후보 URL을 추출한다.
8. Java/Spring 추출기는 미리보기에 필요한 이미지 후보만 로컬 작업 경로에 임시 저장한다.
9. collector가 `result` API로 후보와 이미지 후보 metadata만 제출한다.
10. 성공 추출이면 `NEW`, 실패 추출이면 `FETCH_FAILED`로 만들고, 성공 응답에서 이미지별
    `candidateImageId` 매핑과 최신 `lockVersion`을 받는다.
11. preview가 있으면 각 `candidateImageId`의 별도 preview API에 순차 업로드하고, 매 응답의 새
    `lockVersion`을 다음 업로드에 사용한다.

#### 오류·권한·충돌·timeout·부분 실패

| HTTP | code | 조건 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | URL 형식·길이 오류 |
| `401` | `ADMIN_AUTH_REQUIRED` | 관리자 인증 없음 |
| `403` | `ADMIN_FORBIDDEN` | allowlist 불일치 |
| `403` | `SOURCE_NOT_ALLOWED` | 등록·활성 출처가 아님 |
| `409` | `CANDIDATE_DUPLICATE` | 같은 정규화 URL 후보 존재 |
| `503` | `DEPENDENCY_UNAVAILABLE` | DB 등 내부 의존성 장애 |

후보 상세에서 추출 후 이미지 후보 수와 상태를 확인한다. 접수 응답에 추출 결과를 섞지 않는다.
robots 금지와 요청 상한은 접수 HTTP 오류가 아니라 collector가 `ROBOTS_DISALLOWED`·`SOURCE_RATE_LIMITED` 실패 결과로 제출한다.
관리자 접수 성공은 `202`와 `PENDING`을 반환한다. fetch·timeout·비HTML·parser 실패는 collector 결과
제출 시 후보를 `FETCH_FAILED`로 만들고 처리 결과를 저장한다.

#### 멱등성·동시성·재시도

- 같은 actor·method·route·idempotency key는 같은 결과를 반환한다.
- 같은 정규화 URL 동시 요청은 unique constraint로 중복 생성을 막는다.
- 운영자 재시도는 별도 `retry` API를 사용한다.

#### Contract test와 미검증 항목

- 등록되지 않은 host `403`
- 관리자 접수 성공 시 외부 fetch 없이 `202` + `PENDING`
- collector claim 시 `PENDING -> RUNNING`
- robots 금지 결과 제출 시 `RUNNING→FETCH_FAILED`와 일반화한 실패 코드
- Discord 권한 없는 guild·channel·user 거부
- 중복 후보 `409`
- fetch 실패 시 collector 제출 결과 `FETCH_FAILED`
- 원문 HTML·내부 오류·secret 로그 미기록
- 수집기 임시 이미지 파일의 내부 절대 경로·binary 로그 미기록
- collector 내부 API claim/result/preview upload contract test
- 실제 source·OpenAPI·runtime 미검증

<a id="api-promote-candidate-to-draft"></a>

### 후보 초안 승격 API

- 계약 상태: `초안`

#### 작업 목적과 호출 주체·제공 주체

- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Nest Core API
- 입력 근거: [API 설계 §5 후보 초안 승격](../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, R2 runtime, contract/integration test

운영자가 검수한 후보를 기존 관리자 초안 생성 흐름으로 넘긴다.

#### Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/draft`
- 관리자 인증 필수
- `Idempotency-Key` 필수
- cache: `private, no-store`

#### Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |
| `boardSlug` | string | Y | 활성 관리자 작성 대상 | 초안 게시판 |
| `title` | string | N | 생략 시 후보 제목 사용, 최종 trim 후 1~200자 | 게시글 제목 |
| `source.name` | string | N | 생략 시 출처 표시명 | 출처명 |
| `source.url` | string | N | 생략 시 후보 원문 URL | 출처 링크 |
| `candidateImageIds` | array | Y | 서로 다른 1~20개 | 영구 저장할 선택 이미지 후보, 본문 순서 |
| `imageOptions` | array | Y | 선택 ID마다 정확히 1건 | `candidateImageId`, trim 후 1~300자 `alt`, 선택 `uploadedImageId` |
| `leadText` | string | N | trim 후 1~20,000자 | 첫 문단 |
| `acknowledgeDuplicate` | boolean | Y | 중복 후보면 true 필요 | 중복 확인 |

#### Response

- 성공: `201`
- 공통 성공 envelope
- `data.postId`, `data.status=DRAFT`, `data.lockVersion=1`, `data.candidateId`, `data.storedImageIds`

#### Validation과 정상 처리

1. 후보가 `NEW`인지 확인한다.
2. `lockVersion`과 중복 확인 값을 검증한다.
3. 선택 이미지가 모두 해당 후보의 이미지 후보인지 확인한다.
4. `imageOptions`의 누락·중복·미선택 ID를 거부하고 각 alt를 검증한다. `uploadedImageId`가 있으면 기존 관리자 업로드로 생성한 미연결 `STAGED` 이미지와 1:1로 연결한다. 업로드 ID 재사용을 거부한다. 생략하면 만료되지 않은 해당 후보의 private preview가 필요하다. 선택 이미지 전부가 준비되어야 진행한다.
5. BE는 원격 이미지를 직접 fetch하지 않고, 제출된 파일에 관리자 업로드와 같은 MIME·magic byte·decode·pixel·metadata 제거·재인코딩 검증을 적용한다.
6. private 원본 bucket에 저장한다.
7. 기존 게시글 초안 생성 command를 재사용해 title, source, TEXT/IMAGE block을 만든다.
8. 같은 transaction에서 후보를 `APPROVED`로 바꾸고 `postId`를 연결한다.
9. 승격 성공 뒤 해당 후보의 로컬 수집기 임시 이미지 파일은 collector 삭제 대상에 넣는다.

#### 오류·부분 실패

| HTTP | code | 조건 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | 제목 없음, 이미지 후보 배열 오류 |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `404` | `BOARD_NOT_FOUND` | 작성 대상 게시판 없음·비활성 |
| `409` | `CANDIDATE_STATE_CONFLICT` | `NEW`가 아님 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |
| `409` | `CANDIDATE_DUPLICATE` | 중복 후보 확인 누락 |
| `409` | `IMAGE_STATE_CONFLICT` | preview 만료·누락, 업로드 이미지 미연결 STAGED 조건 불충족 |
| `413` | `UPLOAD_TOO_LARGE` | 파일 크기 초과 |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | 파일 형식 검증 실패 |
| `503` | `DEPENDENCY_UNAVAILABLE` | DB·R2 장애 |

선택 이미지 중 하나라도 준비·저장에 실패하면 후보를 `NEW`로 유지하고 위 오류를 반환한다. 일부 이미지로 초안을 만들지 않는다. TEXT만 있는 글은 기존 수동 초안 작성 API를 사용한다. DB transaction
실패 시 후보 상태는 바꾸지 않고 저장된 이미지는 staging orphan 정리 대상으로 둔다. 로컬 수집기 임시
이미지 파일은 영구 저장 성공 여부와 별개로 내부 절대 경로를 노출하지 않는다.

#### 멱등성·동시성·재시도

- `Idempotency-Key`는 같은 actor·method·route scope에서 24시간 보존한다.
- 같은 key에 다른 body는 `409 IDEMPOTENCY_CONFLICT`다.
- 후보 lockVersion으로 동시 승격을 막는다.

#### Contract test와 미검증 항목

- 중복 후보 확인 누락 시 `409`
- 선택 이미지 0건·21건 validation 실패
- alt 누락·공백·301자, imageOptions 중복·누락, 업로드 ID 중복 거부
- 선택 이미지 일부 저장 실패 시 초안 생성 없음, 후보 `NEW` 유지
- 수집기 임시 파일 만료 시 로컬 collector 재제출 또는 명시적 실패 처리
- 초안 생성 성공 시 후보 `APPROVED`
- transaction 실패와 orphan cleanup 분류
- 실제 source·OpenAPI·R2 runtime 미검증

<a id="api-reject-candidate"></a>

### 후보 반려 API

- 계약 상태: `초안`

#### 작업 목적과 호출 주체·제공 주체

- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Nest Core API
- 입력 근거: [API 설계 §5 재수집과 반려](../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test

운영자가 후보를 공개 게시글로 쓰지 않기로 결정하고 반려 사유를 남긴다.

#### Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/reject`
- 관리자 인증 필수
- cache: `private, no-store`

#### Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |
| `reasonCode` | string | Y | 허용 코드 | 반려 사유 |

허용 reason code: `DUPLICATE`, `LOW_QUALITY`, `RIGHTS_RISK`, `NOT_FUNNY`, `SOURCE_GONE`, `OTHER`.

#### Response

- 성공: 공통 성공 envelope, `candidateId`, `status=REJECTED`, `reviewedAt`, 증가한 `lockVersion`

#### 정상 처리와 상태 전이

- `NEW`와 `FETCH_FAILED`에서만 허용한다.
- 성공 시 `reviewedAt`과 `rejectReasonCode`를 기록한다.
- `APPROVED`, `REJECTED`는 terminal 상태로 반려할 수 없다.

#### 오류·동시성

| HTTP | code | 조건 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | reasonCode 누락·허용값 아님 |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `409` | `CANDIDATE_STATE_CONFLICT` | 반려 불가 상태 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |

#### Contract test와 미검증 항목

- 허용 reason code만 통과
- `APPROVED` 후보 반려 거부
- lockVersion 충돌 거부
- 실제 source·OpenAPI·runtime 미검증

<a id="api-retry-candidate"></a>

### 후보 재시도 API

- 계약 상태: `초안`

#### 작업 목적과 호출 주체·제공 주체

- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Nest Core API
- 입력 근거: [API 설계 §5 재수집과 반려](../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test, 실제 출처 fetch

`FETCH_FAILED` 후보를 같은 출처 규칙으로 다시 조회하도록 로컬 collector 작업으로 되돌린다.

#### Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/retry`
- 관리자 인증 필수
- cache: `private, no-store`

#### Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |

#### Response

- 성공: 공통 성공 envelope, `candidateId`, `status=PENDING`, 증가한 `lockVersion`
- 실제 재시도 결과는 로컬 collector 제출 뒤 `NEW` 또는 `FETCH_FAILED`가 된다.

#### Validation과 정상 처리

1. 후보가 존재하고 `FETCH_FAILED`인지 확인한다.
2. `lockVersion`을 비교한다.
3. 기존 이미지 후보 metadata를 재시도 교체 대상으로 표시한다.
4. 데이터 모델의 재시도 전이에 따라 `fetched_at`, `fetch_error_code`, `lease_until`을 초기화하고 `PENDING`으로 되돌린다. 증가한 `lockVersion`으로 접수 결과를 반환한다.
5. 로컬 collector가 출처 등록·활성 상태, robots, 요청 상한을 다시 확인한다.
6. collector는 기존 후보의 단일 상세 페이지 원문 URL만 다시 fetch하고 parser를 실행한다. 목록·feed·pagination은 호출하지 않는다.
7. 성공하면 기존 이미지 후보 metadata와 로컬 수집기 임시 preview 파일을 새 결과로 교체하고 `NEW`로 바꾼다.
8. claim으로 `RUNNING`이 된 후보는 실패 결과 제출 시 `FETCH_FAILED`로 전환하고 실패 분류와 `lockVersion`을 갱신한다.
9. 교체되거나 더 이상 참조하지 않는 로컬 수집기 임시 이미지 파일은 삭제 대상에 넣는다.

#### 오류·동시성

| HTTP | code | 조건 |
| --- | --- | --- |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `409` | `CANDIDATE_STATE_CONFLICT` | `FETCH_FAILED`가 아님 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |

출처·robots·상한 검사는 접수 후 collector 실행 단계다. 실패 코드는
[API 설계의 재수집 계약](../../../system-design/03-api-design.md#재수집과-반려)에 따라
`fetchErrorCode`로 기록하고, 이미 성공한 retry HTTP 응답을 바꾸지 않는다.

#### Contract test와 미검증 항목

- `PENDING`, `RUNNING`, `NEW`, `APPROVED`, `REJECTED` 후보 retry 거부
- lockVersion 충돌 거부
- 재시도 접수 시 `PENDING`
- collector 재시도 성공 시 `NEW`
- collector 재시도 실패 시 `FETCH_FAILED`
- 실제 source·OpenAPI·runtime 미검증

<a id="d01-create-and-review-candidate"></a>

### URL 후보 생성과 검수

- 계약 상태: `초안`

#### 프로세스 목적과 범위

- 입력 근거: 이 문서의 기능 범위·요구사항 (§2~§6)
- 미검증: source, test, browser, 실제 출처 fetch

운영자가 원문 URL을 입력해 후보를 만들고, 후보 목록·상세에서 결과를 확인한다.

#### 행위자·시작 조건·선행 조건

- 행위자: 인증된 운영자
- 시작 조건: `/admin/collect` 진입 후 원문 URL 입력 또는 로컬 collector의 Discord `/collect url` 명령
- 선행 조건: 등록·활성 출처와 parser, 관리자 인증 또는 Discord 운영자 권한, M0 Core 수동 초안 경로

#### 정상 흐름

1. 운영자가 관리자 화면에서 원문 URL을 입력하고 `후보 만들기`를 선택하거나 Discord `/collect url` 명령을 실행한다.
2. 화면은 중복 제출을 막고 생성 중 상태를 표시한다.
3. 관리자 화면은 BFF를 통해 후보를 `PENDING`으로 접수한다.
4. Discord 명령은 로컬 collector가 직접 받고 guild·channel·user 권한을 검증한다.
5. `/collect url`은 실행 대상·예상 요청 범위·현재 출처 상태를 보여준 뒤 운영자의 확인 interaction을
   거친다.
6. 로컬 collector는 확인된 Discord URL을 전용 중계로 PENDING 접수하고, 관리자·Discord 후보를 같은
   claim 흐름으로 선점한다. 같은 interaction ID를 기존 멱등 key 계약에 사용한다.
7. collector는 출처·robots·요청 상한·DNS 안전성·redirect 경계를 확인한다.
8. collector는 상세 페이지를 1회 fetch하고 parser를 실행한다.
9. Java/Spring 추출기는 미리보기에 필요한 이미지 후보를 로컬 작업 경로에 임시 저장한다.
10. collector는 `result` API로 후보와 이미지 후보 metadata만 제출하고, 응답의
    `candidateImageId` 매핑과 최신 `lockVersion`을 받는다.
11. preview가 있으면 이미지별 preview API에 순차 업로드하며 매 응답의 새 `lockVersion`을 다음
    요청에 사용한다.
12. 화면은 후보 목록에 새 후보 또는 실패 후보를 표시한다.
13. 운영자는 원문 링크, 제목, 이미지 후보 preview, 중복 표시, 실패 사유를 확인한다.

#### 대안·실패 흐름

- 등록되지 않은 host: 후보를 만들지 않고 허용되지 않은 출처로 표시한다.
- robots 금지: 접수된 후보를 fetch 없이 FETCH_FAILED로 기록하고 수집 금지로 표시한다.
- 요청 상한 초과: `Retry-After` 기준으로 재시도 가능 시점을 표시한다.
- fetch·parser 실패: `FETCH_FAILED` 후보를 표시하고 재시도·반려만 허용한다.
- 중복 후보: 기존 후보를 안내하고 새 후보를 만들지 않는다.

#### 단계별 호출 API 매핑

| 단계 | API |
| --- | --- |
| 3 | [수집 작업 접수와 후보 결과 생성](#api-create-candidate-from-url) |
| 6~11 | [Collector 내부 API](#api-collector-internal-api) |

#### 데이터·상태 전이

- 없음 -> `PENDING`: 관리자 화면 또는 인증된 collector의 Discord URL 접수
- `PENDING` -> `RUNNING`: 로컬 collector 작업 claim
- `RUNNING` -> `NEW`: 제목·이미지 후보 추출 성공
- `RUNNING` -> `FETCH_FAILED`: fetch gate 거부 또는 fetch·parser 실패
- 후보 이미지 metadata는 `DISCOVERED`로 저장한다.
- 수집기 임시 이미지 파일은 DB image row가 아니며 반려·만료·재시도 교체 시 삭제 대상이다.

#### 권한·트랜잭션·멱등성·재시도

- 관리자 인증과 Core service token·actor가 필요하다.
- Discord 명령은 로컬 collector가 guild·channel·user 권한을 먼저 검증하고 내부 actor로 변환한다.
- 생성 API는 `Idempotency-Key`를 사용한다.
- Discord interaction id는 같은 명령 중복 실행을 막는 멱등 key로 사용한다.
- 같은 정규화 URL은 unique constraint로 중복 생성을 막는다.

#### 완료 조건과 수용 기준

- 후보 또는 명시적 실패 상태로 끝난다.
- BE·FE는 외부 사이트를 직접 fetch하지 않는다.
- 원문 HTML 전체와 내부 오류 상세를 화면·로그에 노출하지 않는다.
- 수집기 임시 파일 내부 경로와 image binary를 화면·로그에 노출하지 않는다.
- 수집 실패가 공개 목록·상세와 수동 게시를 막지 않는다.
- 일반 Discord 채널 메시지를 감시하지 않는다.

#### 미정·차단·미검증 항목

- 차단: 출처별 약관·robots·parser spec 전 production 활성화 불가
- 미검증: source, contract test, browser

<a id="d01-promote-candidate-to-draft"></a>

### 후보 초안 승격

- 계약 상태: `초안`

#### 프로세스 목적과 범위

- 입력 근거: 이 문서의 기능 범위·요구사항 (§2~§6)
- 미검증: source, R2 runtime, transaction/orphan cleanup test, browser

운영자가 검수한 후보를 기존 게시글 초안으로 승격한다.

#### 행위자·시작 조건·선행 조건

- 행위자: 인증된 운영자
- 시작 조건: `NEW` 후보 상세에서 `초안으로 승격` 선택
- 선행 조건: 선택 이미지 1~20건과 각 이미지 alt·사용 가능한 파일 확보, M0 Core 초안 생성 경로 구현

#### 정상 흐름

1. 운영자가 제목, 출처, 사용할 이미지 후보, 각 alt와 선택 본문을 확인한다. 수동 파일은 기존 관리자 업로드 API에 먼저 올리고 받은 imageId를 해당 후보의 uploadedImageId로 지정한다.
2. 중복 게시글이 있으면 기존 게시글을 확인하고 승격 의사를 다시 확인한다.
3. 화면은 `POST /api/v1/admin/collect/candidates/{candidateId}/draft`를 호출한다.
4. Core는 후보 상태, lockVersion, 중복 확인, 게시판을 검증한다.
5. Core는 선택 이미지에 로컬 collector가 제출한 검증 파일 또는 운영자 업로드 파일이 있는지 확인한다.
6. Core는 원격 URL을 직접 fetch하지 않고 제출된 파일에 관리자 업로드와 같은 검증·metadata 제거·재인코딩을 적용한다.
7. Core는 private 원본 bucket에 저장한다.
8. Core는 기존 초안 생성 command를 재사용해 게시글과 block을 만든다.
9. Core는 후보를 `APPROVED`로 바꾸고 생성 `postId`를 연결한다.
10. 화면은 `/admin`의 기존 편집기에서 생성된 postId를 선택한다.

#### 대안·실패 흐름

- 중복 확인 누락: 기존 게시글 확인을 요구한다.
- 이미지 파일 제출 실패: 후보를 `NEW`로 유지하고 오류를 표시한다.
- 수집기 임시 이미지 파일 만료: 로컬 collector 재제출이 필요하다고 표시하고 후보를 `NEW`로 유지한다.
- transaction 실패: 후보를 `NEW`로 유지하고 저장된 이미지는 orphan 정리 대상으로 둔다.
- terminal 후보: 승격 버튼을 노출하지 않는다.

#### 단계별 호출 API 매핑

| 단계 | API |
| --- | --- |
| 3~8 | [후보 초안 승격](#api-promote-candidate-to-draft) |

#### 데이터·상태 전이

- `NEW` -> `APPROVED`
- `collect.candidate.post_id`에 생성된 `content.board_post.id` 연결
- 선택 이미지 후보는 저장 성공 후 `STORED`와 `image_id`를 가진다.
- 승격 성공·반려·만료·재시도 교체 시 로컬 수집기 임시 이미지 파일은 삭제 대상이다.

#### 권한·트랜잭션·멱등성·재시도

- 관리자 인증과 `Idempotency-Key`가 필요하다.
- 후보와 게시글 생성은 단일 논리 command로 처리한다.
- DB transaction 실패와 R2 object 보상 정리는 기존 이미지 cleanup 원칙을 따른다.

#### 완료 조건과 수용 기준

- 초안이 생성되고 기존 관리자 편집기로 이동한다.
- 후보는 `APPROVED` terminal 상태가 된다.
- 자동 발행하지 않는다.
- 외부 이미지 원본 URL이나 storage key를 공개 화면에 노출하지 않는다.
- 수집기 임시 파일 내부 경로를 화면·로그에 노출하지 않는다.

#### 미정·차단·미검증 항목

- 미검증: source, R2, transaction rollback, browser

<a id="d01-retry-or-reject-candidate"></a>

### 후보 재시도와 반려

- 계약 상태: `초안`

#### 프로세스 목적과 범위

- 입력 근거: 이 문서의 기능 범위·요구사항 (§2~§6)
- 미검증: source, test, browser

운영자가 실패 또는 미사용 후보를 재시도하거나 반려한다.

#### 행위자·시작 조건·선행 조건

- 행위자: 인증된 운영자
- 시작 조건: 후보 상세 또는 목록의 재시도·반려 선택
- 선행 조건: 후보가 `FETCH_FAILED` 또는 `NEW` 상태

#### 정상 흐름

1. 운영자가 `FETCH_FAILED` 후보에서 재시도를 선택한다.
2. 화면은 현재 `lockVersion`으로 retry API를 호출한다.
3. 성공하면 후보가 `PENDING`으로 돌아가고 로컬 collector 처리 대기 상태로 표시된다.
4. 운영자가 `NEW` 또는 `FETCH_FAILED` 후보에서 반려를 선택한다.
5. 화면은 반려 사유를 선택하게 한다.
6. Core는 `REJECTED`와 `reviewedAt`을 기록한다.

#### 대안·실패 흐름

- lockVersion 충돌: 최신 후보를 다시 불러오도록 안내한다.
- terminal 상태: 재시도·반려 버튼을 숨기거나 비활성화한다.
- 출처 비활성·robots 변경·상한 초과: 재시도 접수 후 collector 실패 결과가 반영되면 `FETCH_FAILED`와 일반화한 사유를 표시한다.

#### 단계별 호출 API 매핑

| 단계 | API |
| --- | --- |
| 2~3 | [후보 재시도](#api-retry-candidate) |
| 4~6 | [후보 반려](#api-reject-candidate) |

#### 데이터·상태 전이

- `FETCH_FAILED` -> `PENDING`
- `RUNNING` -> `NEW`
- `RUNNING` -> `FETCH_FAILED`
- `NEW` -> `REJECTED`
- `FETCH_FAILED` -> `REJECTED`

#### 권한·트랜잭션·멱등성·재시도

- 관리자 인증 필수.
- retry API는 외부 fetch를 직접 수행하지 않고 로컬 collector 작업을 다시 대기시킨다. collector는
  출처 상한과 robots를 재확인한다.
- reject는 외부 fetch를 수행하지 않는다.

#### 완료 조건과 수용 기준

- 재시도 결과와 반려 사유가 화면에 반영된다.
- 반려된 후보는 승격할 수 없다.
- 실패 사유는 일반화하고 내부 stack·HTML 원문은 노출하지 않는다.

#### 미정·차단·미검증 항목

- 미검증: source, contract test, browser

<a id="d08-collect-candidate-review"></a>

### 수집 후보 검수 화면

- 계약 상태: `초안`

#### 화면·프로그램 목적, route와 milestone

- route: `/admin/collect`
- 입력 근거: [화면 설계 §2 수집 후보 검수 화면](../../../planning/03-screen-design.md), 이 문서의 기능 범위·요구사항 (§2~§6)
- 미검증: source, browser, 접근성, 실제 image preview

운영자가 관리자 화면에서 후보를 만들거나 [로컬 Collector 프로그램](#d08-local-collector)이 Discord
`/collect url`로 만든 후보를 관리자 화면에서 검수·반려·초안 승격한다.

#### 진입·이탈·권한 조건

- 외부 관리자 인증 allowlist 통과 필요.
- 공개 경로에서 접근할 수 없다.
- Discord 명령은 로컬 collector가 허용 guild·channel·user만 처리하고 일반 메시지 감시는 하지 않는다.
- 초안 승격 성공 시 관리자 게시글 편집기로 이동한다.

#### UI 영역과 구성요소

- 원문 URL 입력란과 `후보 만들기`
- Discord `/collect url`로 생성된 후보의 상태 표시
- 후보 목록: 출처명, 제목, 원문 링크, 이미지 후보 수, 수집 시각, 상태, 중복 표시
- 후보 상세: 제목 편집, 원문 링크, 로컬 collector preview 또는 원격 URL metadata를 통한 이미지 후보 확인, 선택 checkbox, 실패·경고 요약
- 작업 버튼: `재시도`, `반려`, `초안으로 승격`
- 중복 확인 영역: 기존 게시글 링크와 확인 checkbox

#### 필드·표시값·validation

- URL은 `https` 형식만 client 1차 검증한다. 최종 검증은 서버가 한다.
- 반려 사유는 허용 code 중 하나를 선택한다.
- 이미지 선택은 1~20개이며 각 이미지 alt를 trim 후 1~300자로 입력한다. 수동 파일을 관리자 업로드 API로 올린 뒤 응답 imageId를 해당 candidateImageId의 uploadedImageId로 연결한다. 승격 요청은 선택 ID와 imageOptions를 함께 보낸다.
- 후보 제목이 없으면 승격 전 제목 입력을 요구한다.
- 내부 stack, 원문 HTML 전체, 수집기 임시 파일 내부 경로, storage key는 표시하지 않는다.

#### 이벤트·버튼·이동·후처리

| 이벤트 | 처리 |
| --- | --- |
| 후보 만들기 | 관리자 화면은 후보 작업 접수, 로컬 collector는 Discord 명령 처리와 결과 제출 |
| 재시도 | `retry-candidate` 호출 |
| 반려 | 사유 선택 후 `reject-candidate` 호출 |
| 초안으로 승격 | 중복 확인·선택 이미지 검증 후 `promote-candidate-to-draft` 호출 |
| 원문 열기 | 새 창, `rel="noopener noreferrer"` |

#### loading·empty·error·권한 없음·부분 실패 상태

- loading: 후보 만들기와 승격 중 버튼 중복 클릭을 막는다.
- empty: 아직 후보가 없으면 URL 입력을 주요 행동으로 둔다.
- error: 서버 error code에 맞춰 일반화된 메시지를 표시한다.
- 권한 없음: 관리자 인증 화면 또는 접근 불가 상태로 보낸다.
- 부분 실패: 이미지 후보 일부 누락은 경고로 표시하되 승격 가능 여부는 선택 이미지 기준으로 판단한다.
- 임시 preview 만료: 로컬 collector의 preview 재제출 또는 운영자 파일 업로드가 필요하다는 메시지를 표시한다. 서버는 원격 이미지를 가져오지 않는다.

#### 반응형과 접근성

- 360px 이상에서 가로 스크롤 없이 목록과 상세를 사용할 수 있어야 한다.
- 이미지 선택 checkbox는 키보드 조작 가능해야 한다.
- 작업 버튼은 상태별로 disabled reason을 screen reader가 알 수 있어야 한다.
- 외부 원문 링크는 새 창 열림을 접근성 이름에 포함한다.

#### 이벤트별 D01·API 매핑

| UI 이벤트 | D01 | API |
| --- | --- | --- |
| 후보 만들기 | [URL 후보 생성과 검수](#d01-create-and-review-candidate) | [create-candidate-from-url](#api-create-candidate-from-url) |
| Discord `/collect url` 결과 검수 | [URL 후보 생성과 검수](#d01-create-and-review-candidate) | [collector-internal-api](#api-collector-internal-api), [로컬 Collector 프로그램](#d08-local-collector) |
| 재시도 | [후보 재시도와 반려](#d01-retry-or-reject-candidate) | [retry-candidate](#api-retry-candidate) |
| 반려 | [후보 재시도와 반려](#d01-retry-or-reject-candidate) | [reject-candidate](#api-reject-candidate) |
| 초안으로 승격 | [후보 초안 승격](#d01-promote-candidate-to-draft) | [promote-candidate-to-draft](#api-promote-candidate-to-draft) |

#### 메시지와 사용자 피드백

- 허용되지 않은 출처입니다.
- 이 경로는 수집할 수 없습니다.
- 잠시 후 다시 시도해 주세요.
- 같은 원문 후보가 이미 있습니다.
- 후보를 반려했습니다.
- 초안으로 만들었습니다.

#### 화면 수용 조건

- 후보 생성은 후보 또는 명시적 실패 상태로 끝난다.
- 실패 후보는 재시도 또는 반려만 가능하다.
- 승격 성공 뒤 자동 발행하지 않고 편집기로 이동한다.
- 원문 HTML 전체와 내부 오류 상세를 화면에 노출하지 않는다.
- 수집기 임시 파일 내부 경로와 image binary를 화면에 노출하지 않는다.

#### 미정·차단·미검증 항목

- 출처 설정은 [출처 조회·설정](#api-source-management)의 계약을 따른다.
- 차단: 출처별 source spec의 운영 위험·기술 gate 확인 전 production 활성화 불가
- 미검증: source, browser, 접근성, 실제 image preview

<a id="d08-local-collector"></a>

### 로컬 Spring Collector 프로그램

- 계약 상태: `초안`

- 입력 근거: [콘텐츠 수집 기획 §3.2](../../../planning/content-collection/README.md), [시스템 아키텍처 §4·§5](../../../system-design/01-system-architecture.md), [인프라 설계 §6](../../../system-design/04-infrastructure-design.md), [보안·운영 §4 수집](../../../system-design/05-security-operations.md), [Collector 내부 API](#api-collector-internal-api)
- 미검증: collector source, Discord Gateway·Slash Command, 실제 출처 fetch, local secret 저장, contract test, runtime

#### 프로그램 목적·route·milestone

운영자 로컬 컴퓨터의 별도 Spring Boot 상시 서버는 `http://127.0.0.1:18787`에서만 제어 REST를 제공한다.
Discord `/collect url`, 로컬 REST, 기본 비활성 Quartz가 같은 실행 경로로 접수된 후보 한 건을 처리한다.
BE·FE runtime은 외부 사이트를 fetch하지 않으며, `/collect status`와 local status 조회는 읽기 전용이고 새 Job을 만들지 않는다.
포트·scope·응답 상세는 [07 상세 설계 §11](../../../system-design/07-spring-collector-design.md#11-로컬-restdiscord-보안)를 따른다.

- `POST /local/v1/jobs/collect`는 `mode=COLLECT|PREVIEW_REFRESH`, 선택 `candidateId`, `lockVersion`, `nextPending`만 받는다. 새 수동 `PREVIEW_REFRESH`는 관리자 검수 응답의 candidateId와 현재 lockVersion이 필수다. 같은 execution의 자동 restart는 `execution-state`에서 재확인한 version을 사용한다.
- `COLLECT`는 candidateId 또는 `nextPending=true` 중 정확히 하나가 필요하며 원문 URL을 받지 않는다. 요청은 loopback bearer scope와 `Idempotency-Key`를 거쳐 202의 jobRequestId·QUEUED/RUNNING 상태 또는 동일 요청의 replay를 받는다.

#### 진입·이탈·권한 조건

- 실행 주체는 승인된 운영자 로컬 PC다.
- Discord 명령은 허용 guild, channel, user만 처리한다.
- Web 전용 중계를 통한 Core 내부 API 호출에는 collector service token이 필요하다.
- token, Discord bot token, webhook URL은 macOS Keychain 등 로컬 secret 경계에 두며 plist argument·환경 변수·Git에 넣지 않는다.
- 종료되거나 네트워크가 끊겨도 공개 목록·상세, 관리자 수동 작성과 발행은 계속 동작해야 한다.

#### UI 영역과 구성요소

현재 확정된 배치 관리 UI는 없다. 기존 FE 검수 화면은 유지하며 local REST는 loopback bearer scope와 state-changing 요청의 `Idempotency-Key`를 사용한다.

- stdout/stderr에는 실행 상태, 처리 후보 수, 일반화된 오류 code만 출력한다.
- 원문 URL 전체, 후보 제목 전체, 원문 HTML, 이미지 binary, local temp path, token, stack trace는 출력하지 않는다.
- Discord 응답은 접수·실패·완료 상태를 짧게 알리고 내부 오류 상세를 노출하지 않는다.

#### 필드·표시값·validation

- `collectorId`: 운영 환경에서 고유해야 하며 log와 API 요청에 사용한다.
- `COLLECTOR_API_BASE_URL`: service origin의 `/api/collector/v1` HTTPS 중계 주소. Core 직접 주소를 사용하지 않는다.
- `COLLECTOR_SERVICE_TOKEN`: Core 내부 API 전용 bearer token.
- `DISCORD_BOT_TOKEN`, `DISCORD_ALLOWED_GUILD_ID`, `DISCORD_ALLOWED_CHANNEL_ID`, `DISCORD_ALLOWED_USER_IDS`: Discord 명령 수신 gate.
- `COLLECT_MAX_RESPONSE_BYTES`, `COLLECT_TIMEOUT_MS`, `COLLECT_USER_AGENT`: 출처 요청 제한.
- 출처 host, robots, 요청 간격, Core quota reservation, DNS 안전성, 같은 host 안의 redirect 3회 제한은 fetch 직전 다시 확인한다.
- `https`가 아니거나 사설·loopback·link-local·metadata 주소로 해석되는 대상은 요청하지 않는다.

#### 이벤트·후처리

| 이벤트 | 처리 |
| --- | --- |
| process start | local PostgreSQL·spool·Core BFF readiness를 점검한다. Discord 연결은 별도 component 상태다. |
| Discord `/collect url` | 허용 guild·channel·user·role과 확인 interaction 뒤 공통 실행 요청을 만든다. |
| Discord `/collect status` | local Job과 Core 집계를 분리해 읽기 전용 요약을 낸다. 새 Job을 만들지 않는다. |
| Quartz / REST 실행 | `CollectorRunService.submit()`으로 공통 실행 요청을 만들며, Quartz는 15분 주기·기본 비활성이고 신규 목록 URL을 찾지 않는다. |
| Batch 후보 처리 | 후보 1건의 `resolveCandidate` → `claimCandidate` → `fetchAndExtract` → `submitResult` → `uploadPreviews` → `notifyAndFinalize` 여섯 Tasklet Step을 순서대로 실행한다. 기본 active Job은 1개다. |
| heartbeat · quota | RUNNING fetch 중 heartbeat를 연장하고, robots·상세·redirect·image 각 실제 HTTP 전에 Core reservation을 받는다. |
| shutdown | 새 Step·reservation을 막고, 이미 시작한 network 요청은 제한 timeout까지 기다린다. 90초 유예 뒤 미완료 Job은 restartable STOPPED로 남기며 lease 회수에 맡긴다. |

#### 프로그램 상태

- `disabled`: local flag 또는 필수 secret 부재로 실행하지 않음
- `ready`: local DB·spool·Core BFF가 준비된 실행 경로. Discord 연결은 별도 상태
- `idle`: 처리 가능한 후보 없음
- `running`: 후보 1건 처리 중
- `rate_limited`: 출처 요청 간격 또는 일일 상한 초과
- `blocked`: robots 금지, host 비활성, DNS·redirect·content-type·응답 크기 제한으로 fetch 차단
- `failed`: Core API, Discord, parser, preview upload 오류

오류는 후보별 실패와 프로세스 치명 오류를 구분한다. 후보별 실패는 공개 서비스 장애로 확대하지 않는다.

#### 반응형과 접근성

배치 관리 UI는 미정이다. 운영 출력은 색 없이도 상태와 exit code를 구분할 수 있어야 하며, 비대화형 실행과 로그 수집이 가능해야 한다.

#### 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| Discord `/collect url` 또는 관리자 후보 claim | [URL 후보 생성과 검수](#d01-create-and-review-candidate) | [collector-internal-api](#api-collector-internal-api), [create-candidate-from-url](#api-create-candidate-from-url) |
| 실패 후보 재처리 | [후보 재시도와 반려](#d01-retry-or-reject-candidate) | [retry-candidate](#api-retry-candidate), [collector-internal-api](#api-collector-internal-api) |
| preview 재업로드 | [로컬 Collector 프로그램](#d08-local-collector) | [collector-internal-api](#api-collector-internal-api)의 `PREVIEW_REFRESH` |

#### 메시지와 사용자 피드백

- Discord: 후보 생성을 접수했습니다.
- Discord: 허용되지 않은 채널 또는 사용자입니다.
- Discord: 이 URL은 수집할 수 없습니다.
- Discord: 후보 생성에 실패했습니다. 관리자 화면에서 사유를 확인해 주세요.
- CLI: `ready`, `idle`, `processing`, `submitted`, `blocked`, `failed` 상태와 일반 오류 code를 출력한다.

#### 프로그램 수용 조건

- BE·FE runtime이 외부 사이트를 직접 fetch하지 않는다.
- Discord 일반 메시지를 감시하지 않고 초기 명령인 `/collect url`과 읽기 전용 `/collect status`만 처리한다.
- 등록·활성 출처, robots, 요청 상한, DNS 안전성, redirect, content-type, 응답 크기, timeout gate를 fetch 직전 적용한다.
- 성공 결과는 원문 HTML·이미지 binary·local temp path 없이 `result`에 metadata만 제출하고, 이후 별도
  preview 업로드 성공 응답의 식별자만 사용한다.
- 실패 결과는 `FETCH_FAILED`와 허용된 `fetchErrorCode`로 남긴다.
- collector 중단·lease 만료 뒤 후보는 재선점 가능하고 공개 목록·상세와 수동 발행은 계속 동작한다.
- token과 Discord secret이 log, Discord 메시지, Git, error response에 남지 않는다.

#### 미정·차단·미검증

- 결정 필요: 실제 실행 PC·전용 OS 계정·설치 경로, 선택 JDK 배포판의 운영 조건.
- 구조 결정: 출처별 parser package와 테스트 배치는 [사이트별 모듈 계약](../../../system-design/08-code-structure.md#collector-site-modules)을 따른다.
  21개 사이트의 독립 adapter·상세 parser와 19개 목록 parser를 분리했고 기존 fixture 경로를 보존했다.
  이는 구조 변경의 로컬 검증이며 아래 실연동 미검증 항목을 완료로 바꾸지 않는다.
- 차단: 출처별 source spec의 운영 위험·robots 확인 전 production 활성화 불가.
- 미검증: source, Discord Gateway·Slash Command, 실제 출처 fetch, Core/local migration, OpenAPI, contract·fault test, build, runtime.

<a id="api-source-management"></a>

### 출처 조회·설정과 관리 화면

- 계약: [시스템 API의 수집 출처](../../../system-design/03-api-design.md#수집-출처). GET/PATCH 형식·충돌·감사 처리는 여기서 재정의하지 않는다.
- 화면: `/admin/collect/sources`, 관리자 인증, 등록 목록과 선택 출처의 설정을 같은 화면에서 편집한다.
- M0 수집 보조에서는 활성 여부·요청 간격·일일 상한·robots 확인 결과를 편집한다. 출처 식별 정보는 읽기 전용,
  목록 수집은 V007 opt-in과 출처별 검증·정책 승인 전까지 비활성이다. 생성·삭제 버튼은 없다.
- 저장 중 중복 제출을 막고 현재 lockVersion을 보낸다. 성공하면 반환값으로 목록과 편집값을 함께 교체한다.
  version 충돌이면 재조회 후 운영자가 다시 선택하며 자동 덮어쓰지 않는다.
- loading·등록 출처 없음·조회 실패·저장 실패를 구분한다. 실패 시 입력을 유지하고 일반화한 사유를 표시한다.
- 검증: 1000ms·상한 1/10000 경계, 미허용 필드·설정 조합, robots 재확인/null 해제,
  경쟁 수정·응답 유실·유지보수 읽기/쓰기 분리를 확인한다. source·browser 검증은 새 구현에서 수행한다.

## Spring 전환: Job 계약과 검증 경계

- 확정된 구현 기준은 [07 Spring 수집 서버 상세 설계](../../../system-design/07-spring-collector-design.md)다. `apps/collector`, 전용 local PostgreSQL 18의 Batch·Quartz·collector schema, AES-256-GCM local spool, 기본 동시 실행 1, 15분 Quartz 기본 비활성, legacy→`SPRING_V2` cutover를 따른다.
- legacy 수동 Spring 경로는 service DB·object storage credential을 갖지 않고 Core API로 후보·preview를 변경한다. direct
  batch 경로는 별도 batch DB role과 `collect/raw`, `collect/media`, `collect/report` object-store prefix만 사용한다.
  어느 경로도 title·origin URL·HTML·image binary·token·절대 경로를 일반 로그에 남기지 않는다.
- 승인된 수집 결과를 `/meme` 공개 화면에 노출하는 것은 batch가 아니라 API 검수·승격 단계의 책임이다. 승격 단계는 `collect/media/*`를 public key로 직접 쓰지 않고, 이미지를 `content/published/posts/{postId}/{imageId}-{sha256}.{ext}`로 복사한 뒤 `content.board_post_image.public_storage_key`에 저장한다.
- 구현 수용은 여섯 Step checkpoint, same-key replay, stale execution fencing, Core quota/permit, spool TTL, stop·restart·reconcile, REST·Discord·Quartz 공통 경로와 legacy drain을 07의 수용 시험으로 검증한다.
- source·migration·OpenAPI 구현과 격리 환경 test·build·runtime 결과는 [M0 검증 기록](../../../implementation/m0-completion/evidence.md)에 기록한다. 실제 출처·Discord·운영 배포·법무 승인·7일 관찰은 미검증이다. 이전 Python/Core 테스트나 이 문서의 설계 확정만으로 Spring 전체 완료를 판단하지 않는다.


## 원문 수집 확장 (2026-09-20)

- 설계 상태: `작성 완료`. source·migration·test·다른 PC 설치·실제 Discord 검증은 문서 작성과 별도다.
- 상위 결정: [수집 기획 §1.1](../../../planning/content-collection/README.md#11-원문-수집-확장--2026-09-20-결정).
  공통 기술 계약: [Spring 설계 §16](../../../system-design/07-spring-collector-design.md#16-원문-수집과-별도-pc-실행-확장).
- 기존 위 절의 metadata-only 결과·이미지 최소 1건·leadText 승격 규칙은 contentBlocks가 없는 후보에 유지한다.
  contentBlocks가 있는 원문 후보는 위 §16과 [OpenAPI](../openapi/m0-collection-assist.yaml)의 확장 계약을 적용한다.
- API: collectorResult는 optional contentBlocks를 저장한다. getCollectionCandidate는 관리자 상세에 이를 반환한다.
  promoteCollectionCandidate는 전체 첨부 선택·준비를 검사하고 저장된 순서대로 TEXT/IMAGE/LINK를 초안에 옮긴다.
  TEXT/SNS-only는 이미지 0건도 허용하며 원문 모드의 leadText·부분 선택은 VALIDATION_FAILED다.
- 흐름: 다른 PC의 URL REST 또는 Discord → Core 접수 → 공통 local queue → 기존 여섯 Batch Step →
  관리자 원문 검수 → 초안 승격. Quartz는 접수된 대기 후보만 처리하고 공개 서버에는 scheduler를 설치하지 않는다.
- 화면: 원문 모드의 텍스트·링크·첨부 순서를 읽기 전용으로 미리 보여준다. 모든 이미지를 자동 선택하고
  부분 선택을 막는다. alt·대체 업로드는 가능하다. 첨부 preview 누락·만료는 승격 전 오류로 표시한다.
  metadata 후보의 기존 선택 UI는 유지한다. SNS 네트워크 로딩 없이 원문 링크로 검수할 수 있다.
- 수용: 원문 순서·무손실 한도 거부·TEXT-only·CDN 경계·DB readback·멱등·중복·중단 후 재개·부분 승격 차단을
  source/test로 검증한다. 실제 원격 PC와 Discord credential·운영 활성화는 격리 검증으로 대신하지 않는다.

- 실행 OS 추가 결정: macOS·Windows·Docker/Linux를 대상으로 한다. 공통 파일 secret backend·POSIX/ACL 권한 검사와
  URL 요청 파일 CLI를 제공하고 OS별 자동 시작은 [수집기 운영 안내](../../../../apps/collector/ops/README.md)를 따른다.
  macOS 테스트로 Windows 실운영을 통과 처리하지 않는다.

## 2026-09-21: 자동 수집 공통 경로 확장

- 설계 상태: 작성 완료·구현/실연동 검증 진행. 기존 단건 계약은 유지하고 자동 수집 진입점을 추가한다.
- 상위 정본: [수집 기획](../../../planning/content-collection/README.md),
  [Spring 설계 §17](../../../system-design/07-spring-collector-design.md#17-hottop-discovery와-출처-registry-2026-09-21).
- 출처·fixture·차단과 완료 상태는 [검증표](../../../planning/content-collection/reference-site-validation.md)를 따른다.
- Discord는 권한 검증→registry 출처·상세 URL 확인→확인 버튼→동일 registry 재검사→후보 접수→공통 queue.
  Core 숫자 sourceId와 파일의 source key를 같은 값으로 가정하지 않는다.
- batch CLI는 유효한 옵션·출처 정책 gate→robots→목록 parser→페이지/기간/글 수 제한→canonical/post key 중복 제거
  →상세 parser→`collect.batch_*`와 batch object store 저장 순으로 처리한다. `HOT_LIST`(hot)와 `GENERAL_LIST`(latest)의 검증된 목록을 조회하고,
  `DETAIL_ONLY`는 상세 URL만 처리하며 `BLOCKED`·`UNVERIFIED`는 실행하지 않는다. dry-run은 DB와 object store를 쓰지 않는다.
- 21개 중 parser/fixture/robots/정책이 미확인인 출처는 blocked 코드로 보고한다.
  BLOCKED adapter에 OG metadata fallback을 제공하지 않는다. 파일 링크 보존과 binary 다운로드 성공을 구분한다.
- 사진 후보는 lazy-load 속성(`data-src`, `data-original`, `data-original-src`, `data-lazy-src`), `srcset`/`data-srcset`,
  CSS `background-image`까지 파싱하되 허용 CDN policy를 통과한 URL만 저장한다.
- mp4/mov/mp3/wav는 아직 수집기 object store에 다운로드하지 않는다. 원문 내 URL은 LINK 블록으로 보존하고,
  추후 영상 보존 정책·용량·저작권·트랜스코딩·플레이어 계약이 정리된 뒤 별도 attachment kind로 확장한다.
- Hot/Top 목록은 공지/필독/운영 안내 row를 제외한다. 구조적 notice class·badge·제목 prefix를 기준으로 하며,
  일반 게시글 제목 중간의 단어만으로는 제외하지 않는다.
- 수용: registry 오매핑, query robots, 반복 pagination, 0건/삭제/차단/빈 본문/이미지 없음/SNS-only,
  중복·since·상한·간격·재시도·dry-run 무쓰기·DB readback·Discord 확인 전 무쓰기를 검사한다.
  CLI exit 0은 해당 실행 계약 성공일 뿐 21개 전체 완료를 뜻하지 않는다.

### 사이트별 모듈 분리 수용 기준

- 구현 기준은 [코드 구조의 사이트별 모듈 계약](../../../system-design/08-code-structure.md#collector-site-modules)이다.
  2026-09-23 사이트별 패키지·독립 parser 파일을 분리했다. `SiteAdapters.java`에는 조립만 남기며
  분리 전후 결과와 실행 검증은 위 모듈 계약에서 연결하는 결과 문서를 따른다.
- 사이트 adapter는 URL 식별·canonical·source post key와 parser 조합을 맡는다. 지원하는 목록 parser와
  상세 parser는 별도 파일·fixture 테스트로 분리하고, 본문 순서 보존 등 공통 처리는 재사용한다.
  목록 미지원 사이트는 미지원 사유와 상세 전용 정책을 유지하며 형식적인 목록 parser로 통과시키지 않는다.
- parser는 입력 HTML/API 응답만 해석한다. 네트워크·queue·중복 조회·재시도·DB/S3 저장·report는 공통 계층이 맡는다.
  사이트별 수정은 해당 fixture를 우선 검증하고 공통 처리 수정은 영향받는 전체 사이트 fixture를 검증한다.
- 분리 전후 본문·이미지·첨부·SNS·canonical/post key 결과 보존과 공통 runner 회귀를 확인한다.
  파일 분리·fixture 통과와 live URL·DB/S3 readback·Discord Gateway 완료 판정은 각각 기록한다.

### 현재 실행 계약

- OpenAPI의 candidate 생성은 선택 `discoveryMode`(기본 MANUAL_URL, 추가 LIST_CRAWL)를 받는다.
  목록 quota 예약은 `discovery:true`, requestKind ROBOTS/LIST/REDIRECT이며 candidateId/lockVersion을 보내면 거부한다.
- V007은 기존 API 후보 호환을 위한 migration이다. direct batch는 collector V002/V003/V004의 `collect.batch_*`를 직접 쓰며,
  글마다 Core API를 호출하지 않는다. batch DB role과 API 조회 role을 분리하고 서비스 DB credential을 batch에 배포하지 않는다.
- API 결과 NEW는 검수 대기이며 게시 완료가 아니다. batch CLI QUEUED는 상세 완료가 아니다.
  캡처한 원본 HTML의 격리 DB readback은 live 목록→상세→이미지 다운로드 E2E를 대체하지 않는다.
- 이 명세의 이전 MANUAL_URL 전용 설명은 URL 접수 기준이다. 목록 CLI 확장에는 이 절과 최신 OpenAPI를 적용한다.


## 2026-09-23 batch 고도화 계약

- 원문/초안/편집/공개 응답은 최대 1000블록을 보존한다. TEXT 블록 20,000자, 이미지 200개, HTTP 요청 크기 제한은 별도로 검증한다. 한도 초과를 잘라 성공시키지 않는다.
- 출처 URL은 HTTPS URL로 검증한 뒤 URL 직렬화(percent encoding)하여 저장·응답한다. 이미 인코딩된 URL은 중복 인코딩하지 않는다.
- 기존 로컬 공개 파일은 hash/size/MIME/dimensions/decode 대조 뒤 private 사본을 복구할 수 있다. 복구 manifest와 compare-and-set을 사용하고 기존 파일을 덮어쓰지 않는다. 이는 정식 batch 승격 검증을 대체하지 않는다.
- direct batch 검수 API는 [2026-09-23 direct batch 구현 계약](../../../system-design/07-spring-collector-design.md#2026-09-23-direct-batch-검수승격-구현-계약)을 따른다. legacy candidate 상태를 batch item 상태로 재사용하지 않는다.

### Direct 검수 화면과 실패 복구

- `/admin`과 `/admin/batch`의 관리 메뉴는 기존 Web batch 검수 flag가 켜졌을 때만 수집 결과 검수를 표시한다.
  인증된 `/api/admin/features`는 메뉴 표시용 boolean만 제공한다. Core/BFF의 실제 인증·feature gate는 독립 적용한다.
- 목록 GET은 `source`, `state`, `reviewStatus`, `page`를 조합한다. 검수 행이 없는 item은 `UNREVIEWED`다.
  전체 건수·목록에 같은 조건을 적용하며 페이지 이동은 마지막 조회 조건을 유지한다. 검수로 마지막 페이지가
  비면 유효한 페이지로 이동한다. 조회 실패 때 기존 목록·페이지를 보존하고 다시 조회할 수 있다.
- 원문 본문·인증 이미지 preview·첨부 원문 링크·수집 실패/기간 제외 사유를 표시한다.
  이미지 실패를 정상 표시로 처리하지 않으며 원문 확인과 preview 재시도를 제공한다.
- 검수·초안 생성은 중복 클릭을 막는다. 응답 유실 또는 저장 후 상세 조회 실패 시 요청 본문·키를 보존하고,
  401/403을 만나도 같은 요청으로 결과를 확인한다. 확인 전 입력·다른 글 선택·화면 이동을 잠근다.
  확정 충돌/중복 거부는 편집·재조회로 돌아갈 수 있으며 목록 갱신 실패가 확인된 저장 성공을 취소하지 않는다.
- 초안 링크는 `/admin?postId=<id>`로 선택한 글을 바로 연다. 검수·승격으로 공개 상태나 public object를 만들지 않는다.
- 이 화면은 batch가 이미 저장한 결과의 검수 경로다. legacy URL 접수와 source 수정 화면을 direct 메뉴에 연결하지 않는다.
  URL 전달·source 소유권 계약, 실제 Access·운영자 인수·원격 object 수용은 별도다.

### Batch 검수 snapshot과 제목 보정

REVIEWING 시 원문/미디어 snapshot digest를 고정한다. 승인·승격에서 내용 또는 media hash/key가 바뀌면
BATCH_ITEM_VERSION_CONFLICT로 거부하고 재검수를 요구한다. 목록 조회는 개별 본문 검증과 분리해 손상된
본문 하나가 목록 전체를 막지 않게 한다. DRAFT 응답은 게시글 lockVersion과 reviewLockVersion을 구분한다.
운영자는 초안 승격 요청에 title(1~200자)을 지정할 수 있다. 생략한 원문 제목이 한도를 넘으면 실패한다.

수집 이미지 미리보기와 초안 승격은 동일한 수집 전용 이미지 검증을 사용한다. 파일당 30MiB,
최대 500프레임, 한 프레임 40,000,000픽셀을 유지한다. 전체64Mi픽셀 초과 GIF/WebP는
[분할 검사 계약](../../../system-design/07-spring-collector-design.md#큰-수집-애니메이션의-분할-검사)의 순차 전체프레임 검사·컨테이너 정제를 적용하며 총200,000,000프레임픽셀을 넘으면 거부한다. 일반 수동 업로드의 200프레임 제한은 유지한다. GIF 중복 프레임·지연·반복 정보를
보존하며 첫 프레임만 추출해 성공 처리하지 않는다. 검수 화면의 이미지 실패 안내는 원문 확인
링크를 제공하고 일부 이미지 실패를 정상 preview로 표시하지 않는다.

### Batch 저장 실행 소유권

Collector V003은 source당 RUNNING 하나와 session 잠금 연결의 쓰기 권한을 강제한다.
연결 상실 뒤 새 pool 연결로 이어 쓰지 않으며, 완료 run/FETCHED item/media는 수정하지 않는다.
재시도 object는 실행별 prefix로 분리해 이전 실행의 늦은 PUT이 새 실행을 덮어쓰지 못한다.
report key/hash/행 수와 checkpoint는 run 종료와 같은 transaction에 기록하고 실제 object를 readback한다.
V004에서는 상세 fetch 전 item을 FETCHING claim하고 fetch/parse 실패를 개별 FAILED/BLOCKED와
실패 phase/code로 기록한다. 날짜 제외는 SKIPPED_POLICY와 skipReason으로 구분한다.
API 목록·상세의 failureCode/skipReason은 검수 화면에 표시하며 FETCHED 외 상태는 승격하지 않는다.
기존 item 없는 failure 행은 과거 증거로 유지한다.

## 2026-09-23 Discord direct queue 정렬

Discord 확인은 batch 소유 confirmation/queue에 원자적으로 접수한다. request와 실행 attempt를 분리하여 중복 확인·중단 후 재개를 처리하며, 수집은 API 호출 없이 공통 상세 parser와 DB/object pipeline을 사용한다. source lock·version·최대 3회 재시도·30초 지수 backoff를 적용하고 차단/삭제/parser/크기 제한/rate-limit은 자동 재시도하지 않는다. 실제 Gateway 검증은 독립 완료 조건으로 유지한다. 상세 계약은 Spring 수집 설계의 Direct batch Discord 대기열 계약을 따른다.


## 2026-09-23 다중 이미지와 수집 용량 계약

- 처리 시간과 응답 유실 재시도는 [다중 이미지 시간 계약](../../../system-design/07-spring-collector-design.md#2026-09-23-다중-이미지와-수집-용량-계약)을 따른다. Web은 초안 180초·preview 60초를 기다리고, API는 이미지 준비 단계의 120초 예산 초과를 검사해 사본을 회수한다. 같은 멱등 키와 본문을 사용해야 확정된 기존 초안을 안전하게 돌려받는다.
- direct batch는 원문 이미지 최대 200개, 첨부 최대 20개, 본문 최대 1000블록을 보존한다. 초과한 원문을 잘라 성공 처리하지 않는다.
- source 설정 `mediaLimits`의 `maxImages`(1~200), `maxFileBytes`(1~31457280), `maxTotalBytes`(1~157286400)는 생략하면 각 상한을 기본값으로 사용한다. 사이트별로 낮출 수 있고 전역 상한을 높일 수 없다.
- 파일당 30MiB, 이미지와 첨부를 합친 글당 150MiB를 순차 다운로드 중 검증한다. 남은 용량을 넘는 파일은 object 저장 전에 실패한다. HTML 원문 30MiB 제한은 별도다.
- API 수집 이미지 preview/초안 승격은 동일한 30MiB 입력 한도를 사용한다. 승격 전에 모든 media의 크기 합계 150MiB를 확인하며, 재인코딩한 이미지도 개별 30MiB·합계 150MiB를 넘으면 쓰기 전에 거부한다. 이미 준비한 사본은 기존 실패 복구 경로로 회수한다.
- 일반 관리자 업로드 요청의 파일당 10MiB·요청당 10개/100MiB와 이미지 픽셀·애니메이션 디코딩 한도는 유지한다. 게시글 편집 계약은 200장까지 허용해 수집 초안을 내용 손실 없이 편집할 수 있다.
- 레거시 candidate/metadata 선택 이미지 20개 계약과 direct batch를 구분한다. DB migration으로 기존 결과를 강제로 성공 처리하지 않는다.
- 인벤의 본문 바깥 첨부 영역과 일반 텍스트 파일 URL은 [인벤 첨부 계약](../../../system-design/07-spring-collector-design.md#인벤-첨부-영역과-파일-참조)을 따른다. 다운로드 아이콘은 본문 이미지에 넣지 않으며 반복된 파일 URL은 LINK를 보존하면서 파일 저장만 한 번 수행한다.
- `SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED`는 해당 글 실패이며 다음 글 수집을 중단시키는 사이트 오류로 누적하지 않는다.
- 검증은 20장 초과 성공, 200장 경계와 201장 실패, 설정 상한 거부, 전체 용량 초과 무쓰기, 승격 실패 복구, 실제 실패 글 재수집·DB/object readback을 각각 증거로 남긴다.


과거 완료 IMAGE의 MIME 정정은 [Batch V006 계약](../../../system-design/07-spring-collector-design.md#batch-v006-완료-이미지-mime-정정)을 따른다. runtime은 완료 media를 수정할 수 없으며, 소유자 전용 감사 함수가 파일 검증 manifest의 기대값과 일치하는 MIME만 정정한다. API 검수 digest가 달라진 미승격 결과는 재검수가 필요하다.
