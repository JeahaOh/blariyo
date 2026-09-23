# 배포 실행서·GitHub CI·M0 화면·실제 HOT 25건

전체 세션 목차·보고 정정·현재 상태·인계는 [세션 종합 기록](SESSION-RECORD.md)에 있다.
아래는 수행 당시의 기록이며 이후 DB 포트·원문 수집 보완 상태를 소급 적용하지 않는다.

- 일자: 2026-09-20 KST
- 요청: 배포 방법 기록 확인, 배포 정책·무중단 검토, 화면 완성, 실제 인기 콘텐츠 25건 DB 보관.
- 범위: 로컬 source·문서·CI 설정·로컬 PostgreSQL. 운영 배포·콘텐츠 공개·push는 수행하지 않음.
- Git 시작: `main`, `origin/main`보다 1 commit 앞. 기존 운영 배포 commit `2da659f` 유지.
- 작업 도중 별도 보안·캐시·알림 문서/스크립트 변경이 나타났으며 이 작업 결과로 합산하지 않고 보존했다.

## TASK A — 배포 방법과 정책

기존에는 TASK-19의 성공 증거와 `deploy/*`의 도구별 안내가 있었으나, 한 문서에 연결한
최초 설치·재배포·복귀 절차는 부족했다. 실제 Python·Compose·systemd source를 읽고
[실행서](../../../docs/operations/deployment-runbook.md)를 작성했다.
초기 설치 도구의 고정 IP/release와 재배포 때 부팅 helper 갱신 필요를 명시했다.
gateway의 “앱/Tunnel 연결 전”, 14일 로그 설명을 현재 기동·7일 미만 로그 기준으로 현행화했다.

[배포 정책](../../../docs/operations/deployment-policy.md):
로컬 개발 → PR 검증 → 검증된 main의 GHCR amd64 image → 운영자 수동 배포.
현재 단일 VM 순차 교체는 짧은 요청 실패가 가능하다. 같은 VM 블루그린은 동시 메모리·공유 DB 호환성·
Nginx 전환·진행 중 요청·단일 worker·구 자산 보관 검증 뒤 전환하는 후보로 기록했다.
2GB의 현재 서비스 부족을 단정하거나 증설·고정 IP를 적용하지 않았다.

## TASK B — GitHub CI

[workflow](../../../.github/workflows/ci.yml) 추가:

- PR/main/수동 실행, Node 24.18.0, 임시 PostgreSQL 18.
- 타입·lint·unit·Nest 통합·Chromium 검사. 실패 시 image 게시 차단.
- 검증된 main만 API/Web amd64를 GHCR에 Git SHA tag로 게시, immutable digest 기록.
- 전체 action SHA 고정, PR 읽기 권한, image job만 packages write.
- 운영 비밀·SSH 미사용. 자동 운영 배포 job 없음.

공식 actionlint 1.7.12 Docker image로 workflow 검사 exit 0.
다운로드 image digest: `sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`.
원격 Actions 실행·branch protection·GHCR 게시·서버 pull은 미실행이다.

## TASK C — M0 화면

[대조 기록](../../../docs/testing/ui-wireframe-review-20260920.md)에 항목별 변경을 기록했다.
공통 CSS를 분리하고 로고/헤더·목록·상세·공유 sheet·404·푸터·오류 재시도를 수정했다.
planning의 헤더 설명 충돌도 새 시각 기준에 맞췄다. M1 회원/광고 기능은 추가하지 않았다.

실제 제목을 사용한 로컬 임시 DB 사본으로 Chrome 목록/상세를 시각 확인했다.
저장용 DB의 25건 DRAFT와 별개이며 운영 게시글은 만들지 않았다.
일시 중단 후 CUA 브라우저 연결이 없어 마지막 검수는 기존 프로젝트 Chromium 자동 검사와 PNG로 수행했다.
중단 전 임시 preview 실행 세션 재연결은 불가했고 프로세스 조회도 환경에서 거부돼 종료 여부는 확정하지 않았다.
이후 일반 앱·실서버가 아닌 검사 산출물의 경로로 결과를 제공한다.

