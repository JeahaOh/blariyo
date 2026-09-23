# 사이트별 parser 분리 결과 — 2026-09-23

## 판정

- **로컬 완료:** P1-06 중 사이트별 독립 파일 분리, 분리 전후 결과 보존, 공통 runner와 격리 DB 회귀.
- **미검증 유지:** 이번 실행의 실제 사이트 fetch, 원격 S3/R2, Discord Gateway, 다른 PC·Windows·Linux runtime.
- **전체 M0 부분 완료:** 원격 CI·운영자 수동 인수·배포·P1 잔여 실연동·실제 7일 관찰은 별도 단계다.
- commit·push·배포·출처 활성화·운영 콘텐츠 공개는 수행하지 않았다.

## 변경

| 대상 | 결과 |
| --- | --- |
| `source/SiteAdapters.java` | 913→66줄. 사이트별 중첩 구현을 제거하고 adapter 조립·기존 query helper 위임 유지 |
| `source/sites/` | 사이트 21개 패키지, adapter 21개, DetailParser 21개, ListParser 19개 |
| `source/common/` | URL 검사, HTML·날짜·query·공지 판정, 목록 순회, 상세 추출과 OrderedContentParser 공유 |
| Theqoo 기존 parser | 해당 사이트 패키지로 이동. SourcePolicy의 기존 호출 의미 유지 |
| `src/test/java/.../source/sites/` | 사이트별 목록·상세 테스트 파일 40개, 새 회귀 103건 |
| `tests/architecture.test.ts` | 상위 기능 의존 검사와 내부 사이트 경계 검사를 분리. 사이트 간 참조·parser의 IO·공통→사이트 구현 참조 금지 |

PGR21·YouTube Community는 목록 parser를 만들지 않았고 `CHART_UNVERIFIED`를 유지했다.
다른 19개 목록 구현의 존재가 해당 사이트의 실제 접근 허용을 뜻하지 않는다.
기존 CLI·source 설정·SiteAdapter 계약·canonical URL(대표 URL)·post key(원문 식별값)·오류 코드·parserVersion을 보존했다.
runner·저장·migration·API 계약·기존 HTML fixture 내용은 변경하지 않았다.

