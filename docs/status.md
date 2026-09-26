# M0 현재 진행 상황

> 2026-09-25 전달 상태: 현재 checkout은 검토용 `feature/HARN-09-ci-diagnostics`다. 원본 stash와 복구 branch `5957492`, 기존 PR #1/#2를 보존하고 새 Draft PR #3~#8을 생성했다. 실제 분리 범위·검증·선행 관계는 [CI 복구·전달 기록](../worklog/2026-09-25/git-governance/CI-RECOVERY.md)을 따른다. develop 통합·원격 보호·배포는 미완료다.

- **전체 판정: 부분 완료. 9월 25일 SHA `8af7244`의 CI·API/Web 운영 배포·GTM 실제 로딩을 확인했다. DB는 API V008·Collector V006을 유지하며, 실제 운영자 인수와 수집 실연동·계약은 남아 있다.**
- 기본 현황: [9월 25일 운영 배포·검증](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)을 반영했다. 9월 23일 DB·콘텐츠 전수 대조와 9월 25일 앱 교체·공개 응답 검증은 [운영 상태](operations/current-status.md)에서 날짜별로 구분한다.
- Git·배포 식별자를 구분한다. 운영 앱은 `8af7244`이며 후속 문서 커밋·다른 세션의 미커밋 변경은 해당 이미지에 포함되지 않는다. [9월 24일 Git 관측](../worklog/2026-09-24/documentation-refresh/EVIDENCE.md)은 당시 기록이다.
- 과거 전체 goal의 `blocked` 기록은 당시 선행 조건 판단이다. 현재 도구 상태나 기능 폐기를 뜻하지 않는다.
- 상세 실행 순서는 [잔여 과정](roadmap.md), 실제 커밋 식별자는 [진행 보관·커밋 기록](../worklog/2026-09-23/progress-checkpoint.md)을 따른다.

## 완료 범위와 남은 조건

| 작업                    | 현재 완료 범위                                                                                                                                | 남은 조건                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Core 관리자 P0-01~03    | 최소 화면·검색·오류 복구·저장 결과 확인·인증 실패 뒤 동일 요청 보존                                                                           | 실제 운영자 사용성·Access 인증 확인                                                                           |
| 로컬 실행 P0-04         | 격리 실행기의 예약·이미지 회수 worker, 중복 소유 방지·재시작·실패 복구와 실제 시각 검증                                                       | 운영자가 직접 수행하는 인수 12건                                                                              |
| CI A-1/P1-07            | Java fixture·Collector job·로컬 macOS/Linux 재현. SHA `8af7244`의 원격 verify/collector/API·Web images 성공·digest 확인                       | 다음 후보 SHA의 원격 CI·digest 확인, Windows·별도 PC 검증                                                     |
| Direct 검수 P1-02       | 정식 메뉴·필터·검수/반려·초안 이동·불확실 응답 복구. 9/23 운영 검수 flag ON, 내부 service 108건 조회·16개 출처 미리보기                       | 실제 MFA 운영자 화면 조작·Access·원격 object 인수. QD-04 보존·고지 별도                                       |
| 사이트 모듈 P1-06       | 21 adapter·21 상세·19 목록 parser 분리, 기존 결과 보존                                                                                        | direct robots/Crawl-delay·영속 일일 budget·redirect 상한 보완, 누락 실제 표본·차단 4개 재개 조건              |
| 문서 정합성 P1-01       | D01~D03의 direct/legacy 저장·권한·검수 규칙 정렬                                                                                              | Web 입력/source 변경 권한 QD-03, 보존·고지 계약 QD-04, legacy API/DB 본문 상한 1000/40 불일치                 |
| 배포·DB 반영 P0-05      | 9/25 `8af7244` API/Web 교체·GTM 로딩·새 백업 복원·timer 재개 확인. API V008·Collector V006 유지. 9/23 게시글 74·이미지 308 공개·전수 readback | 실제 MFA 작성/업로드/발행/숨김·예약/알림 인수, 다음 후보별 호환성·백업·복귀 확인. 실제 rollback·재부팅 미검증 |
| 수집 실연동 P1-03~05/07 | 로컬 코드·격리 증거와 실행서 준비                                                                                                             | 다른 PC/Windows·비운영 DB/object·Discord·보존 회수 구현/검증                                                  |
| 운영 관찰 P2            | 관찰 조건 정의                                                                                                                                | 실제 운영 개시 후 7일 기록                                                                                    |

