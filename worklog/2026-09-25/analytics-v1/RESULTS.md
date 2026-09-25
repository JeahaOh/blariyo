# GA4 analytics-v1 구현 및 로컬 검증

## 작업 범위와 결과

- 작업 기준 커밋: `8389eee` (`feat(analytics): implement GA4 event collection v1`). 로컬 `main`에 커밋했고 push·운영 배포는 하지 않았다.
- admin 화면·관리자 인증 변경은 이 커밋에 포함하지 않았다. 다른 admin·Git harness·수집 작업의 미커밋 파일은 작업 트리에 보존했다.
- 앱이 직접 GA4를 전송하는 9개 이벤트 계약을 구현했다: `page_view`, `list_impression`, `select_content`, `list_page_change`, `scroll`, `content_engagement`, `share_open`, `share`, `share_result`.
- 동의는 `version=3`, `scope=analytics_v1`로 저장한다. 기존 version2 선택을 확장 동의로 승계하지 않는다. 허용 이벤트·매개변수 allowlist, 필수 필드와 형식 검증, 공유 시도/결과 연결, 철회 시 미완료 비동기 결과 폐기를 적용했다.
- 목록·상세 공개 응답에 `analyticsContentKey`를 추가했다. Core가 운영 비밀키로 HMAC-SHA256을 계산하며 DB migration이나 별도 이벤트 저장소는 추가하지 않았다.
- BigQuery 원시 저장·집계는 첫 구현에서 제외하고 후속으로 분리했다. 실제 GA4 속성·GTM 콘솔 설정·공개 법무 고지는 이 구현으로 변경하지 않았다.
- macOS에서 재사용할 Docker Playwright 실행기와 안내를 추가했다. 실행 명령은 Node 24.18.0에서 `npm run test:browser:docker -- tests/browser/analytics-events.test.ts`다. 설치된 Playwright 버전과 맞는 이미지를 사용하고 브라우저 endpoint는 loopback에만 노출한다. 사용 중인 포트/컨테이너를 건드리지 않으며 이번 실행이 만든 컨테이너와 격리 테스트 DB를 회수한다.

## 검증 증거

모든 검사는 로컬 개발 환경에서 수행했다. 테스트 DB는 Docker Compose PostgreSQL의 `postgres` DB 안에 생성되는 무작위 `m0_browser_*` 이름의 임시 DB이며 운영 DB를 사용하지 않았다.

| 검사                                                                           | 결과                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `npm run build -w @blariyo/api`                                                | 통과                                                                                                    |
| `npm run test:unit -w @blariyo/api`                                            | 33/33 통과                                                                                              |
| `node --test tests/consent.test.ts`                                            | 6/6 통과                                                                                                |
| 테스트 파일 ESLint 및 `tsc -p tests/tsconfig.json --noEmit`                    | 통과                                                                                                    |
| Docker Playwright `tests/browser/analytics-events.test.ts`                     | 1/1 통과. 15초 이상 활성 체류, 공유 창 열기, 브라우저 공유 불가 시 복사 fallback, 시도·결과 연결값 확인 |
| Docker Playwright `tests/browser/consent.test.ts`                              | subagent 실행 1/1 통과                                                                                  |
| `node --check scripts/local/playwright-tests.mjs`, `git diff --cached --check` | 통과                                                                                                    |
| Playwright 종료 정리                                                           | 실행기 소유 컨테이너 없음, `m0_browser_*` 임시 DB 0개 확인                                              |

Playwright의 Google tag 응답은 localhost에서 대체했다. 따라서 실제 Google 전송·GA4 DebugView 수신·GTM 태그 구성을 확인한 결과가 아니다. 전체 브라우저 suite와 CI는 이번 기록의 검증 범위에 포함하지 않는다.

## 운영 활성화 차단 조건

- 런타임 기본값은 `ga4Enabled=false`, `analyticsApproved=false`, Measurement ID 빈 값이다. 실제 GA4 수집을 켜지 않았다.
- `ANALYTICS_CONTENT_KEY_SECRET`은 production API 시작에 필요한 설정이다. base64 decode 결과가 32바이트 이상인 무작위 값을 비밀 저장소에 설정해야 한다. 실제 값은 이 기록에 남기지 않는다.
- 실제 GA4 Measurement ID와 속성 보관 기간, Google 계약 법인·처리 국가 및 필요한 국외이전 고지, 공개 version3 동의 고지를 확정·검토해야 한다. 관련 법무 문서의 `[출시 차단]` 값은 해소되지 않았다.
- GA4 direct 전송을 켜기 전에 GTM에서 같은 GA4 목적지로 전송하는 태그가 중지됐는지 확인해야 한다. GTM 로더가 실제 운영에서 동작한다는 기존 증거는 태그 목록·동의 조건·중복 여부를 확인한 증거가 아니다.
- 확정한 CSP 허용 origin을 배포하고 실제 공개 브라우저에서 동의 전 요청 0건, 동의 후 허용 이벤트, 철회 후 전송 중단을 네트워크 수준으로 확인해야 한다. 실제 GA4 DebugView에서 9개 이벤트와 중복·개인정보 누출 여부를 대조해야 한다.
- 운영 환경값, 실제 법무 고지, 같은 목적지 GTM 상태, 실제 네트워크 및 DebugView, push·CI·배포는 미검증·미실행이다. 로컬 통과를 운영 승인으로 해석하지 않는다.

## 관련 정본과 도구

- [개발 명세](../../../docs/development-specs/m0-core/analytics-consent/analytics-consent.dev.md#analytics-v1)
- [GA4 운영 활성화 기준](../../../docs/legal/cookie-settings.md#3-기능-활성화-경계)
- [개인정보 처리 고지](../../../docs/legal/privacy-policy.md)
- [Docker Playwright 실행 방법](../../../docs/testing/local-playwright-docker.md)
- GTM 삽입·배포의 과거 증거는 [GTM 결과 기록](../google-tag-manager/RESULTS.md)과 [GTM 운영 배포 기록](../google-tag-manager/PRODUCTION-DEPLOYMENT.md)에서 구분해 확인한다.
