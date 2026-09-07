# Task 07. 전체 후보 사이트별 Source Spec 작성 검수

## 1. 요청

- 사용자가 앞서 입력한 전체 커뮤니티 사이트를 대상으로 사이트별 수집 출처 명세를 작성한다.
- 여러 에이전트가 동시에 나눠 진행하고, 루트 에이전트가 최종 검수한다.
- 커밋과 push는 수행하지 않는다.

## 2. 범위

- 대상 경로: `docs/planning/content-collection/sources/`
- 기준 템플릿: `docs/planning/content-collection/source-spec-template.md`
- 대상 사이트:
  - 디시인사이드
  - 에펨코리아
  - 뽐뿌
  - 클리앙
  - 인벤
  - 오늘의유머
  - 보배드림
  - MLBPARK
  - 개드립
  - 더쿠
  - 인스티즈
  - 네이트판
  - 아카라이브
  - 웃긴대학
  - 루리웹
  - 고급유머
  - 이토랜드
  - 율도
  - 디미토리
  - 피지알21

## 3. 산출물

다음 20개 문서를 생성했다.

- `docs/planning/content-collection/sources/arcalive.md`
- `docs/planning/content-collection/sources/bobaedream.md`
- `docs/planning/content-collection/sources/clien.md`
- `docs/planning/content-collection/sources/dcinside.md`
- `docs/planning/content-collection/sources/dmitory.md`
- `docs/planning/content-collection/sources/dogdrip.md`
- `docs/planning/content-collection/sources/etoland.md`
- `docs/planning/content-collection/sources/fmkorea.md`
- `docs/planning/content-collection/sources/goodgag.md`
- `docs/planning/content-collection/sources/humoruniv.md`
- `docs/planning/content-collection/sources/instiz.md`
- `docs/planning/content-collection/sources/inven.md`
- `docs/planning/content-collection/sources/mlbpark.md`
- `docs/planning/content-collection/sources/natepann.md`
- `docs/planning/content-collection/sources/pgr21.md`
- `docs/planning/content-collection/sources/ppomppu.md`
- `docs/planning/content-collection/sources/ruliweb.md`
- `docs/planning/content-collection/sources/theqoo.md`
- `docs/planning/content-collection/sources/todayhumor.md`
- `docs/planning/content-collection/sources/yuldo.md`

## 4. 최종 판정 요약

모든 출처는 `활성 단계: 비활성`로 작성했다.

| 판정 | 사이트 |
| --- | --- |
| Discord·운영자 URL 수집 보조 차단 / 자동 수집 차단 | 디시인사이드, MLBPARK, 인스티즈, 네이트판, 웃긴대학, 고급유머, 피지알21 |
| Discord·운영자 URL 수집 보조 보류 / 자동 수집 보류 | 에펨코리아, 뽐뿌, 클리앙, 인벤, 오늘의유머, 보배드림, 더쿠, 아카라이브 |
| Discord·운영자 URL 수집 보조 보류 / 자동 수집 차단 | 개드립, 루리웹, 이토랜드, 율도, 디미토리 |

## 5. 루트 검수 정정

다음 3개 문서에서 최종 판정은 보류 또는 차단인데 `이용약관·robots.txt 확인과 승인`이 체크된 모순을 발견했다.

- `docs/planning/content-collection/sources/dogdrip.md`
- `docs/planning/content-collection/sources/mlbpark.md`
- `docs/planning/content-collection/sources/natepann.md`

정정 내용:

- `이용약관·robots.txt 확인`은 체크 상태로 유지
- `운영 위험 판정`은 별도 미체크 항목으로 분리

## 6. 검증 결과

- `git diff --check`: 통과
- 문서 상대 링크 검사: 통과
- 생성 파일 수 검사: 20개 확인
- 모든 source spec의 기본 활성 단계: `비활성`
- 비밀값·토큰·쿠키 원문 패턴 검사: source spec 기준 발견 없음

## 7. 미검증·주의

- 실제 parser 구현, fixture, runtime 수집은 수행하지 않았다.
- 출처 운영 위험 판정이나 법무 검토 완료는 없다.
- 약관·robots.txt는 2026-09-03 기준 확인이며, 출시 전 재확인이 필요하다.
- 고급유머는 기존 벤치마킹 문서 기준 수집 출처가 아니라 벤치마킹 대상으로 유지한다.
