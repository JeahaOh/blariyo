# GTM 삽입 후 CI #14 브라우저 회귀 실패 보완

## 원인과 영향

- 실패 실행: [CI #14](https://github.com/JeahaOh/blariyo/actions/runs/36024095138), SHA `2f82f3e3a2751954a8d7a6167009d0e31870976c`.
- `verify`의 전체 브라우저 검사에서 41건 중 38건 통과·3건 실패. 실제 실패 지점은
  `tests/browser/collection.test.ts:156`, `tests/browser/core.test.ts:431`의 외부 요청 0건 검사이며
  상위 Core test 실패도 집계됐다.
- 두 화면 검사에 추가된 GTM 요청이 각각 2건·5건 기록됐지만 기대값은 여전히 `[]`였다.
  GTM을 삽입하면서 동의 검사만 보완·실행하고 기존 전체 브라우저 검사에 미치는 영향을 놓친 것이 원인이다.
- 같은 실행의 build·타입·lint·단위·Nest 통합 단계와 Collector job은 성공했다.
  `images`는 `verify` 실패로 skipped였다. 이미지 생성·게시 및 운영 배포 성공으로 해석하지 않는다.
- [이전 로컬 검증](RESULTS.md)의 브라우저 1건 통과는 전체 CI 통과 증거가 아니며 이번 실패로 범위 누락이 확인됐다.

## 수정

- [수집 화면 검사](../../../tests/browser/collection.test.ts)와 [Core 화면 검사](../../../tests/browser/core.test.ts)에
  정확한 `https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3` URL이면서 resource type이
  `script`인 요청만 빈 JavaScript 응답으로 대체했다.
- 새 문서 탐색에 따른 GTM 요청 수 2건·5건을 명시적으로 확인한다.
- 다른 URL·컨테이너·GA4 요청은 기존 외부 요청 목록에 계속 기록하고 0건을 요구한다.
  페이지 오류 0건 검사도 유지했다. 제품의 GTM 삽입·CSP·동의 코드는 변경하지 않았다.

## 검증

- 다른 세션의 localhost:3000/3100 개발 서버를 유지하기 위해 별도 Linux arm64 컨테이너를 사용했다.
- Git HEAD `2f82f3e`의 사본에 위 두 테스트 수정만 적용했다. 다른 세션의 미커밋 문서는 사본에 포함하지 않았다.
- Node 24.18.0, Playwright 1.63.0 Chromium, PostgreSQL 18, `npm ci`로 새 의존성을 설치했다.
- DB는 전용 컨테이너의 임시 저장소와 난수 fixture DB를 사용했다. host 포트는 공개하지 않고
  테스트 컨테이너와 loopback 네트워크만 공유했다. 외부 네트워크를 차단해 실제 Google 요청을 방지했다.

| 검사 | 결과 |
| --- | --- |
| API/Web `npm run build` | 통과 |
| API `npm run build:test -w @blariyo/api` | 통과 |
| `npm run typecheck:tests` | 통과 |
| `npm run lint:tests` | 통과 |
| `node --test --test-concurrency=1 tests/browser/*.test.ts` | 41/41 통과, 실패·취소·건너뜀 0, 174.427초 |
| 변경한 두 파일 Prettier 검사·`git diff --check` | 통과 |

- 이전 실패 두 지점과 GTM 동의 검사가 통과했다. 실제 예약 시각·outbox 재시도 검사는 128.231초를
  기다려 통과했으며 DB 시각이나 대기 시간을 강제로 변경하지 않았다.
- 검증 사본·로그·화면 증거: `/private/tmp/blariyo-gtm-ci-fix-q5farzeh/`.
- 이는 로컬 Linux arm64 실행 결과다. GitHub Ubuntu amd64의 수정 SHA 재실행, 이미지 게시,
  운영 배포 성공을 대신하지 않는다. 수정 커밋을 push한 뒤 새 CI 결과를 확인해야 한다.

## 작업 경계

- 수정 범위는 테스트 두 파일과 이 기록뿐이다. 다른 세션의 문서 변경과 개발 서버를 보존했다.
- push·원격 재실행·GTM 콘솔 변경·운영 배포는 수행하지 않았다.
