# 세션 종합 기록 — 배포 문서·CI·화면·콘텐츠·로컬 정책

- 기록일: 2026-09-20 KST
- 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 요청: 이 세션에서 수행한 작업 전체를 기록하고 트리 구조로 보고.
- 상세 작업 이력: [TASK.md](TASK.md)
- 이번 기록 시점의 독립 재확인: [session-verification.json](artifacts/session-verification.json)
- 제품/기술 정본을 대체하지 않는 작업 이력이다. 과거 PASS와 현재 상태를 구분한다.
- 이번 기록 요청에서는 문서·검증 요약만 작성했다. 앱·DB 변경, 새 테스트 실행, 운영 접속은 하지 않았다.

## 1. 앞선 운영 준비·배포 이력 연결

대화에 전달된 인프라 작업은 이미 [infrastructure-setup TASK-01~20](../infrastructure-setup/TASK-01.md)에
단계별로 기록되어 있다. 이 세션에서 동일한 작업을 다시 실행한 것으로 집계하지 않는다.

| 앞선 작업 | 기존 기록 |
| --- | --- |
| Lightsail·Cloudflare Access/MFA·R2 버킷/키·캐시 토큰·공개 이미지·실제 앱 R2 어댑터 검증 | [TASK-01](../infrastructure-setup/TASK-01.md) |
| Access 운영자 매핑·내부 인증키·DB 비밀번호·2GB 서버 확인·PostgreSQL 설치·image 검증 오탐 수정 | [TASK-02](../infrastructure-setup/TASK-02.md) ~ [TASK-08](../infrastructure-setup/TASK-08.md) |
| 서버 migration·공개 연락처·간결한 정책 초안 준비 | [TASK-09](../infrastructure-setup/TASK-09.md) ~ [TASK-11](../infrastructure-setup/TASK-11.md) |
| Web/Core runtime 분리·amd64 이미지·서버 보관·Nginx 설치 | [TASK-12](../infrastructure-setup/TASK-12.md) ~ [TASK-16](../infrastructure-setup/TASK-16.md) |
| 정책 초안 DB 등록·시행일 9월 20일 확정·정식 발행·앱/Tunnel 공개·예약 작업·로그 만료·R2 암호화 백업/복원 | [TASK-17](../infrastructure-setup/TASK-17.md) ~ [TASK-19](../infrastructure-setup/TASK-19.md) |
| 배포 결과 문서 현행화·기존 운영 commit | [TASK-20](../infrastructure-setup/TASK-20.md) |

당시 운영 배포 성공 기록은 유지한다. 이 기록 작성 시점에 운영 서버를 재검증하거나 재배포하지 않았다.
운영 현황은 [current-status](../../../docs/operations/current-status.md)에서 확인한다.

## 2. 이 세션의 작업 트리