## TASK D — 실제 HOT 25건

[수집 데이터와 실행 안내](../../../scripts/content/README.md).
2026-09-20 더쿠 HOT 목록 1~3페이지와 상세 25개를 실제 HTTP 조회했다.
URL·제목·표시 시각·관측 시각·조회/댓글 수·응답 hash를 보관했다. 전체 커뮤니티 순위라는 주장은 하지 않는다.
원문 이미지·댓글·전체 본문은 복제하지 않고 직접 쓴 검토 요약과 미확인 사항을 저장했다.
이미지 중심 글은 내용을 상상해 채우지 않았다. 재사용 권리와 개별 주장 검증은 미완료다.

- 저장: 로컬 `127.0.0.1:55439/blariyo_local`, 실제 PostsService 사용.
- 최초 실행: 신규 25, `DRAFT=25`, 공개 0.
- 재실행: 신규 0, 기존 25 유지. source URL 중복 방지.
- 독립 SQL readback: `DRAFT|25`.
- 최초 actor 식별자 제약 오류는 transaction 취소. 정식 `system:collector`를 사용해 성공, 제약 변경 없음.
- 사용자에게 저장 대상을 물었으나 응답이 없어 기존 로컬 작업 원칙으로 진행했다.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| Web 타입·Core/Web build | PASS |
| scripts 타입/lint, tests 타입/lint | PASS |
| root unit/architecture | 15 PASS |
| Nest/PostgreSQL 통합 | 72 PASS, 실패 0 |
| Chromium 전체 | 9 PASS, 실패 0 |
| 후속 UI 재시도·share 위치 회귀 | Core 6 PASS, 실패 0 |
| 화면 크기 | 목록 320/390/768/1280, 상세 320/360/390/768/1280 가로 넘침 없음 |
| 공유창 | 1280/390/320 화면 안에 위치, 모바일 하단 정렬 assertion PASS |
| CI 정적 검사 | actionlint exit 0 |
| 콘텐츠 저장·재실행·SQL readback | 25 DRAFT, 중복 없음 |

처음 호스트 Chromium은 macOS sandbox 권한으로 기동 실패했고 기존 검증용 Docker Playwright
서버를 사용해 통과했다. 전체 브라우저 검사에서 “목록으로” 링크 2개로 인한 기존 선택자 모호함을
찾아 탐색 헤더로 범위를 한정한 뒤 다시 통과했다. 실패를 최초부터 통과한 것으로 기록하지 않는다.

## 남은 외부 단계

GitHub push 후 실제 CI/이미지 게시 확인, 필수 검사 설정, registry 읽기 인증·배포 대상 parameter 정리,
다음 운영 배포와 실제 Access 관리자 쓰기 검증은 별도다. 이번에는 commit·push·운영 재배포를 하지 않았다.
콘텐츠는 발행 전 원출처·권리·사실관계 검토가 필요하다.

## 후속 요청 — 정책 개발 DB 등록과 화면 차이 수정

사용자가 실제 정책 등록과 디자인 수정 실행을 요청했다. 조회 당시 지속 개발 DB의 정책은 0건,
기존 미리보기는 테스트 fixture 정책이었다. 기존 화면 완료 보고의 과장과 서버 안내 차이를 정정했다.

- `scripts/local/seed-policies.mjs --apply`: 기존 M0 편집 원본/연락처를 사용해 실제 정책 service로
  로컬 TERMS/PRIVACY `v0.1` EFFECTIVE 등록. 신규 2건, 재실행 신규 0건. 본문 2,842/4,681자.
