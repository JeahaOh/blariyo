# 전체 출처 제목 정리 규칙 검토

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `12df6aed`
- 상태: 종료(검토 완료·구현 변경 없음) / 갱신: 2026-10-05 21:40 KST
- 요청: 모든 수집 규칙에서 제목의 출처·게시판 이름이 제거되는지 확인.
- 범위: 등록21출처 parser·공통 제목 함수·표시/승격 경로, 기존 HTML 표본 및 로컬 DB 읽기 대조. 코드/정책/DB/외부 사이트 변경·수집 실행 없음.
- 적용 스킬: `audit`. 프로젝트 G05에 따라 이 작업 기록만 작성한다.
- 앞선 collection-title-labels 종료 확인, 기존 변경 보존. commit/push/배포 없음.

## 결론

- 전체 제거 완료가 아니다. 등록21출처와 공통 규칙의 key 집합은 일치하고, 등록된 단일 접미사27종의 합성 검사는 통과했다. 그러나 실제 로컬87개 원제목에 현행 보정 함수를 적용하면6출처31건에 출처/게시판 표기가 남는다.
- 문제가 확인되지 않은9출처도 이번 표본에 한정한 결과다. 실제 DB 제목 표본이 없는6출처는 실자료 완전성을 확인하지 못했다. 운영 DB·외부 사이트 요청 없음.
- Collector는 원제목을 보존하고 화면/초안 저장 단계에서 정리하는 현재 설계다. 따라서 원문 DB에 출처가 남아 있다는 사실 자체는 결함으로 세지 않았다. 아래31건은 **보정 함수 적용 후에도** 남는 표본이다.

## 지적

### E1 / P1 / 정리 누락 / 신뢰도 높음

- `packages/contracts/src/draft-title.mjs:32-39`는 등록된 제목 끝 접미사 하나만 제거하며, 콜론·제목 앞 표기·게시판 결합형을 처리하지 않는다.
- 같은 함수를 사용하는 Web 목록499/상세531/초안220행과 API `batch-review.service.ts:167`에 동일하게 영향을 준다.
- 수정안: 출처별 실제 확인된 접두사·구분자·사이트/게시판 결합형을 등록하고 정상 본문 문구·일반 구분자 보존 조건을 유지한다. 임의의 하이픈/콜론 뒤 문구를 일괄 제거하지 않는다.

| 출처 | 재현 입력(본문은 예시) | 현재 결과 | 실자료 잔존 |
|---|---|---|---:|
| clien | `글 제목 : 클리앙` | `글 제목 : 클리앙` | 3 |
| dmitory | `이슈/유머 - 글 제목` | `이슈/유머 - 글 제목` | 17 |
| etoland | `글 제목 - 유머 게시판 - 이토랜드` | `글 제목 - 유머 게시판` | 1 |
| theqoo | `더쿠 - 글 제목` | `더쿠 - 글 제목` | 2 |
| todayhumor | `오늘의유머 - 글 제목` | `오늘의유머 - 글 제목` | 1 |
| yuldo | `글 제목 - 유머/이슈 - YULDO` | `글 제목 - 유머/이슈` | 7 |

### E2 / P2 / 제목 추출 우선순위 미보장 / 신뢰도 높음

- `source/common/HtmlDetailParser.java:24`와 `OrderedContentParser.java:51`은 `selectFirst("meta[property=og:title],title")`를 사용한다. 쉼표 선택자는 적힌 순서의 fallback이 아니라 DOM 순서상 첫 요소를 선택한다.
- 루리웹 `RuliwebDetailParser.java:15`도 `.subject_inner_text, meta[property=og:title],title`이므로 본문 제목을 먼저 선택한다는 보장이 없다.
- 실제 Jsoup로 title→og:title→본문 heading 순서의 최소 HTML을 실행했다. 공통/루리웹 선택자 모두 `title`을 반환해 재현했다.
- 영향: 본문에 정리된 제목이 있어도 출처/게시판 표기가 포함된 HTML title을 선택할 수 있다. 모든 사이트의 실자료에서 이 우선순위 문제가 발생했다고 주장하지 않는다.
- 수정안: 출처별 검증된 본문 제목 selector를 우선하고, 없으면 OG, 마지막에 HTML title을 개별 조회한다. 원제목 보존과 표시 제목 보정의 역할은 분리한다.

### R1 / P2 / 검사 표본 보강 / 신뢰도 높음

