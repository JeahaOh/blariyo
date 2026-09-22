# 최초 계획 대비 프로젝트 진행현황 — 주 검수 최종 보고

- 기준일: 2026-09-22 UTC
- 기준: `main`, `c69aa53c0112bcff8f50405c3a81b80969bef05a`
- 조사: GPT-5.6 Terra / high 3개 영역 병렬 조사, 주 에이전트 원문 대조·반증·정정
- 산출물: [작업 관리](TASK.md), [직접 검수](REVIEW.md), [후속 작업 15개](BACKLOG.md)

## 1. 현재 위치

**현재는 M0 Core를 공개 서버에 배포한 뒤 실제 운영을 수용하는 단계다. 자동 수집 확장을 구현 중이며, M1 회원·M1.5 익게는 설계 이후 구현이 남아 있다. 프로젝트 전체 완료나 M0 실제 운영 완료로 판정할 수 없다.**

2026-09-22 14:34:26 UTC에 주 에이전트가 공개 목록 API를 직접 조회했다. 응답은 `success=true`, `pinnedItems=0`, `items=0`이었다. 공개 서버는 있으나 실제 콘텐츠 공급·반복 발행·사용자 반응 검증이 아직 증명되지 않았다. [공개 목록](https://blariyo.com/api/v1/boards/meme/posts?page=1), [하위 조사 HTTP 증거](artifacts/public-readback.json).

| 구분 | 현재 판정 | 남은 핵심 |
| --- | --- | --- |
| M0 Core | 공개·관리자·정책·동의 코드와 과거 통합 검증 이력 있음. 공개 배포 확인 | 최신 HEAD 검증 실패 해소, 실제 관리자 쓰기, 콘텐츠 운영, 복구·알림·관찰 |
| 기존 수동 수집 보조 | candidate/lease/quota/preview/승격 코드와 격리 실행 이력 있음 | 실제 출처·Discord·운영 PC·운영 전환 수용 |
| 신규 direct batch | 저장 ledger·parser·object store·일부 조회 코드까지 부분 구현 | 계약에 없는 조회 경로, 검수·초안 승격 단절, 공유 DB 적용·실제 object readback |
| M1 회원 | 제품·기술 설계와 기능명세 2개 있음 | 소셜 4종·가입/동의·세션/연동·탈퇴 구현과 운영 gate |
| M1.5 익게 | 제품·기술 설계와 기능명세 2개 있음 | 글·댓글·이름·내 활동·신고·제재 구현, M1 선행 |
| GA4·Kakao·광고·제휴 | 활성화 gate를 분리한 상태 | 선택 기능별 설정·동의·실연동 검증. M0 전체 실패로 계산하지 않음 |
| 뉴스·네이티브 앱 | 뉴스는 후속 상세 기획, 네이티브 앱은 현행 제외 | 현재 확정 기능 분모에 포함하지 않음 |

구현 근거는 [하위 요구 38개 매핑](artifacts/02-feature-coverage.md), 운영 경계는 [운영 감사](artifacts/03-operations.md)를 따른다.

## 2. “최초 계획”은 두 기준으로 비교해야 한다

| 기준 | 최초 목표 | 현재와의 관계 |
| --- | --- | --- |
| 2025-04-01 `5792943` README | 학습 목적의 범용 커뮤니티 CMS. 회원·사용자 글·댓글/대댓글·추천/비추천·신고·관리자·선택 알림 | 제품 방향이 교체됐다. 현재 회원·익게는 후속이며, 대댓글·추천/비추천·알림은 현행 첫 버전 제외다. 옛 구현을 현재 완료로 승계하지 않는다. |
| 2026-08-11 `d53514e` 서비스 기획 | 운영자 선별 유머를 연속 소비하고 7일 안에 재방문하는지 검증. M0 피드, M1 커뮤니티, M1.5 승인 제보 | 현재 제품의 출발점이다. 이후 M1은 회원만, M1.5는 익게로 재편됐고, M0 Core/수집 보조/자동 수집으로 분리됐다. |
| 현행 planning | 짤 게시판 하루 2회, 1회 10~20개 수동/예약 발행·열람. 수집과 회원/익게의 독립 공개 gate | 핵심 코드·공개 인프라는 마련됐지만 실제 발행 운영과 최초 제품 가설 검증은 남았다. |

근거: `5792943:README.md:17`, `d53514e:docs/planning/01-service-plan.md:11`, [현행 서비스 기획](../../../../../docs/planning/01-service-plan.md) `:21`, `:88`, `:389`, `:426`, [상세 기준선 비교](artifacts/01-plan-baseline.md).

따라서 2025의 모든 기능을 오늘의 미완료로 합산하는 방식은 부정확하다. 아래 수치는 **현재 유효한 기능명세의 구현 범위**를 세며, 최초 계획에서 변경·제외된 기능은 따로 설명한다.

## 3. 얼마나 진행됐고 얼마나 남았는가

현재 저장소의 `*.dev.md` 기능명세는 9개다. 문서 하나를 하나의 기능군으로 세며, 구현된 기능군에 임의의 부분점수를 주지 않았다.

| 기능명세 | 단계 | 구현 범위 판정 | 현재 검증 경계 |
| --- | --- | --- | --- |
| `public-post-browsing` | M0 Core | 구현 있음 | API/SSR/공유·조회 source와 과거 통합 검증. 최신 전체 브라우저 재실행은 미완료 |
| `admin-post-management` | M0 Core | 구현 있음 | 초안·이미지·발행·예약·숨김/재공개 구현. 운영자 실로그인 후 전체 쓰기 미검증 |
| `policy-and-rights` | M0 Core | 구현 있음 | 정책 공개와 v0.1 발행 증거. 실제 권리 문의 접수·처리·파기 수용은 남음 |
| `analytics-consent` | M0 Core | 구현 있음 | 기본 비활성 GA4·동의 제어. 이번 동의 단위 검사 통과. 실제 GA4 활성화는 별도 |
| `collection-assist` | 수집 보조·확장 | 부분 구현 | 기존 보조 경로 구현 이력은 있으나 최신 direct batch 연결과 외부 운영 수용 미완료 |
| `member-identity` | M1 | 미구현 | 명세·설계만 있음 |
| `account-lifecycle` | M1 | 미구현 | 명세·설계만 있음 |
| `community-participation` | M1.5 | 미구현 | 명세·설계만 있음 |
| `community-moderation` | M1.5 | 미구현 | 명세·설계만 있음 |

**기능명세 9개 중 구현 범위가 마련된 것은 4개(44.4%), 부분 구현 1개(11.1%), 미구현 4개(44.4%)다. 완전히 구현되지 않은 범위는 수집 1개와 후속 4개, 합계 5개(55.6%)다.**

이 비율은 명세 단위의 동일 가중 현황이다. 개발 공수 소진율·세부 요구 충족률·최신 테스트 통과율·출시 준비율이 아니다. 특히 Core 4개에 구현이 있다는 사실도 현재 HEAD 또는 운영의 100% 완료를 뜻하지 않는다. 최신 검사 실패와 실제 운영 잔여는 별도 해결해야 한다. 수집 보조와 자동 수집은 같은 기능명세에 들어 있어 표 밖에서 각각 상태를 나눴다.

수치와 분모는 [집계 데이터](artifacts/progress-counts.json)에 있다. 최초 2025 CMS는 범위 자체가 교체돼 현재 기능명세 비율과 별도로 평가했다. 추가 개발 기간은 작업별 추정 근거가 없어 산정하지 않았다. 수집 운영 전환의 **실제 7일 관찰**은 준비·활성화 후 수행해야 하는 시간 조건이며, 전체 잔여 기간이 7일이라는 뜻은 아니다.

## 4. 직접 검수에서 확인한 우선 문제

| 중요도 | 문제·근거 | 영향 | 최소 보완 |
| --- | --- | --- | --- |
| High | 현행 계약 기준선 테스트 실패. `tests/migration-contracts.test.ts:6`, `docs/migration/contract-baseline.json:14` | collection OpenAPI·생성 타입·schema 3개 hash 불일치, V006/V007 SQL 4개 추가가 과거 불변 검사와 충돌. CI의 `npm test`에도 해당 검사가 포함됨 | 역사 baseline을 보존하고 승인된 확장과 보존 계약을 구분하는 현행 검사를 마련. 깨끗한 환경과 현 SHA의 CI 결과 확인 |
| High | 신규 batch 조회가 계약에 없음. `collection.controller.ts:110`, BFF `[...path].ts:24`, `auth.guard.ts:24` | Controller는 있지만 생성 schema 39 operation에 batch 경로가 없어 BFF·Core guard에서 404. 정적 코드/계약상 확인, 실제 HTTP 재현은 미실행 | OpenAPI·생성 계약·BFF·Core를 함께 연결하고 실제 요청/응답 검사 |
| High | batch 결과→검수→초안 승격 연결 없음. `batch-result.repository.ts:6`, `collection-promotion.service.ts:33` | 새 batch가 저장해도 기존 candidate 승격 경로로 이어지지 않아 전체 수집 업무가 끝나지 않음 | batch item의 검수 상태·이미지·승격 소유권을 명확히 연결하고 격리 E2E 수행 |
| High | 공개 목록 0건, 운영자 실제 쓰기 미검증. `current-status.md:30`, 이번 public GET | 하루 2회·20~40개 공급이라는 M0 운영 기준 및 실제 이용 가능성을 입증하지 못함 | 실제 관리자 업로드·발행·숨김 검수와 승인된 콘텐츠 공급을 먼저 수용 |
| High | 외부 알림·새 VM 복구·장기 관찰 미검증. `current-status.md:33`~`:49` | DB 격리 복원 성공만으로 장애 대응·전체 복구·RTO 달성을 보장할 수 없음 | 수신·재부팅·새 VM 복구·backup age/TTL 관찰 결과 기록 |
| High | 최초 제품 가설의 현행 판정 기준 부족. `d53514e:01-service-plan.md:14`, 현 `04-analytics-ad-plan.md:18`~`:45` | GA4 off와 단순 조회수만으로 고유 방문자·재방문·제품 성공을 판단할 수 없음 | 관찰 대상·기간·측정/해석 방법·지속 가능한 콘텐츠 공급·M1 착수 기준을 planning에 정리 |
| Medium | 최신 공유 DB 결정과 과거 별도 DB 설명이 공존. `docs/ai/tasks/2026-09-21-collector-batch-architecture-reset.md:21`, 수집 README `:46` | 신규 방향은 정해졌으나 role/migration·운영 도구 적용 경계가 혼동될 수 있음 | 새 선택을 다시 열기보다 최신 방향으로 정본·도구 동기화 및 실제 권한 검증 |
| Medium | 현행 상태 설명이 오래됨. `design-readiness.md:19`~`:24`, 루트 README `:11`, CI 후속 TODO | “배포 차단/자동수집 미구현/CI 로컬 작성”만 읽으면 이후 공개 배포·부분 구현·과거 CI 성공 기록을 놓침 | 공개 배포·운영 수용·기능별 활성화·해당 SHA CI를 분리해 현행 색인 갱신. 과거 작업 로그는 보존 |

계약 불일치 원본은 [직접 비교 결과](artifacts/review-contract-baseline.json), source·행 상세는 [구현 감사](artifacts/02-implementation.md), 운영 근거는 [운영 감사](artifacts/03-operations.md)에 있다.

## 5. 수집 21개 출처를 어떻게 해석해야 하는가

정책 분류는 HOT_LIST 4개, DETAIL_ONLY 1개, UNVERIFIED 1개, BLOCKED 15개다. 기술 실행 검증표는 목록·상세 parser가 있는 4개, 기존 상세 parser만 남은 theqoo 1개, 나머지 blocked 16개로 표현한다. **정책 분류와 기술 실행 상태의 분모가 달라 생기는 차이이며, 두 숫자를 같은 상태로 합산하면 안 된다.**

- 목록·상세 parser가 있는 4개: arcalive, bobaedream, dogdrip, inven. HTML/fixture 근거가 있어도 출처 정책 승인·실제 direct DB/S3 수용이 끝난 상태는 아니다.
- theqoo: 기존 상세 parser가 있으며 목록·실제 readback 수용은 별도다.
- 나머지: 차단·보류·미확인 사유를 보존한다. 21곳을 모두 구현·활성화하는 일을 출시 필수로 바꾸지 않는다.
- 새로운 `DirectBatchRunnerReadbackTests`는 DB 환경 변수가 없으면 skip하고 Local object store·합성 transport를 사용한다. 실제 출처·S3 운영 성공 증거로 올릴 수 없다.

근거: [출처 정책](../../../../../docs/planning/content-collection/source-collection-policy.md) `:12`~`:34`, [출처 검증표](../../../../../docs/planning/content-collection/reference-site-validation.md) `:9`~`:31`, [수집 구현 기록](../../../../../docs/implementation/m0-completion/collector-batch-architecture-reset-20260921.md) `:13`~`:32`.

## 6. 보완 순서

**첫 운영 검증을 우선하는 순서**는 현행 검사 실패 정리와 실제 관리자 쓰기·콘텐츠 발행 → 알림·복구·지속 발행 관찰 → 제품 가설 판정이다. 수집이 완성되기 전에도 M0 Core는 운영할 수 있다.

**수집 자동화를 먼저 마무리하는 경로**는 공유 DB 정본·권한 정렬 → batch 조회 계약·검수·승격 연결 → 한 출처씩 DB/object readback → Discord·운영 PC·실제 관찰이다. 이 작업은 기존 공개 짤 운영과 별도로 진행할 수 있다.

회원·익게는 두 M1 명세, 두 M1.5 명세 순서로 남아 있다. 자동 수집이나 광고 활성화를 M1의 필수 선행 조건으로 새로 만들지 않는다. GA4·Kakao·광고·제휴·뉴스와 자동 CD는 각각 독립 결정/활성화 작업이다.

구체적인 역할·필요 입력·의존관계·수용 조건은 [15개 후속 Backlog](BACKLOG.md)에 정리했다. 이 감사에서는 후속 보완 코드를 적용하거나 운영 콘텐츠를 발행하지 않았다.

## 7. 이번에 실제 검증한 것과 남은 검증

| 검사 | 이번 결과 | 의미 |
| --- | --- | --- |
| Node 24 subset 7파일 | 18 PASS, 2 FAIL | 1개는 계약 baseline assertion 실패, 1개는 TypeScript 의존성 부재로 architecture 검사 시작 실패 |
| 계약 baseline 주 검수 | 동일 실패 재현, hash 불일치 3파일·추가 SQL 4파일 확인 | 현재 실제 검사 실패. DB 데이터 손상이나 운영 장애를 뜻하지 않음 |
| docs/packages OpenAPI 사본 | 두 쌍 동일 | 역사 baseline 불일치와 별개 |
| Python collector launchd 렌더러 | 1 PASS | 운영 PC 설치 성공 증거 아님 |
| 회원 설계 Python 검사 | PASS | 이름·Unicode·제재·연령의 오프라인 모델 검증. 회원 구현/실제 provider 검증 아님 |
| 공개 GET | 목록·정책·liveness 200, 관리자 Access 302, 내부 readiness 404 | 현재 익명 HTTP 응답의 증거. 관리자 쓰기·브라우저 검증 별도 |
| 공개 목록 주 검수 | 고정글 0·일반글 0 | 2026-09-22 14:34:26 UTC 관측 |
| 기존 tracked 문서 상대 링크 | Markdown 116개, 상대 링크 957개, 누락 1개 | 과거 인계서의 `collection.mjs` 링크. anchor·외부 내용은 미검사 |
| 최신 전체 build/DB/browser/Spring | 미완료 | Node24는 확인했으나 root/workspace 의존성·JDK25와 격리 실행 환경이 충족되지 않음 |
| 최신 원격 CI·운영 image readback | 미검증 | 과거 성공 기록을 최신 SHA PASS로 승계하지 않음 |

검토 범위는 tracked 파일 749개의 구조 inventory, 관련 planning·legal·system-design·기능명세·운영 문서, 구현 기능군과 38개 하위 요구, 21개 출처, 12개 운영 항목이다. **모든 코드 행·모든 테스트 시나리오·운영 콘솔 설정을 실행 감사한 것은 아니다.** 성능 상한·부하·전체 접근성·장기 가용성·외부 계정/정책 적합성은 이번 감사로 완료 판정하지 않는다.

완료한 것은 진행현황 조사·반증·직접 검수·후속 작업 정리다. 남은 제품 구현과 운영 검증은 각 항목의 현재 상태로 유지한다. 제품 정본·source·기존 이력은 수정하지 않았으며 commit·push·배포는 수행하지 않았다.
