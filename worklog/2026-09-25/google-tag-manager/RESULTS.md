# Google Tag Manager 공통 삽입

- 요청: `GTM-5BRTQ5T3` script를 head 상단, noscript iframe을 body 바로 뒤에 삽입.
- 결과: 로컬 구현·검증 완료. commit·push·운영 배포와 GTM 콘솔 변경은 수행하지 않았다.
- 기준선: `main...origin/main [ahead 1]`. 기존 문서 변경과 작업 중 생성된 다른 worklog를 보존했다.

## 변경

- [공통 HTML·CSP](../../../apps/web/server/plugins/security.ts): Nitro `render:html`의 head와
  bodyPrepend 맨 앞에 각 1회 삽입. 기존 응답별 nonce와 Google 공식 nonce 전달 코드를 적용하고
  script/img/connect/frame에 정확한 `https://www.googletagmanager.com` origin을 허용했다.
- [GA4 adapter](../../../apps/web/app/utils/consent.mjs): 공용 dataLayer를 교체하지 않고 동의 철회 시
  adapter 자신이 넣은 명령만 제거한다. GTM 시작 이벤트와 push 함수 참조를 보존한다.
- Window 타입과 기존 단위·브라우저 회귀를 GTM object event와 GA4 명령의 공존에 맞췄다.
- [분석 계획](../../../docs/planning/04-analytics-ad-plan.md), [보안 설계](../../../docs/system-design/05-security-operations.md),
  [법무 안내](../../../docs/legal/README.md)에 동의 전 GTM 요청과 기존 직접 GA4 동의 제어의 차이를 기록했다.

## 검증 결과

Node 24.18.0, 현재 Web build를 사용했다.

| 검사 | 결과 |
| --- | --- |
| `npm run build -w @blariyo/web` | 통과 |
| `npm run typecheck:web`, `npm run lint -w @blariyo/web` | 통과 |
| `npm run typecheck:tests`, `npm run lint:tests` | 통과 |
| `node --test tests/consent.test.ts` | 5/5 통과 |
| `node --test tests/http/web-cache.test.ts` | 4/4 통과, 상위 test 1개 포함 |
| `node --test tests/browser/consent.test.ts` | Chromium 통합 1/1 통과 |
| `git diff --check` | 통과 |

- 브라우저: 응답 HTML의 정확한 삽입 위치와 중복 없음, GTM 요청 ID, inline→동적 script nonce와
  CSP 일치, 동의 전·거부·허용·철회 시 기존 GA4 동작, GTM 초기 이벤트 보존, SPA 왕복 시
  GTM 1회 로드, JavaScript 비활성 noscript iframe 요청과 0×0 크기를 확인했다.
- Google script·iframe은 Playwright 대체 응답으로 검증했다. 실제 Google에 분석 이벤트를 보내거나
  실제 컨테이너의 태그 구성을 검증한 결과가 아니다.
- 브라우저 fixture는 `127.0.0.1:5439/postgres`의 `blariyo_local` 역할로 난수 시험 DB를 만들고
  종료 시 해당 DB만 제거했다. 지속 개발 DB·운영 DB는 사용하지 않았다.
- 최초 Chromium 기동은 macOS sandbox의 `bootstrap_check_in ... Permission denied`로 실패했고,
  권한 승인 후 같은 검사 재실행이 통과했다. 테스트 타입 검사에서 GTM object의 숫자 인덱스 접근
  오류 1곳을 발견해 GA4 명령 타입을 먼저 구분하도록 보완한 뒤 타입·lint·브라우저를 재검증했다.

## 남은 범위

- 운영 배포와 실제 Tag Assistant·GTM 콘솔 확인은 미실행이다.
- GTM 컨테이너는 GA4 feature flag·동의와 독립적으로 로드한다. 콘솔에서 게시한 태그의 동의 조건,
  목적지 CSP, 기존 GA4와 중복 측정, 실제 쿠키·요청과 공개 정책 정합성은 배포 전에 별도 확인한다.
- Google 계약 법인·처리 국가·보관기간과 기존 법무 placeholder를 추정하거나 제거하지 않았다.

근거: [Google Tag Manager CSP 안내](https://developers.google.com/tag-platform/security/guides/csp).