- `localhost:3000/api/v1/policies/{terms,privacy}` HTTP 200·v0.1·DB 원문 해시 일치 확인.
- 목록 제목 아래 보조 문구, 페이지 정보, `짤` 탭, 로고/글꼴, 정책 제목·본문·이력 구획과 푸터 순서 보완.
- `scripts/local/start-development.mjs`: 고정 loopback 3000/3100, 지속 DB 55439. 실제 문의 설정 주입.
  Nuxt dev는 EMFILE 파일 감시 한도 오류로 중단했고, 빌드 산출물 실행으로 전환했다. HMR은 제공하지 않는다.
- 실제 로컬 서버 1280/390/320px 정책 popup과 직접 정책 경로를 Chromium으로 확인.
  전체 브라우저 9건, Web typecheck/build, tests typecheck/lint 통과. 정책 중복 등록 없음.
- 수집 게시글은 DRAFT 25건 유지. 운영 DB·배포·commit·push는 변경하지 않았다.

시작/종료와 주소는 [로컬 서버 안내](../../../scripts/local/README.md)를 따른다.

## 2026-09-20 추가 — 푸터 권리 문의와 바깥 배경

- 사용자 요청: 독립 이메일 복사 버튼 제거, 권리 문의에서 메일 작성 창이 열리지 않으면 주소·양식 복사/alert, 더쿠 푸터 참고, 헤더와 바깥 여백 색 구분.
- 참고 URL: https://theqoo.net/findmeinyourmemory/4349247012 — 공개 HTML에서 footer 왼쪽 로고/오른쪽 정책·문의 링크/보조 정보 구조 확인. web fetch는 cache miss였고 공개 HTML 조회로 확인했다.
- `SiteFooter.vue`: 단일 mailto 링크, 1.6초 동안 blur·hidden 신호가 없으면 수령 주소·제목·현재 URL·입력란 복사 후 조건형 alert. 신호는 외부 메일 앱 실행의 확정 판정이 아니다. 자동 복사 거부 시 readonly 양식 dialog와 실패 alert, Escape/닫기 후 포커스 복귀. 반복 클릭·라우팅 시작·unmount 시 이전 대기 취소.
- footer는 왼쪽 브랜드/오른쪽 링크와 보조 문구. 모바일은 세로, 360px 이하 정책 링크는 두 열. 외곽 `#E8EDF0`, 서비스/상세 헤더 `#3A4A5A`로 분리.
- planning 01·03·05·07, legal README·rights-request, 공개 탐색/정책·권리 Spec, 결정 색인 OD-M0-007 동기화. 정적 publishing HTML은 이번 수정 대상이 아니며 README에 이전 표현임을 명시했다. 정책 DB 본문·버전은 수정하지 않았다.
- 검증: Web build/typecheck, 테스트 typecheck/lint, SiteFooter lint, core+footer Chromium browser 13개 통과. 정상 복사, blur 취소, 반복 클릭, clipboard 거부, SPA 이동 취소, 반응형/기존 정책 modal 회귀 포함. 초기 CSS 구분선의 accessible name 오염과 Nuxt route 반영 전 늦은 fallback을 발견해 수정 후 재검증했다.
- 실제 개발 DB `5439`를 사용하는 별도 preview `http://127.0.0.1:3001/meme`와 Core `3101`을 기동, HTTP 200과 1280/320 화면 확인. 기존 3000/Core3100 프로세스 종료가 OS 권한으로 거부되어 그대로 두었다. preview 실행용 임시 파일 `/tmp/blariyo-footer-preview.mjs`, 세션 입력 `.local-data/footer-preview/session.json`(비공개·Git 제외). 다른 세션의 런타임/DB/게시물 변경은 덮어쓰지 않았다.
- 화면 증거: `test-results/m0-browser/footer-live-desktop-bottom.png`, `footer-live-mobile.png`. 검증 로그: `/tmp/blariyo-footer-{build,type,lint,test-types,test-lint,browser}.log` (임시 로컬 파일).
- 실제 외부 메일 앱 실행·메일 발송은 미검증. 운영 서버 배포·commit·push는 수행하지 않았다.