```text
로컬 후속 작업
├── A. 운영 배포 방법·정책
│   ├── 흩어진 최초 설치 명령·증거를 실행서로 통합
│   ├── 재배포·실패 시 앱 복귀·부팅 helper 갱신 절차 정리
│   └── 단일 VM 교체 기본 / 블루그린 전환 조건 기록
├── B. GitHub CI
│   ├── PR·main 자동 검사 workflow 작성
│   ├── 검증된 main의 amd64 Web/Core GHCR 이미지 게시 설정
│   └── 최소 권한·action SHA 고정·운영 수동 배포 경계
├── C. M0 화면 1차 수정
│   ├── 공통 CSS·헤더·로고·목록·페이지 이동
│   ├── 상세·공유·현재 글 표시·404·오류 재시도
│   └── 푸터·정책 이력·반응형 검증
├── D. 실제 HOT 글 25건 1차 적재
│   ├── 더쿠 HOT 실제 목록/상세 조회·출처 증거
│   ├── 원제목·출처·검토 요약을 로컬 DRAFT로 저장
│   └── 중복 방지·재실행·DB readback
├── E. 사용자 재검토와 보고 정정
│   ├── wireframe 다열 표와 publishing 두 줄 목록 차이 확인
│   ├── 임시 preview와 지속 개발 DB가 다름을 확인
│   └── 정책 개발 DB 0건 / 임시 fixture 정책 사용 확인
├── F. 실제 정책 개발 DB 등록
│   ├── 기존 약관·개인정보 v0.1 + 비공개 연락처 사용
│   ├── 실제 PoliciesService로 EFFECTIVE 2건 등록
│   └── 중복 실행·API/DB 본문 일치 확인
├── G. M0 화면 2차 수정
│   ├── 짤 탭·제목 아래 보조 문구·현재 페이지 정보
│   ├── 로고·글꼴·정책 제목/본문/이력 구획
│   └── 권리 문의·주소 복사·닫기/포커스/모바일 검증
├── H. 지속적인 로컬 검수 서버
│   ├── localhost:3000 Web + loopback:3100 Core
│   ├── 실제 개발 DB·정책·문의 설정 연결
│   └── EMFILE 실패 후 빌드 산출물 실행으로 전환
└── I. 기록·현행 상태 확인
    ├── 작업/화면 검증 기록·실행 안내 갱신
    ├── 테스트 결과 요약 JSON 보관
    └── 동시 작업의 변경과 이 세션 성과 구분
```

## 3. 산출물과 수행 범위

| 작업 | 파일·위치 | 이 세션에서 확인한 결과 |
| --- | --- | --- |
| 배포 실행서 | [deployment-runbook.md](../../../docs/operations/deployment-runbook.md) | 최초 배포/재배포/복귀 절차 통합. 초기 도구의 IP/release 고정과 잔여 자동화 구분 |
| 배포 정책 | [deployment-policy.md](../../../docs/operations/deployment-policy.md) | 로컬→PR 검사→main 이미지→수동 운영 배포. 2GB 부족을 단정하지 않고 동시 앱 메모리 측정 조건 명시 |
| CI | [ci.yml](../../../.github/workflows/ci.yml) | Node 24.18.0·PostgreSQL 18·타입/lint/unit/통합/Chromium·GHCR. actionlint 통과, 원격 실행 미실시 |
| 화면 공통 | `apps/web/app/app.vue`, `assets/css/main.css`, `SiteHeader.vue`, `ListSkeleton.vue`, `apps/web/nuxt.config.ts` | CSS 분리·헤더/탭·로딩·레이아웃 |
| 목록/상세 | `PostList.vue`, `PageNumbers.vue`, `pages/[boardSlug]/index.vue`, `pages/[boardSlug]/posts/[postId].vue`, `error.vue` | 목록·상세·공유·404·오류·페이지 이동 |
| 정책/푸터 | `PolicyViewer.vue`, `SiteFooter.vue` | DB 정책 조회 유지, popup 구획·버전 이력·문의·포커스 복귀 |
| 화면 기준 | [03-screen-design.md](../../../docs/planning/03-screen-design.md), [화면 대조 기록](../../../docs/testing/ui-wireframe-review-20260920.md) | publishing 두 줄 목록 기준 명시. 로그인/광고 M0 제외, 발행 주기 대신 실제 페이지 정보 |
| 콘텐츠 최초 적재 | [community-hot-20260920.json](../../../scripts/content/community-hot-20260920.json), [import-local-drafts.mjs](../../../scripts/content/import-local-drafts.mjs) | 실제 출처 25건·요약 DRAFT, 원문 첨부 완성으로 보고하지 않음 |
| 실제 정책 입력 | [seed-policies.mjs](../../../scripts/local/seed-policies.mjs) | 기존 편집 원본과 연락처 읽기, 동일 버전 충돌 시 중단, 본문 비출력 |
| 로컬 실행 | [start-development.mjs](../../../scripts/local/start-development.mjs), [README](../../../scripts/local/README.md) | 고정 로컬 Web/Core·지속 DB, 운영 secret/DB 미사용 |
| 회귀 검사 | `tests/browser/core.test.ts`, `consent.test.ts`, `tests/helpers/browser-fixture.ts` | 화면 크기·제목 배치·탭·정책 popup·기존 기능 회귀 확인 |

