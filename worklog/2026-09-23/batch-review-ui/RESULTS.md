# Direct batch 검수 UI 연결·격리 검증 결과

기준일: 2026-09-23. [잔여 과정 H / P1-02](../m0-planning/remaining-process.md)의 독립 실행 범위다.

## 판정

- **화면 연결·개발자 격리 검증 완료.** 조건부 관리 메뉴→필터→검수/반려→선택 초안 편집 이동을 구현했다.
- API 통합 **15/15**, 관련 Chromium 브라우저 **27/27**, skip 0. 이번 브라우저 묶음 중 direct 검수 파일은 상위 test 포함 **11건**이다.
- 원문 본문·SNS/첨부 링크·인증 이미지 preview·private 사본을 확인했다. 응답 유실/상세 조회 실패 뒤 401/403을 두 번 받아도 같은 요청 키/본문으로 복구하며 각 초안·최초 상태 이력은 1건이다.
- direct 검수 브라우저의 public object **0개**, DRAFT 이외 게시글 **0건**. 초안은 공개 상세 404이며 선택한 postId의 편집기로 연결됐다.
- **실제 운영자 수동 인수·Access·원격 S3/R2·다른 PC 수집은 미검증.** 로컬 테스트 인증·합성 원문·격리 DB/object 검사다.
- URL 입력 전달·source 설정 소유권·보존 기간 결정은 남아 있다. 기존 feature flag의 기본값을 변경하지 않았으며 commit/push/배포는 수행하지 않았다.

## 변경 범위

| 영역 | 변경과 목적 |
| --- | --- |
| [목록 API](../../../apps/api/src/features/collection/batch-review.controller.ts) / [저장소](../../../apps/api/src/persistence/batch-review.repository.ts) | page/source에 state/reviewStatus를 추가. 같은 조합으로 목록·전체 건수 계산, review 행 부재는 UNREVIEWED. 조회 transaction과 batch SELECT 경계 유지 |
| [정본 OpenAPI](../../../docs/development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml) / [계약 변경 이력](../../../docs/migration/contract-evolution.json) | 선택 query enum 2개, 패키지 사본·생성 타입/스키마·변경 hash 일치. 기존 SQL migration 변경 없음 |
| [관리 메뉴](../../../apps/web/app/components/AdminNavigation.vue) / [기능 조회](../../../apps/web/server/api/admin/features.get.ts) | 인증된 BFF 응답에 batchReview boolean만 제공, private/no-store. flag ON일 때만 direct 검수 메뉴 표시. 실제 Core/BFF 인증·기능 제한은 유지 |
| [검수 화면](../../../apps/web/app/pages/admin-batch.vue) | 출처/수집/검수 필터, 적용한 조건의 페이지 이동, 빈 목록, 목록 실패 재조회, 검수 후 빈 마지막 페이지 조정, postId 편집 연결 |
| 동일 화면의 저장 복구 | 요청 본문/키와 성공 확인 여부 보존, 중복 클릭·입력·다른 글 선택·이동 제한, 동일 요청 재확인. 확인된 저장 후 목록 실패는 별도 표시. 확정 중복/버전 충돌은 재조회 가능 |
| [격리 fixture](../../../tests/helpers/browser-fixture.ts) / [새 브라우저 검사](../../../tests/browser/batch-review.test.ts) | 기본 OFF인 batchReview 옵션과 LocalCollectReader. 고유 DB·임시 object만 생성/정리, 기존 Core/legacy fixture 사용 방식 유지 |
| 정본·상태 문서 | planning·system-design·개발 명세, remaining-process·next-plan·requirements·후속 계획에 계약과 검증 경계 반영 |

새 메뉴는 legacy URL 입력·source 수정 화면을 direct 경로로 연결하지 않는다. 직접 수집 기능 전체 완료로 표시하지 않는다.

## 실제 검사와 증거

