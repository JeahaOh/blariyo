# 전체 출처 제목 출처명·게시판명 전수 점검

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 / 갱신: 2026-10-06 20:58 KST
- 요청: 네이트판을 포함한 모든 배치 잡의 제목 출처 표기를 조사하고 수정한다.
- 담당 범위: 공통 `draft-title.mjs`, 제목 회귀 시험, `scripts/content/metadata-batch.mjs`, 관련 기획·화면·API 명세 및 이 기록. 이전 이 세션 제목 변경을 보존·확장한다.
- 담당 경계: 품질 도입 세션의 수정 경로·공유 빌드·Git 작업은 보존한다. 개인 실행 사본에서 API/Web을 빌드하고 이 세션 서버에 반영한다.
- 전수 범위: SourceRegistry 등록21개, 상세 parser21개, 목록/직접URL/queue/Discord/다중출처 wrapper의 경로, 별도 metadata batch. 실제 로컬139항목 중 제목128개·16출처를 읽기 전용으로 확보했다.
- 기준: 현행 기획/API 계약의 수집 원제목 보존은 유지한다. 표시/초안/발행 제목은 공유 함수로 보정한다. DB 수정·재수집·이미 발행된 글 일괄 변경·운영 배포·commit/push는 하지 않는다.
- 최초 발견: 네이트판10, 클리앙1, MLBPARK9, 더쿠10, 디미토리7, 율도9, 이토랜드2 =7출처48제목의 표기 보정 누락. 첫 설명의6출처는7출처로 정정했다.

## 출처별 전수 결과

| sourceKey | 로컬 제목 수 | 추가 보정 수 | 결과 |
| --- | ---: | ---: | --- |
| arcalive | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| bobaedream | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| clien | 1 | 1 | : 클리앙 |
| dcinside | 0 | 0 | 실제 제목 없음; 코드·합성 규칙 시험만 확인 |
| dmitory | 7 | 7 | 이슈/유머 접두어 |
| dogdrip | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| etoland | 2 | 2 | 유머 게시판 + 이토랜드 연속 접미사 |
| fmkorea | 0 | 0 | 실제 제목 없음; 코드·합성 규칙 시험만 확인 |
| goodgag | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| humoruniv | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| instiz | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| inven | 5 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| mlbpark | 9 | 9 | : MLBPARK |
| natepann | 10 | 10 | 네이트 판 공백/NBSP |
| pgr21 | 0 | 0 | 실제 제목 없음; 코드·합성 규칙 시험만 확인 |
| ppomppu | 0 | 0 | 실제 제목 없음; 코드·합성 규칙 시험만 확인 |
| ruliweb | 10 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| theqoo | 10 | 10 | 더쿠 접두어 |
| todayhumor | 5 | 0 | 실제 표본 기존 보정/원제목 유지 확인 |
| yuldo | 9 | 9 | 유머/이슈 + YULDO 연속 접미사 |
| youtube-community | 0 | 0 | 실제 제목 없음; 코드·합성 규칙 시험만 확인 |

## 경로·원인·수정

- 등록21개 상세 parser는 모두 HtmlDetailParser 계열이다. 일반 공통 추출 외 더쿠/웃대/인벤/YouTube override4개와 루리웹 별도 제목 selector도 확인했다. 목록 parser는 URL/날짜를 발견하고 제목은 상세 추출에서 가져온다.
- `batch → DirectBatchRunner`, `collect-url → DirectUrlRunner`, queue/Discord→BatchQueueWorker→DirectUrlRunner, 다중출처 Node 실행기→기존 batch 경로를 확인했다. 이 결과는 같은 batch DB/API 검수·초안 승격 경계에 모인다. Java는 계약대로 원제목을 저장하고 Web 표시·API 초안 제목만 정제한다.
- 공통 함수는21개 sourceKey의 알려진 사이트명/게시판명만 제거한다. 콜론·명칭 내부 연속 공백/NBSP, 확인된3개 출처 접두어, 반복된 접미사를 처리한다. 빈 제목·미등록 출처·다른 출처명·제목 중간 문구·일반 하이픈은 보존한다.
- 별도 개발용 `metadata-batch.mjs`는 후보 원제목을 보존하되 직접 만드는 게시글 제목에 같은 함수를 적용했다. site 인자는 등록 sourceKey 기준이다. 이 스크립트의 실제 외부 수집/발행은 실행하지 않았다.
- 기본 OFF인 legacy 후보 수동 승격 API는 sourceKey 없는 별도 호환 모델이다. 현행 batch 경로와 혼동하지 않고 이번 변경에서는 유지했다. legacy 활성화·모델 전환은 하지 않았다.
- 기존 관측 HTML fixture의 제목은 `fixture text`로 치환돼 있어 실제 출처 표기 차이를 검증할 수 없었다. 이번에는 실제 로컬 제목128개를 별도로 대조하고 등록21개와 테스트 case key 집합 일치 검사를 추가했다.

## 검증·적용

- Node24.18.0 제목 회귀25개 + migration/contract1개 =26 PASS. 원본 registry에 출처가 추가됐는데 제목 시험이 없으면 실패한다. 반복 적용 불변·본문 구두점·공백·다른 출처·빈 나머지/미등록 키 보호 포함.
- 로컬139항목/제목128개를 읽기 전용으로 대조했다. 추가 보정48건, 기존 보정45건, 원래 출처 표기가 없던35건 유지. 수정 전후 저장 제목139건 동일 readback 확인. 표본/집계는 비공개 `.local-data/title-label-audit-20261006/`에 보관한다.
- contracts typecheck/lint, metadata 스크립트 구문 검사, `git diff --check` PASS. 기획·화면·API·개발 Spec의 기존 링크 대상 존재와 문구를 동기화했다. API 계약 구조/DDL 변경 없음.
- 개인 실행 사본 `.local-data/development/todayhumor-title-build/`에서 API/Web 빌드 PASS 후 이 세션 localhost:3000/3100 서버 재시작. 변경 중인 다른 세션의 공유 dist/output은 덮어쓰지 않았다.
- Chrome에서 네이트판 목록10건의 접미사 제거와 대표 상세 제목·초안 입력 기본값 일치를 확인했다. 검수/초안 생성/발행 요청은 실행하지 않았다.
- 실데이터 없는 디시인사이드·에펨코리아·PGR21·뽐뿌·YouTube는 최신 원문 제목 실수집 검증을 하지 않았다. 전체 브라우저 회귀·실제 metadata 발행·기존 게시글 일괄 제목 정정·운영 적용·commit/push는 미실행이다.
