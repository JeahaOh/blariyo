# GitHub Actions 소요 시간과 대안 검토

- 담당: Codex (현재 세션)
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치·소스: `release@c4fd0f9`
- 상태: 종료
- 갱신: 2026-10-04 KST
- 요청: Actions가 오래 걸리는 원인과 다른 방법 검토만 수행.
- 범위: 로컬 source·GitHub 실행 화면·공식 문서 조회, 이 기록만 추가. workflow·테스트·설정·Git ref·운영 자원은 변경하지 않는다.
- 기존 미커밋 `worklog/2026-10-04/predeploy-db-review/`는 보존한다. 이 기록도 미커밋이며 release 직접 commit하지 않는다.

## 실제 시간

- [PR CI #53](https://github.com/JeahaOh/blariyo/actions/runs/37181975219): 성공, 전체 9분 29초. verify 9분 25초, collector 4분 58초는 서로 병렬. 이미지는 PR이라 미실행.
- [verify 상세](https://github.com/JeahaOh/blariyo/actions/runs/37181975219/job/111376199033): npm ci 10초, Java fixture 준비 65초, 앱·테스트 build 17초, scripts/tests 타입·lint 12초, Web 타입 6초, npm test 6초, DB 통합 155초, Chromium 설치 22초, 브라우저 검사 247초.
- DB+브라우저 합계 402초는 verify 565초의 약 71%. verify 단계가 순차 실행되어 전체 시간을 결정한다.
- [collector 상세](https://github.com/JeahaOh/blariyo/actions/runs/37181975219/job/111376198904): test:collector 253초, bootJar/fixtureClasspath 9초. collector 시간을 verify에 더해서 전체 시간으로 계산하면 안 된다.
- [main CI #49](https://github.com/JeahaOh/blariyo/actions/runs/37097727564): 전체 10분 47초, verify 9분 44초, collector 5분 11초. Docker build summary의 API 35초/Web 34초는 build action 시간이며 job 전체 시간이 아니다.
- 조회 시작 시 main CI #54 `4cbfec2`는 실행 중이었다. 위 완료 실행으로 병목을 판단하며 #54의 최종 결과는 이 검토에서 확인하지 않는다.

## 코드 근거

- `.github/workflows/ci.yml:39-50`: Java fixture, 앱 build, 정적 검사, DB, 브라우저가 한 verify job에 순차 배치되어 있다. 단위·계약 검사도 무거운 준비 뒤 실행된다.
- 같은 파일 `:1-9`, `:108-110`: PR와 main push에서 전체 검사를 각각 실행하고 성공 후 main 이미지를 게시한다. 일반 feature/release push마다 실행되는 설정은 아니다.
- 같은 파일 `:33-36`, `:81-84`: Java 설정에는 Gradle cache 설정이 없다. npm·Docker cache는 이미 있다.
- `scripts/test-nest-integration.ts:34-55`: 테스트 파일마다 일회용 DB를 만들고 순차 실행·정리한다.
- `tests/browser/local-workers.test.ts:104`: 현재 시각+75초를 다음 분으로 올림하여 실제 예약 시각을 잡는다. 약 75~135초 뒤 슬롯을 검증하므로 CPU 개선으로 제거되는 지연이 아니다.
- 브라우저 실행기는 Playwright Test CLI가 아니라 `node --test --test-concurrency=1`이다. `playwright --shard` 설정만 넣어 분할되는 구조가 아니다.
- `scripts/test-collector-readback.mjs`: Gradle `test --rerun-tasks --no-daemon`으로 실행한다. 의존성 cache는 유효하나 테스트 성공 결과 재사용이나 무조건적인 rerun 제거를 추천하지 않는다. 실제 임시 DB readback과 결과 완전성 검사를 유지해야 한다.
- Dockerfile은 API/Web 공통 build를 두 matrix runner에서 수행하지만 현재 측정에서는 우선 병목이 아니다. schema restore도 이미 별도 일일/수동 workflow로 분리되어 있다.

## 추천 순서

1. 검사 범위 유지: 빠른 계약·정적 검사와 DB 통합, 브라우저, Collector를 독립 job으로 분리한다. DB와 브라우저는 별도 runner/DB에서 병렬 실행한다. 브라우저에 Java fixture가 실제로 필요한지 의존성을 확인하고 필요 없는 준비를 복제하지 않는다. 이미지 게시 gate는 필수 job 전체 성공을 유지한다.
2. Gradle 의존성 cache 추가. 공식 setup-gradle 또는 setup-java의 Gradle cache 중 하나만 선택하고 현재 지원 버전·무료 cache backend·SHA pin을 검토한다. 빌드 결과 재사용과 실제 DB 테스트 실행은 구분한다.
3. 파일별 DB 통합 검사를 제한된 동시성으로 실행하거나 runner별로 분할한다. DB 이름·role·port·파일 경로 격리, 최대 연결 수, 실패 시 정리와 결과 집계를 검증한다. 무제한 병렬화는 하지 않는다.
4. 일반 문서/worklog 변경만 있을 때 무거운 검사를 줄이는 조건을 설계한다. docs 아래 OpenAPI·계약 등 실행 입력은 문서 전용으로 취급하지 않는다. 공통 계약·lockfile·workflow·fixture 변경은 관련 전체 검사로 확장한다. main의 새 SHA에 이미지가 없어 배포가 막히는 경우도 함께 처리해야 한다.
5. 실제 시계 예약 테스트는 유지하면서 나머지 브라우저 파일과 분리하는 방안을 검토한다. 매 PR 대신 정기 실행으로 옮기는 선택은 검증 공백을 허용하는 별도 정책 결정이다.

실측 단계 시간을 기준으로 독립 job 분리 후 전체 PR 5~6분대를 1차 실험 목표로 둘 수 있다. 이는 보장이나 측정 결과가 아니다. 추가 runner 준비·의존성 설치·artifact 전달·동시 실행 한도에 따라 달라지며, 총 runner 사용 시간이 줄어든다는 뜻도 아니다.

## 대안 비교

| 대안 | 이점 | 부담·한계 | 판단 |
| --- | --- | --- | --- |
| Actions 유지, 작업 분리·cache·변경 범위별 실행 | 검사 증거와 원격 재현성 유지, 이전 부담 작음 | workflow/fixture 분리 검증, 병렬 runner 시간 증가 가능 | 우선 추천 |
| 로컬 전체 검사 + Actions 빠른 검사·이미지 게시 | 원격 대기 단축, 개인 개발에 단순 | 검사 누락·dirty 소스·Linux 차이, 검사한 후보와 main 이미지의 동일성 증거 필요 | 선택 가능, 현재 실패 이력상 1차 추천 아님 |
| 전용 Linux self-hosted runner | 환경·의존성 유지, 장비 성능 통제 | 업데이트·격리·온라인 유지·비용, 실제 시계 대기는 남음 | 병렬화 후에도 부족할 때 |
| Jenkins 등으로 CI 교체 | 실행 흐름을 직접 통제 | 이전·운영 부담, 같은 순차 테스트는 그대로 느림 | 현재 비추천 |

운영 VM을 빌드/테스트 runner로 겸용하거나 현행 개인 작업 폴더를 상시 runner workspace로 사용하는 방안은 추천하지 않는다. 테스트 자원·자격 증명과 운영/사용자 파일을 분리해야 한다.

## 공식 근거·검증 한계

- [Gradle GitHub Actions](https://docs.gradle.org/current/userguide/github-actions.html): Gradle User Home의 배포본·의존성·build cache 저장/복원.
- [Playwright CI](https://playwright.dev/docs/ci#caching-browsers): 브라우저 바이너리 cache는 복원 비용이 다운로드와 비슷하고 Linux 시스템 의존성을 대신하지 않아 기본 추천이 아니다. 현재 설치 22초이므로 우선순위 낮음.
- [GitHub self-hosted runner](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners): 사용자 장비에서 실행하며 OS·소프트웨어 유지보수와 장비 비용은 사용자 책임.
- 제안은 source·실제 완료 실행을 근거로 한 검토다. 변경 구현·성능 실험·CI 재실행은 하지 않았다. 적용 시 동일 후보에서 전체 테스트 수·실패 검출·정리·이미지 gate를 비교하고 cache cold/warm 각각 여러 회 시간을 측정해야 한다.