## 2026-09-20 추가 — 바깥 여백 차콜 확정

- 사용자 선택 `charcoal-footer`를 반영해 앱 `--canvas`를 `#262626`으로 변경. 헤더 `#3A4A5A`, 푸터 `#EDF0F1` 유지.
- 화면 설계·색상표·정적 publishing의 현행 앱 안내를 동기화했다. 이전 색 비교 캡처는 당시 증거로 보존.
- Web build 및 diff check 통과. 로컬 preview 3001을 재시작하고 실제 Chromium에서 HTTP 200, canvas/header/footer 계산 색상과 가로 넘침 없음을 확인.
- 적용 화면: `artifacts/palette-comparison/charcoal-applied.png`. 운영 배포·commit·push 없음.

## 2026-09-20 푸터 로고·일반 문의·저작권 표시 적용

- 사용자 승인 초안: 헤더와 같은 청록 B 마크와 블라리요, 로고 아래 브랜드 문구, 정책/문의 링크 두 줄, `© 2026 Blariyo. All rights reserved.`. 사용자가 제외한 게시물 권리 귀속 문장은 넣지 않았다.
- `contactEmail`로 보내는 문의·오류 제보를 추가했다. 권리 문의와 별도 제목·본문을 사용하며 메일 실행 대체 복사·alert·직접 복사 dialog는 공유한다. 기존 rightsEmail의 권리자 확인 양식은 유지한다.
- planning 화면/카피 계약과 public-post-browsing 개발 명세를 갱신했다. 기존 다른 세션의 변경은 보존했다.
- 검증: Web build·Web typecheck·tests typecheck 통과, footer 브라우저 세부 테스트 7개(부모 포함 Node 집계 8) 통과. 실제 메일 프로그램 실행·발송은 수행하지 않았다.
- 로컬 http://localhost:3001/meme 에 반영했다. 1280/390/320px 실화면에서 푸터 및 가로 넘침 없음 확인. 운영 배포·commit·push는 수행하지 않았다.
- 화면 증거: [PC](artifacts/footer-refresh/desktop.png), [모바일](artifacts/footer-refresh/mobile.png), [320px](artifacts/footer-refresh/narrow.png), [측정값](artifacts/footer-refresh/evidence.json).

### 푸터 줄 간격 후속 조정

- 사용자 화면 피드백에 따라 푸터 링크/로고 최소 높이를 44px에서 30px로, 저작권 위 여백을 12px에서 6px로 줄였다.
- Web build·git diff --check 통과. 로컬 3001에 반영하고 PC 1280px·모바일 390/320px 브라우저에서 실제 줄 높이 30px, 여백 6px, 가로 넘침 없음을 확인했다. CSS 간격만 변경하여 문의 동작 테스트는 반복하지 않았다.
- [모바일 화면](artifacts/footer-spacing/mobile.png), [PC 화면](artifacts/footer-spacing/desktop.png), [측정값](artifacts/footer-spacing/evidence.json). 운영 배포·commit·push 없음.

### 브랜드 간격만 복원

- 사용자 요청으로 푸터 브랜드 높이만 44px로 복원하여 블라리요와 블라블라블라 사이에 기존 여유를 되돌렸다. 정책/문의 줄 높이 30px와 저작권 위 여백 6px는 유지했다.
- Web build·git diff --check 통과. 로컬 3001 반영 후 1280/390/320px 브라우저 측정으로 브랜드 44px·링크 30px·저작권 여백 6px 및 가로 넘침 없음을 확인했다.
- [PC 화면](artifacts/footer-brand-spacing/desktop.png), [모바일 화면](artifacts/footer-brand-spacing/mobile.png), [측정값](artifacts/footer-brand-spacing/evidence.json). 운영 배포·commit·push 없음.