환경: macOS arm64, Node 24.18.0, 로컬 Chromium, PostgreSQL 18.6의 loopback 55449.
API 검사마다 `nest_<random>`, 브라우저 fixture마다 `m0_browser_<random>` DB와 임시 미디어를 사용했다.

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| contracts:generate + API/Web build | 통과, 최종 Web 변경 후 재빌드 통과 | `test-results/batch-review-ui/build.log`, `build-web-final.log` |
| API batch review 통합 | 15/15, skip 0 | `api-integration.log`; 기존 14건에 조합 필터/21건 페이지/반려/실패/빈 결과/잘못된 enum 검사를 추가 |
| direct 검수 + 관리자 복구 + legacy 수집 + 이벤트 + Core 브라우저 | 27/27, skip 0 | `browser-final.log` |
| root unit/architecture/contracts | 최초 29건 중 28 통과, 계약 hash 1 실패 → 수정 후 해당 1/1 통과 | `unit-first.log`, `contract-recheck.log`; 실패를 지우거나 전체 재실행 통과로 표시하지 않음 |
| API/Web/tests 타입·린트 | 모두 통과 | `*-typecheck.log`, `*-lint.log`; API test build 포함 |
| 화면 확인 | 320px·1280px 가로 넘침 0, 최종 PNG 육안 확인 | `test-results/m0-browser/batch-review-320.png`, `batch-review-1280.png` |
| DB/private object | 단일 DRAFT·단일 최초 이력·미공개 404·private 이미지 픽셀 동일·public 0 | 브라우저 테스트의 실제 SQL/storage/HTTP readback |
| 정리 | 생성 fixture DB 정리; 기존 `m0_browser_4837613d7f64`만 남음, 보존 | `cleanup.log`; 기존 PostgreSQL 컨테이너와 사용자 DB는 유지 |
| 문서·diff | 수정/신규 Markdown 21개·상대 참조 368개 누락 0·요구사항 40행 집계·`git diff --check` 통과 | `documents.json`, `diff-check.log` |

브라우저의 401은 실제 로컬 인증 쿠키 제거로 거부를 확인했다. 403은 Access를 연결하지 않고 BFF 경계의
응답을 주입했다. 응답 유실은 실제 POST를 API에 전달·commit한 뒤 브라우저 응답만 끊었다.
상세 실패도 실제 저장 뒤 상세 GET에 503을 주입했다. 이미지 실패는 private preview 요청만 끊고 원문 URL을 fetch하지 않았다.

API/브라우저 fixture는 오래된 원문 변경을 주입하기 위해 Collector V003/V004 소유권 trigger를 설치하지 않는다.
실제 최소 권한·소유권 trigger 검사는 이전 Collector/역할 검증의 별도 증거이며 이번 UI 결과로 재검증됐다고 주장하지 않는다.

## 발견·수정·재실행

1. 첫 build 시 정본 OpenAPI와 패키지 사본 불일치 검사가 실패했다. 두 사본을 정렬하고 생성·API/Web build를 통과했다.
2. 첫 direct 브라우저 검사는 상태 select의 접근성 이름 때문에 필터 단계에서 실패했다(상위 포함 8 pass / 2 fail).
   상태 label을 명시적으로 연결한 뒤 direct·관리자 복구·legacy 묶음 19/19를 통과했다.
3. 검수 후 필터의 마지막 페이지가 비는 경계를 추가 보완했다. 해당 회귀와 검수 POST 응답 유실 검사를 포함한 최종 관련 브라우저 27/27가 통과했다.
4. root 계약 검사에서 명시적 계약 변경 hash 누락을 발견했다. 변경한 OpenAPI/생성 파일 3개의 hash와 사유만 갱신하고 1/1 재검증했다. baseline hash·SQL hash는 그대로다.
5. 최초 전체 페이지 PNG는 스크롤 위치에 고정 header가 찍혔다. 최상단으로 이동 후 최종 320/1280px PNG를 다시 찍고 확인했다. 제품 header 소스 변경은 하지 않았다.

로컬 실행 증거는 Git 제외 `test-results/batch-review-ui/`에 있다. 소스 기반 재현 명령은 아래와 같다.

```sh
# Node 24.18.0, 격리 loopback PostgreSQL의 /postgres 접속만 사용
npm run build
npm run build:test -w @blariyo/api
node scripts/test-nest-integration.ts apps/api/dist-test/batch-review.integration.test.js
node --test --test-concurrency=1 tests/browser/batch-review.test.ts tests/browser/admin-recovery.test.ts tests/browser/collection.test.ts tests/browser/collector-events.test.ts tests/browser/core.test.ts
npm test
npm run typecheck:tests
npm run lint:tests
npm run typecheck:web
npm run lint -w @blariyo/web
npm run typecheck -w @blariyo/api
npm run lint -w @blariyo/api
git diff --check
```

DB 검사 명령에는 `TEST_DATABASE_ADMIN_URL`을 비공개 환경으로 주입한다. fixture는 loopback 5439/55449의
`/postgres`만 허용하며 다른 환경/기존 개발 DB를 대상으로 삼지 않는다.

## 남은 수용 조건

- 실제 운영자 로그인·수동 반복 업무·사용성 인수 및 운영 Access 허용/거부.
- direct URL 요청 전달과 source 설정 정본/변경 절차 확정(P1-01), 원격 DB/object/다른 PC 검증(P1-03).
- Discord·보존/회수·차단 출처 재개 조건·Windows·최종 원격 CI 및 별도 승인된 배포.
- 이번 작업 트리는 기존 Core·Collector 후속 변경을 포함한다. 기능별 커밋 검토는 필요하며 실제 commit/push는 미실행이다. 전후 브랜치는 `main...origin/main [ahead 1]`로 같고, 최종 수정/신규 171개 파일에는 이전 단계 변경이 포함된다.