## 분석 확장 analytics-v1 — 2026-09-25 명세 확정

- [개발 명세 §13](development-specs/m0-core/analytics-consent/analytics-consent.dev.md#analytics-v1)에 첫 수동 이벤트
  9개·필드·발생 조건·동의 version3·직접 GA4 단일 전송·BigQuery 일별 저장과 기본 집계를 확정했다.
- 기획·API/아키텍처/보안 설계·법무 편집 초안을 동기화했다. 운영 법무 값과 원시·집계 보관·비용은 미정이다.
- 신규 콘텐츠 키·확장 계측·OpenAPI/타입·v3 구현, GTM 동일 목적지 태그 중지, GA4/BQ 콘솔 설정·실제 수신·배포는 미실행이다.
  기존 4개 이벤트 소스·GTM 삽입 테스트의 성공을 확장 기능 완료로 승계하지 않는다.

## Google Tag Manager — 2026-09-25 운영 반영

- `GTM-5BRTQ5T3` script를 `<head>` 맨 앞에, `noscript` iframe을 `<body>` 바로 뒤에 삽입했다.
- CSP nonce·GTM origin 허용과 기존 GA4 adapter의 공용 `dataLayer` 보존을 반영했다.
- 로컬 Web build·타입·lint, 단위 5건·HTTP 4건·동의 Chromium 검사 통과. 최초 CI #14의 네트워크 기대값 실패를 보완하고 전체 Chromium 41/41을 통과했다([CI 보완](../worklog/2026-09-25/google-tag-manager/CI-FIX.md)).
- `8af7244`의 CI #15 성공 후 01:47:24 KST API/Web을 교체했다. 운영 HTML의 삽입 위치·nonce, 실제 Chrome의 GTM script HTTP 200·1회 요청·컨테이너 초기화·시작 이벤트를 확인했다.
- 로컬 검사의 Google 응답은 대체 응답이고, 위 운영 검사는 실제 요청이다. Tag Assistant 태그별 실행·GA4 이벤트 수신·GTM 콘솔 동의 조건·공개 정책 대조는 미검증이다.
  [운영 배포 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md), [초기 구현 기록](../worklog/2026-09-25/google-tag-manager/RESULTS.md)을 구분한다.

<a id="검색엔진-설정--2026-09-24-로컬-변경"></a>

## 검색엔진 설정 — 2026-09-25 운영 반영

- `robots.txt` 경로 수집 규칙과 관리자·API·내부·health 경로 Web 응답의 `noindex`, 분할 사이트맵 자동 생성 구현.
- [사이트맵 계약](system-design/05-security-operations.md#사이트맵-자동-생성): 파일당 최대 1만 건, 5분 process cache,
  공개 상태 필터, 본문·이미지 조회 없음. DB migration 없음.
- [단위 검사](../apps/api/test/sitemap.service.test.ts)와 [PostgreSQL→빌드 Web 통합 검사](../apps/api/test/sitemap-http.integration.test.ts)에서
  공개 10001건의 10000/1 분할·중복 없음, 비공개 제외, TTL·동시 생성·오류·GET/HEAD·noindex 경계를 검증했다.
- API/Web build·lint와 Web typecheck 통과. 검색엔진 설정은 9/25 배포한 `8af7244`에 포함됐다. 실제 검색엔진 색인·노출과 대규모 운영 부하는 미검증이다.
- 커밋 전 CI 사전 검사: 기존 build 산출물이 없는 사본에서 Node 24.18.0의 `npm ci`, Java 25 fixture 준비,
  API/Web·API test build, scripts/tests 타입·lint, Web typecheck, 루트 테스트 33건·PostgreSQL 18 통합 95건·
  Chromium 41건이 통과했다. 통합 범위는 CI와 같은 schema-restore 제외이며 실패·skip 0건이다.
- Dockerfile의 Linux amd64 build stage와 사이트맵 단위 4건·DB→Web 통합 1건도 통과했다.
  [CI 테스트 진입점](../tests/sitemap.test.ts)을 추가해 사이트맵 단위 검사를 `npm test`에 포함했다.
  원격 GitHub Actions·Collector 전체 job·이미지 게시 결과를 대신하는 검증은 아니다.
- 후속 원격 확인: SHA `1531cf118a39470c616277ac06e3d8aeeb4b8df7`의
  [CI #13](https://github.com/JeahaOh/blariyo/actions/runs/36015059290)이 8분 30초에 성공했다.
  `verify`·`collector`·API/Web `images`와 artifact 5개, 사이트맵 단위 4건·DB→Web 통합 실행을 확인했다.
  이미지 게시 완료이며 운영 서버 교체 증거는 아니다.
- 배포 전 9/24 23:59~9/25 00:01 KST에는 앱 robots 규칙·사이트맵의 운영 반영이 없었다.
- 9/25 `8af7244` 배포 후 공개 `/robots.txt`의 Sitemap 안내, `/sitemap.xml`·하위 XML의 200,
  일반 페이지 3개·공개 게시글 74개 및 대표 상세 200을 확인했다([배포 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)).
- Web `noindex`의 경로별 운영 대조, 사이트맵의 비공개 URL 제외 전수 대조, 실제 검색 색인은 남아 있다.
  Access·Nginx 직접 응답은 Web middleware와 별도 계층이므로 동일 검사 결과로 간주하지 않는다.

## CI 액션 런타임 정비 — 2026-09-25 CI 실행 확인

- CI #13의 Node 20 경고 원인인 `upload-artifact` 3곳과 Docker 액션 3곳의 고정 SHA를 갱신했다.
  공식 release는 upload-artifact `v7.0.1`, setup-buildx `v4.4.1`, login `v4.6.0`, build-push `v7.4.0`이다.
- 공식 tag→전체 SHA와 해당 `action.yml`을 대조했다. CI·backup-restore workflow의 전체 7종 액션은
  `runs.using: node24`이고 현재 입력·필수 입력·build digest 출력이 호환된다. upload-artifact의 ZIP 기본값도 유지된다.
- `actionlint v1.7.12`의 workflow 2개 검사와 YAML 구조 대조 통과. 액션 SHA 외 job·권한·실행 명령·입력 변경은 없다.
  변경을 포함한 `8af7244`의 CI #15는 verify·collector·API/Web images가 성공했다. backup-restore workflow의 갱신 후 실행과 전체 로그의 경고 0건 여부는 별도 미검증이다.

## Git·개발 harness — 2026-09-26 원격 검증 및 잔여 수용

- **로컬 구현·분리 커밋·Draft PR 전달 완료, develop 통합·원격 강제는 미완료.** HARN-01~07은 모두 부분 구현이다. 테스트 수를 전체 구현률로 환산하지 않는다.
- 운영 기준 `8af7244`에서 develop 생성·tracking을 마쳤다. 원본 stash `c373dac`, local main의 기존 8개 commit과 다른 세션 worktree를 유지한다. 원본 미추적 파일 56개 중 `RESULT.md`는 과거 snapshot과 다르며 이번 후속 작업에서 덮어쓰지 않았다. 단일 `release` ref는 `release/<version>` 정책과 달라 처리 결정이 남았다.
- 기존 8개 commit은 PR #4에 SHA 그대로 전달했다. 검토 흐름은 브라우저 #3 → 기존 기능 #4 → 정책/task 등록 #5 → cleanup #6 → harness #7 → CI 진단·환경 #8 → release fixture #9다. #5~#9의 feature base는 검토 차이를 위한 연결이며 최종 feature → develop 정책을 대신하지 않는다.
- 코드 후속 전달: HARN-09 `8c1b5c1`은 API 빌드 선행·Windows Python 고정 버전 수정, HARN-07 `0fe6255`는 release CLI fixture의 실행 시각 기준 증거 생성이다. 각각 [Draft PR #8](https://github.com/JeahaOh/blariyo/pull/8)·[Draft PR #9](https://github.com/JeahaOh/blariyo/pull/9)에 push했다. hook은 HARN-09의 release 테스트 경로를 거부했고 task 전용 branch로 분리했다. 허용 경로를 확장하지 않았다.

| 원격 실행                           | 통과한 범위                                                                                                         | 실패·skip과 판정                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PR #8 `36210788239`, head `8c1b5c1` | verify·Collector·Windows lease·Core restore·event-context·restore-scope                                             | release fixture 수정 전 harness 52/54로 quality·최종 gate 실패; Collector restore·images skip                          |
| PR #9 `36210803673`, head `0fe6255` | Linux harness·quality 회귀·harness lint·architecture·전체 lint, Windows lease·Collector·event-context·restore-scope | quality는 feature → feature 방향 차단; verify는 browser 41/43 실패; 최종 gate 실패; Core/Collector restore·images skip |

- PR #9 browser 실패는 관리자 이미지 재시도 버튼 timeout과 실패 stage의 완료 증거 기록을 거부한 부모 assertion이다. PR #8과 #9의 해당 파일은 같다. 재조회 완료 대기를 추가한 [Draft PR #3](https://github.com/JeahaOh/blariyo/pull/3), commit `2b61c4c`는 아직 포함되지 않았으며 선행 검토·통합이 필요하다. PR #3 자체의 verify·Collector는 통과했다. PR #9의 실패를 전체 CI 성공으로 보고하지 않는다.
- 복구 당시 별도 검증: 전체 lint(SQL 27개·finding 0), harness 52/52, quality 10/10, architecture 9/9, API 단위 34/34, Collector 273/273, browser 26/26 및 API/Collector 복원 31/41개 table·sequence. 이후 동일 후속 후보에서 macOS 전체 lint·harness 54/54·architecture 9/9를 확인했다. 각 SHA와 환경의 증거를 합쳐 새 실행 결과로 표시하지 않는다.
- Collector 원문 HTML 49개의 바이트를 유지하고 parser 입력만 formatter에서 제외했다. 저장소 전체 SQL 27개 lint와 migration checksum evolution·명시적인 구 ledger 호환 계약은 유지한다.
- 진단 artifact와 검증 receipt를 분리했고 원격 생성·업로드를 확인했다. JSON 내용·hash·run/attempt 대조는 미완료다. 복원 job skip은 해당 실행의 복원 통과를 뜻하지 않는다.
- 마지막 인증된 Settings 관측에서 classic protection/ruleset은 없었다. 설정을 바꾸지 않았으며 trusted-ref 또는 code-owner 보호, 필수 gate 강제와 설정 readback은 남았다. 자동 heartbeat·다중 host·증거 schema/보존기간·지원 환경 확정, 실제 release/provider·배포·merge-back 수용도 남았다.
- 현재 worktree와 Git metadata의 쓰기 권한 제한은 해소됐다. 이번 후속 문서 갱신은 HARN-07의 기존 허용 경로 안에서 별도 commit·push한다. 병합·배포·원격 보호 설정은 실행 범위에 포함하지 않는다.
- 상세 Git·CI 증거는 [CI 복구 기록](../worklog/2026-09-25/git-governance/CI-RECOVERY.md), 과거 복구 검증은 [stash 복구 결과](../worklog/2026-09-25/git-governance/STASH-RECOVERY.md), 잔여 순서는 [로드맵](roadmap.md#개발-도구--githarness-도입-계획)을 따른다. 기존 제품 17개 task·운영 배포 상태는 변경하지 않는다.

## 검증 근거

아래 실행들은 서로 다른 시점·환경의 증거다. 중복 합산하거나 9월 24일 문서 갱신에서 다시 수행했다고 표시하지 않는다.

| 범위                   | 확인된 결과                                                                                                  | 원본                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Core 통합·실제 실행기  | 통합 93+복원 재실행1, 실행기 업무12+worker4, 전체 Chromium28 후 영향17/복구8                                 | [Core 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md)                      |
| Collector 분리         | 비교40 일치, Java273/273·Core 연동7/7                                                                        | [사이트 분리](../worklog/2026-09-23/collector-site-modules/RESULTS.md)                 |
| Collector CI 로컬 재현 | macOS273·Linux Docker arm64 273 각각 통과                                                                    | [CI 결과](../worklog/2026-09-23/collector-ci/RESULTS.md)                               |
| Direct 검수            | API15·관련 Chromium27, 320/1280px·DB/private object 대조                                                     | [검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md)                       |
| Core 이미지 후보       | V005에서 후보/이전 앱 업무 및 복귀 통과; V008에서 이전 앱 readiness503 확인                                  | [후보 식별·호환 행렬](../worklog/2026-09-23/release/candidate.md)                      |
| 원격 CI·배포           | SHA `8af7244` CI #15 성공·API/Web digest 교체·실제 GTM 로딩·새 백업 복원·공개 smoke                          | [9/25 앱 배포 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md) |
| DB·공개                | API V008·Collector V006, 74 게시글·308 이미지·108 수집 항목 반영. 목록/상세·이미지 전수 대조, 전후 백업 복원 | [DB·콘텐츠 반영 기록](../worklog/2026-09-23/release/production-db-promotion.md)        |
| 9/23 커밋 준비 당시    | Node24 루트 검사29/29, 실패·생략0                                                                            | [진행 보관 기록](../worklog/2026-09-23/progress-checkpoint.md)                         |

요구사항 집계는 [40개 대조표](development-specs/requirements-status.md)의 **I30/P9/U1**이다. 40개 묶음 중 주요 구현 확인 30개(75%)이며 개발 공수·제품 완성도·출시 준비율이 아니다. C16 운영자 사용성, O07 실제 인수·복귀를 포함한 부분 항목은 유지한다.

## 재개 순서와 입력

1. 운영자가 준비된 [격리 인수 환경](testing/operator-acceptance.md)에서 반복 업무 12건을 수행하고 혼동·재작업·실패를 기록한다. 별도로 승인된 운영 콘텐츠 범위에서 실제 Access MFA 세션의 작성·업로드·발행·예약·취소·숨김을 인수한다. 인증 비밀은 전달하지 않는다.
2. 운영 담당이 현재 release·flag·DB ledger·백업/timer·공개 API를 먼저 읽기 전용으로 재조회한다. 그 결과에 따라 별도 운영 시나리오에서 예약 실행·알림 실수신·복귀 가능성을 검증한다. 다음 배포에는 최근 18시간 이내 백업·복원 증거가 필요하며, 9월 25일 배포 전 백업과 과거 공개 수량을 다음 배포의 현재값으로 재사용하지 않는다.
3. 다음 코드 배포가 필요하면 [배포 실행서](operations/deployment-runbook.md)에 따라 그 후보 SHA의 원격 CI·digest, V008/Collector V006 호환성, 최신 백업·복원 및 복귀 경로를 새로 대조한다. V008에서 9월 20일 구 API는 readiness 503이다.
4. 수집은 QD-03 입력/source 소유권과 QD-04 direct 보관/회수·법무 고지 계약을 결정한다. 운영 검수 flag ON을 URL·Discord·자동 수집 활성화나 QD-04 충족으로 해석하지 않는다.
5. direct의 robots/Crawl-delay·영속 일일 budget 연결과 redirect 상한 차이를 먼저 보완한다([코드 대조 근거](system-design/07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조)). 비운영 DB/object·Discord 시험 대상과 실행 PC/OS가 정해지면 다른 PC batch·원격 권한·Gateway를 실연동한다. 출처별 활성화와 실제 7일 관찰은 별도다.

## 보존된 로컬 자원

- 준비된 인수 sandbox: `.local-data/admin-sandbox-eecd0319a964` (준비 당시 서버 종료; 재개 시 가동·포트 상태 확인).
- 과거 로컬 이미지 후보: `.local-data/release-preparation/blariyo-app-images-20260923T124626Z-ij42qk3e/` (V005 권고 시점의 후보이며 9/23 운영 release 식별자로 재사용하지 않음).
- 비공개 runtime 설정 사본: `~/.config/blariyo/application-config-ZzkcSI/` (실값은 커밋하지 않음).
- 9월 23일 커밋 준비 당시 검사 원본은 Git 제외 `test-results/`에, 당시 원본·diff 백업은 `.local-data/commit-preparation/`에 보존했다. 이번 문서 갱신의 테스트 실행 기록은 아니다.
- 위 로컬 파일 경로는 다른 PC에서 자동 복원되지 않는다. Git 문서·코드와 비공개 실행 자원을 구분한다.