구현 진입점: [registry](../../../../../apps/collector/src/main/java/com/blariyo/collector/source/SiteAdapters.java),
[사이트 모듈](../../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/),
[공통 parser](../../../../../apps/collector/src/main/java/com/blariyo/collector/source/common/),
[구조 계약](../../../../../docs/system-design/08-code-structure.md#collector-site-modules).

## 분리 전후 비교

- 분리 전 source는 HEAD `8cda23e3e3681c9c8fcc777e189496b337c09e17`과 일치했다.
- 기존 구현으로 상세 21개·목록 19개 결과를 먼저 저장했다. **40개 모두 분리 후 일치**했다.
- object key만 정렬한 JSON 전체를 비교하므로 배열 순서, 모든 본문·이미지·첨부·SNS,
  canonical/post key·날짜·next·parserVersion을 포함한다.
- 17개 출처는 기존 실제 원본에서 정제한 HTML, 차단 4개 출처는 합성 HTML을 사용했다.
- [기준값과 출처 설명](../../../../../apps/collector/src/test/resources/sites/module-baseline.md),
  [고정 결과](../../../../../apps/collector/src/test/resources/sites/module-baseline.json).

## 이번 실행 검증

환경: macOS, Node 24.18.0, Java 25.0.2. 기존 로컬 PostgreSQL 안에 무작위 이름의 임시 DB를 생성했다.
지속 개발 DB의 수집 원본과 게시글을 검증 대상으로 사용하지 않았다.

| 검사 | 결과·경계 |
| --- | --- |
| 분리 전 Java | 총 170건: 154 통과·DB 환경 미주입으로 16 건너뜀. 전체 통과로 표기하지 않음 |
| 분리 후 Java 전체 + 격리 DB | **273/273 통과**, 실패·오류·건너뜀 0. 2분 33초 |
| 새 사이트별 회귀 | 위 전체에 포함된 **103건**. 혼합 본문 순서·복수 이미지·파일·4종 SNS·이미지 없는 본문·링크만 있는 본문·빈/삭제 본문·URL 식별·중복·목록 날짜/다음 페이지·challenge/목록 변경 오류 |
| 공통 runner | 위 전체에 포함된 **58건**. dry-run 무쓰기, 중복·재개·소유권, 원본/미디어/report DB·로컬 object readback 등 |
| Java parser→Core→DB | **5/5 통과**. 기존 4개 fixture의 후보 생성·본문 저장·quota·중복·migration rollback 보존. binary 다운로드·원격 저장 검증 아님 |
| 구조 검사 | **4/4 통과**. 기능 의존·사이트 모듈 경계·Web/API 경계 |
| tests TypeScript·ESLint | 모두 종료 코드 0 |
| 실행 JAR 빌드·내용 검사 | 성공. adapter 21·상세 21·목록 19 class 포함, 과거 중첩 class와 이동 전 parser class 잔존 0 |
| 문서·변경 경계 | 상대 링크 290개 모두 존재, `git diff --check` 통과, API 계약·migration·source 설정·기존 HTML fixture 차이 없음 |

실행 명령:

```sh
# Java 25와 Node 24.18.0이 선택된 환경에서 실행
apps/collector/gradlew -p apps/collector test fixtureClasspath --rerun-tasks
node scripts/test-collector-readback.mjs
npm run test:architecture
npm run typecheck:tests
npm run lint:tests
TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres \
  node scripts/test-nest-integration.ts apps/api/dist-test/collection-discovery.integration.test.js
apps/collector/gradlew -p apps/collector bootJar fixtureClasspath
```

`test-collector-readback.mjs`는 `5439/postgres`에서 임시 DB만 만들고 종료 시 제거한다.
Core 연동 검사는 `55449/postgres`의 별도 임시 DB를 사용했다. 종료 후 두 인스턴스에서 해당 이름 규칙의
임시 DB가 0개임을 읽기 전용 조회로 확인했다.

실행 로그와 suite별 집계는 Git 제외 `test-results/collector-site-modules/`에 남겼다.
`baseline-java.log`, `baseline-metadata.json`, `after-fingerprints.json`, `java-readback.log`,
`java-suites.json`, `discovery.log`, `architecture.log`, `typecheck.log`, `lint.log`, `build.log`,
`jar-layout.json`, `links.json`을 구분한다. 브라우저 검증은 이번 파일 분리에서 재실행하지 않았다.
Git 상태는 시작·종료 모두 `main...origin/main [ahead 1]`이며 기존 관리자/CI 변경을 보존했다.

## 수정 중 실패와 처리

- 초기 이동 스크립트의 메서드 인식 오류는 source 변경 전에 중단됐다.
- 첫 compile에서 공통 `parse` 이름을 옮기다가 Java/Jsoup/Json의 qualified 호출 4개도 바뀌었다.
  해당 호출을 복원했고 최종 compile과 전체 회귀가 통과했다.
- 첫 사이트 검사 197건 중 오늘의유머 새 테스트 1건이 실패했다. 실제 fixture가 `.viewContent`를 사용하므로
  테스트의 `#viewContent` 선택자를 `#viewContent, .viewContent`로 수정했다. 제품 parser는 변경하지 않았다.
  이후 DB 포함 전체 273건에서 통과했다.

## 남은 단계

- fmkorea 430·ppomppu 403·PGR21 challenge·YouTube renderer 부재는 직전 실제 관측 상태를 유지한다.
  이번 합성 fixture 성공으로 실제 수집 성공 또는 활성화 가능 상태로 바꾸지 않는다.
- 원격 DB/object·Discord·지원 OS·Collector CI와 운영 관찰은 [수집 후속 계획](../../../../../docs/implementation/m0-interim-2026-09-23/collector-follow-up.md)을 따른다.
- 관리자 보완 결과와 원격 CI·수동 인수 잔여는 [Core 후속 결과](../admin-core/FIX-RESULTS.md)와
  [전체 잔여 과정](../../../../../docs/implementation/m0-interim-2026-09-23/remaining-process.md)을 따른다.
