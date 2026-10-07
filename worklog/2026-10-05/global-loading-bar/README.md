# 상단 공통 로딩바 구현

- 요청: 전체 화면 상단3px 공통 로딩바 구현.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD·release 기준: `12df6aed`
- 상태: 종료(구현·검증·로컬 반영 완료) / 갱신: 2026-10-05 20:01 KST
- 앞선 [검토](../batch-list-loading/README.md) 종료 확인. 기존 dirty 변경 보존.
- 범위: Web 공통 상태·컴포넌트·페이지 이동, 기존 화면별 사용자 작업 상태 연결, polling 제외, planning/system-design, 브라우저 검증.
- 완료 조건: 사용자 요청/페이지 이동의 상단3px 표시, 병렬 작업/오류/취소 해제, 자동 polling 제외, 150ms 지연·300ms 최소 표시, 모바일·동작 줄이기, 로컬 서버 반영.
- commit/push/운영 배포 없음.

## 구현

- `AppLoadingBar.vue`: viewport 상단3px, 브랜드 청록, pointer-events:none, 150ms 표시 지연/300ms 최소 유지, 퍼센트 없는 진행 막대, reduced-motion 및 접근성 안내.
- `useUiLoading.ts`: 실제 진행 ref를 작업 토큰으로 집계. 종료 중복 호출 안전, 컴포넌트 scope 종료 시 해제, SSR 작업 등록 없음.
- `ui-loading.client.ts`: 페이지 이동 시작/종료, 라우터 실패와 앱 오류 처리. app.vue/error.vue에서 공통 표시.
- 게시글 검색·상세·저장·발행·업로드, batch 조회·검수·초안, 공통코드 조회·저장, 로그인/세션, 공개 목록/상세, 정책 및 legacy 수집/출처에 연결.
- batch 조회·목록 다시 조회 및 공통코드 재조회 버튼에 진행 문구 추가. 기존 요청의 권한·재시도·멱등키·불확실 결과 복구 유지.
- DirectCollectionInput 수동 확인/실행 설정 조회와5초/30초 자동 조회 상태 분리. 배경 폴링·조회수·분석·이미지/SNS 로딩은 공통바 제외.
- legacy 목록 조회는 중복 실행을 막고 사용자 조회 실패 시 기존 목록을 보존한다. 저장 후 목록 재조회 오류는 기존 상위 복구 경로로 전달한다.
- planning 화면 계약과 system-design 코드 구조 동기화. DB/API wire 계약 변경 없음.

## 검증

- 공통 로딩 전용 브라우저6 tests PASS: 조회503/재시도, 버튼 차단, 상단3px/CSS, 모바일320px·동작 줄이기, 서로 다른 동시 요청, 자동 runtime polling 제외, 페이지 이동·공통코드 재조회, 이전 화면의 미완료 요청을 남긴 이동과 표시 해제.
- 관련 기존 브라우저46 tests PASS(중복 실행 제외): batch12, common codes1, admin navigation3, admin recovery8, collection1, collector events1, core6, direct input1, footer8, public UX1, admin workflow4. 게시글12건 작성/편집/이미지/예약/발행/숨김/재발행 DB readback 포함.
- 분리 실행 전체52 tests의 최종 결과 확인. 최초 실패를 그대로 통과로 처리하지 않았으며, 아래 수정/환경 해소 후 해당 검사를 재실행했다.
- 초기 신규 테스트에서 route handler 해제 시점과 메뉴 aria-label, 이전/새 화면이 동일 endpoint를 사용하는 fixture 설정을 보정했다. 예상값을 완화하거나 guard를 제거하지 않았다.
- admin workflow 첫 실행은 기존 로컬3000/3100 서버와 고정 포트가 겹쳐 launcher 준비 전에 실패. 소유 서버를 정상 종료한 뒤 재실행4 tests PASS. 격리 DB/서버는 테스트 종료 후 정리.
- Web build, Web/tests 타입 검사 PASS. 신규 공통 코드 및 나머지 변경 대상 lint PASS. admin.vue lint는 기존 HEAD에도 있는111행 showPicker의 unsafe type assertion1건 실패로 구분한다. 이번 작업에서 추가한 오류는 없으며 기존 오류를 임의 수정하지 않았다.
- `git diff --check` 및 관련 문서 링크 확인. 기존 dirty 변경 및 HEAD 유지.
- 주요 로그: `/tmp/blariyo-global-loading-browser.log`(기존16건), `/tmp/blariyo-global-loading-regression.log`(관련26건), `/tmp/blariyo-global-loading-final-browser.log`(workflow4건), `/tmp/blariyo-global-loading-completion.log`(신규6건·legacy1건 최종), `/tmp/blariyo-global-loading-build.log`, `/tmp/blariyo-global-loading-types.log`, `/tmp/blariyo-global-loading-test-types.log`.
- 시각 확인: `.local-data/global-loading/screenshots/desktop.png`, `mobile.png`. 두 이미지를 직접 확인해 막대3px·헤더/콘텐츠 유지·모바일 넘침 없음 확인.

## 로컬 반영과 잔여

- 최신 Web 빌드로 소유 개발 서버 재시작. Web localhost:3000/Core3100, persistent 개발 DB, workers=false 유지.
- API readiness READY, 미인증 admin/batch는 로그인으로 이동 후 HTTP200 확인.
- 운영 접속/배포, commit/push, 기존 사용자 DB 콘텐츠 수정 없음.
- 잔여: 기존 admin.vue lint1건, Git 반영 및 운영 배포. HTML/JS 수신 전이나 외부 인증 사이트는 앱 내부 표시 범위 밖이다.