화면 파일의 축약 경로는 `apps/web/app/` 기준이며 컴포넌트는 그 아래 `components/`에 있다.
README·deploy 안내·인프라 문서·작업 색인에도 위 실행서와 현황의 링크를 반영했다.

## 4. 검증 결과와 증거의 한계

이 세션 중 실행한 결과이며, 기록 작성 때 테스트를 다시 실행하지 않았다. 남아 있는 로그에서
숫자를 재추출해 [검증 요약](artifacts/session-verification.json)에 보관했다.

| 단계 | 결과 |
| --- | --- |
| 초기 root unit/architecture | 15 PASS, 실패 0 |
| 초기 Nest/PostgreSQL 통합 | 72 PASS, 실패 0 |
| 초기 전체 Chromium | 9 PASS, 실패 0 |
| 초기 후속 UI 회귀 | 6 PASS, 실패 0 — 전체 9건과 중복되는 재검사 |
| 정책/화면 2차 변경 후 전체 Chromium | 9 PASS, 실패 0 — 초기 9건의 재검사 |
| 타입·lint·build | Web 타입/build, scripts 및 tests 타입/lint 수행·통과; 단계별 범위는 TASK 참조 |
| CI 설정 | actionlint 1.7.12 exit 0. GitHub 실행·GHCR 실제 게시 증거 아님 |
| 화면 | 목록 320/390/768/1280, 상세 320/360/390/768/1280; 정책 popup 1280/390/320 검증 |
| 실제 로컬 정책 | HTTP 200·v0.1·DB 본문 SHA-256 일치, 실제 본문/문의/Escape 포커스/직접 경로 검증 |
| 정책 재실행 | 신규 2건 등록 후 재실행 신규 0, 기존 2 유지 |

화면 PNG는 `test-results/m0-browser/`의 list/detail/share/policy 크기별 파일이다. Git 제외이며
재검사 시 덮어쓸 수 있다. `/tmp` 원본 로그도 임시 파일이다. 이번 JSON은 그 요약을 보존한다.
픽셀 단위 디자인 동일성, 실제 운영 관리자 쓰기, 원격 CI 실행은 위 PASS로 대체하지 않는다.

## 5. 실패·중단·정정 이력

1. 최초 콘텐츠 actor key가 DB 제약에 맞지 않아 transaction 취소. 정식 `system:collector`로 수정했고 제약을 풀지 않았다.
2. 호스트 Chromium sandbox 기동 실패. 기존 Docker Playwright 검사 환경으로 검증했다.
3. 상세의 `목록으로` 링크가 2개가 되어 기존 테스트 선택자가 모호했다. 탐색 헤더 안의 링크로 범위를 한정하고 재검사했다.
4. 중단/재개 과정에서 CUA native pipe와 기존 실행 세션 연결이 끊겼다. 당시 임시 preview 종료 여부를 확인하지 못했다고 기록했다.
5. 이후 59689 서버 HTTP 200을 확인했으나 이를 실제 정책까지 갖춘 개발 서버처럼 안내한 것이 부정확했다. 별도 fixture DB임을 확인하고 정정했다.
6. 화면 크기/동작 PASS를 디자인 완성처럼 넓게 보고했다. 사용자 지적 후 제목/탭/정책 popup/문의 누락을 대조하고 2차 수정했다.
7. 3000 Nuxt dev의 파일 감시가 EMFILE로 반복 실패했다. 해당 실행을 종료하고 빌드한 Web/Core를 실행했다. 자동 갱신(HMR)은 제공하지 않는다.
8. 처음 저장한 콘텐츠는 실제 원문 기반 요약 초안이다. 전체 본문·이미지 스크랩 완료로 표현하지 않는다.