- 현행 `tests/draft-title.test.ts`는 유효7출처의 예시를 포함하지만6개 확인 반례를 검사하지 않는다. 테스트 통과를21출처의 모든 형태 지원으로 해석하면 안 된다.
- `apps/collector/src/test/resources/sites/observed/README.md:8-10`은 표본의 텍스트를 치환한다고 명시한다. mlbpark/natepann 표본의 title도 `fixture text` 등으로 치환되어 실제 사이트 표기 제거 증거로 사용할 수 없다.
- 수정안: 출처별 실제 제목 형식만 보존한 익명화 사례와 기대값을 만들고21출처 모두 prefix/suffix/결합형/일반 본문 보존을 검사한다.

### O1 / 현재 비활성 후보 수집 경로

- `collection-promotion.service.ts:107`과 `admin-collect.vue:88`의 후보 수집 경로는 제목을 trim하거나 그대로 사용하며 공통 보정 함수를 사용하지 않는다.
- 현재 고정 로컬 실행은 `collectBatchReviewEnabled`만 활성화하고 manual/Discord 후보 기능 flag를 설정하지 않는다(`scripts/local/start-development.mjs:124`, `collection-admin.guard.ts:20`). 현행 batch 경로 결함과 구분하며 재활성화할 때 동일 규칙 적용이 필요하다.

## 21개 출처 대조표

| 출처 | 등록 접미사 | 로컬 제목 표본 | 변경된 표본 | 정리 후 잔존 | 판정 범위 |
|---|---|---:|---:|---:|---|
| arcalive | 아카라이브, 베스트 라이브 | 3 | 3 | 0 | 이번 표본에서 잔존 없음 |
| bobaedream | 보배드림 베스트글, 보배드림 | 6 | 6 | 0 | 이번 표본에서 잔존 없음 |
| clien | 클리앙 | 3 | 0 | 3 | 누락 확인 |
| dcinside | 디시인사이드, HIT 갤러리 | 3 | 3 | 0 | 이번 표본에서 잔존 없음 |
| dmitory | 디미토리 | 17 | 0 | 17 | 누락 확인 |
| dogdrip | DogDrip.Net 개드립, DogDrip.Net, 개드립 | 2 | 2 | 0 | 이번 표본에서 잔존 없음 |
| etoland | 이토랜드 | 1 | 1 | 1 | 누락 확인 |
| fmkorea | 에펨코리아 | 0 | 0 | 0 | 실자료 미검증 |
| goodgag | 고급유머 | 2 | 2 | 0 | 이번 표본에서 잔존 없음 |
| humoruniv | 웃긴대학 | 1 | 0 | 0 | 이번 표본에서 잔존 없음 |
| instiz | 인스티즈 | 1 | 0 | 0 | 이번 표본에서 잔존 없음 |
| inven | 인벤 | 19 | 0 | 0 | 이번 표본에서 잔존 없음 |
| mlbpark | MLBPARK | 0 | 0 | 0 | 실자료 미검증 |
| natepann | 네이트판 | 0 | 0 | 0 | 실자료 미검증 |
| pgr21 | PGR21 | 0 | 0 | 0 | 실자료 미검증 |
| ppomppu | 뽐뿌 | 0 | 0 | 0 | 실자료 미검증 |
| ruliweb | 루리웹 | 19 | 0 | 0 | 이번 표본에서 잔존 없음 |
| theqoo | 더쿠 | 2 | 0 | 2 | 누락 확인 |
| todayhumor | 오늘의유머 | 1 | 0 | 1 | 누락 확인 |
| yuldo | 율도, YULDO | 7 | 7 | 7 | 누락 확인 |
| youtube-community | YouTube | 0 | 0 | 0 | 실자료 미검증 |

## 실행·변경 증거

- Node24 공통 함수 직접 실행: key21 일치, 단일 등록 접미사27종 통과, 반례6종 결과 재현.
- 로컬 DB `BEGIN READ ONLY`로87개 title 조회 후 종료. 제목 원문은 비공개 임시 파일(`/tmp/blariyo-title-audit-db.json`)에만 저장. 보고서에는 출처 표기와 가상 본문 예시만 사용했다.
- 원본·표시 경로의 코드/정본 및 정제 fixture의 범위를 대조. Java25/실제 Jsoup 선택자 재현 완료.
- 실제 입력 없이 합성한 형태의 검사는 해당 사이트의 현행 HTML 전체를 검증하지 않는다. 재수집/수정/발행/배포 없음.
- 변경 파일은 이 작업 기록 하나. `git diff --check` 및 작업 전후 상태 비교 확인.