## 6. 기록 작성 시점의 현재 상태 — 동시 작업과 구분

공유 저장소에 다른 작업의 변경이 추가되어 있었다. 이전 시점 기록을 소급 수정하거나 모두 이
세션의 작업으로 합산하지 않는다. 아래 현재값은 이번 기록 요청에서 읽기 전용으로 재확인했다.

- `localhost:3000/meme`: HTTP 200.
- 약관/개인정보 API: HTTP 200, `v0.1`; 개발 DB TERMS/PRIVACY 각 EFFECTIVE 1건.
- 정책 본문 길이: TERMS 2,842자, PRIVACY 4,681자. 실제 연락처/본문 원문은 증거 JSON에 넣지 않음.
- 개발 DB host port: **5439**. Compose·로컬 실행 스크립트·Docker port mapping 일치.
  이 세션의 최초 적재 때는 **55439**였다. 이후 포트 변경 기록은 [로컬 실행 안내](../../../scripts/local/README.md)에 있으며 기존 volume은 유지된다.
- 개발 DB: **DRAFT 25건, 본문 블록 186개, 이미지 행 105개**. 최초 요약 적재 뒤 다른 작업에서 원문을 보완한 현재 상태다.
  그 작업의 절차·허락 확인·이미지/SNS 증거는 [콘텐츠 README](../../../scripts/content/README.md)를 따른다.
  이번 기록 시에는 이미지 파일 전수 검사나 원문 재수집을 다시 수행하지 않았다.
- 예전 `127.0.0.1:59689/meme`은 현재 연결 실패. 과거 임시 preview 성공 기록과 현재 가동 여부를 분리한다.
- 별도 보안/비용/캐시 문서·gateway 변경, 원문 수집 도구, HTTP 오류/cache 검사, DB 포트 변경은
  현재 tree에 존재하지만 이 세션의 직접 구현 성과로 집계하지 않았다. 기존 파일을 보존했다.
- Git: `main...origin/main [ahead 1]`, HEAD `2da659f`. 현재 작업 변경은 미커밋.
  `origin/main`은 로컬 remote-tracking ref 기준이며 이번 기록에서 fetch하지 않았다.

## 7. 다음 시작점과 미완료

1. GitHub에 반영한 뒤 실제 CI·이미지 게시·필수 검사 설정 확인. 이 세션은 commit/push/merge를 하지 않았다.
2. registry 읽기 인증·배포 대상 입력·부팅 helper·DB 호환성 확인 후 다음 운영 배포. 자동 CD/블루그린 미구현.
3. 실제 관리자 Access/MFA 통과 후 운영 쓰기 경로 검증. 테스트용 local admin PASS와 구분한다.
4. 콘텐츠는 원문 보완 후에도 개발 DB DRAFT다. 실제 영상 플레이어·운영 게시·사실 검토 완료와 혼동하지 않는다.
5. 현재 화면/정책 확인은 [localhost:3000](http://localhost:3000/meme). 재기동은 `scripts/local/README.md` 사용.
6. 이미지 없는 초기 요약 preview를 만드는 `.local-data/preview-ui.mjs`를 현재 원문 보완 데이터의 재시작 도구로 쓰지 않는다.

## 8. 기록 저장 위치

```text
worklog/task-list/09/20/
├── infrastructure-setup/
│   └── TASK-01.md … TASK-20.md    # 앞선 운영 준비·배포 이력
└── local-ui-cicd/
    ├── TASK.md                    # 수행 순서·단계별 결과
    ├── SESSION-RECORD.md          # 이 세션 전체 목차·파일·정정·현재값·인계
    └── artifacts/
        └── session-verification.json  # 비밀값 없는 검증 요약
```
