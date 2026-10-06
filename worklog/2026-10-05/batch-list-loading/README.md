# 전체 화면 공통 로딩바 검토

- 요청: 조회·목록 다시 조회가 실행 중인지 명확하게 표시.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD·release 기준: `12df6aed`
- 상태: 종료(전반 검토 완료, 공통 구현 미착수) / 갱신: 2026-10-05 19:48 KST
- 앞선 draft-title-source 종료 확인. 기존 dirty 변경 보존.
- 최초 개별 수정 예정 경로(보류): admin-batch.vue, admin.css, batch-review 브라우저 테스트, 화면 기획 및 이 기록.
- 범위: 조회 요청 동안 진행 막대·버튼 문구·접근성 busy 표시, 중복 클릭 방지, 성공/실패 후 해제. 기존 목록·오류 복구 유지.
- 최초 구현 검증 계획(미실행): 응답을 지연한 실제 브라우저에서 조회·재조회 성공/실패와 모바일 표시, Web 빌드·타입·lint.
- commit/push/운영 배포 없음.

## 후속 사용자 요청에 따른 범위 전환

- 사용자 후속 요청: 모든 화면을 검토하고 상단 약3px 로딩바의 공통화 방안을 판단.
- 개별 batch 표시 구현을 시작했으나 후속 요청에 따라 검토로 전환했다. 이번 작업에서만 추가한 admin-batch.vue/admin.css/화면 기획 임시 hunk를 정확히 되돌렸으며 이전 제목 보정 등 기존 dirty 변경은 보존했다. 로컬 빌드·서버 재시작·배포는 수행하지 않았다.
- 최종 산출물은 이 검토 기록이다. 아래 항목은 제안이며 제품 정본에 확정 구현으로 반영하지 않았다.

## 현행 대조

| 화면/기능 | 실제 코드와 현재 표시 | 권장 적용 |
| --- | --- | --- |
| 전체 페이지 이동 | [app.vue](../../../apps/web/app/app.vue#L5)는 관리자·로그인·공개 분기로 NuxtPage만 배치. 공통 진행 표시 없음 | 분기 밖 공통3px 바 + 페이지 이동 상태 연결 |
| 수집 결과 검수 | [admin-batch.vue](../../../apps/web/app/pages/admin-batch.vue#L160)는 busy로 클릭 차단, 조회/목록 다시 조회 버튼 문구는 고정 | 조회·상세·승인/반려·초안 이동과 재시도에 공통 바. 버튼 진행 문구 병행 |
| 공통코드 | [admin-common-codes.vue](../../../apps/web/app/pages/admin-common-codes.vue#L33)는 그룹 변경·재조회·저장을 busy로 차단, 진행 문구 없음 | 사용자 작업 전체에 공통 바 |
| 게시글 관리 | [admin.vue](../../../apps/web/app/pages/admin.vue#L524)는 작업 설명, 검색 중 문구, 영역 aria-busy 존재 | 기존 문구 유지하며 검색·상세·저장·발행·업로드 작업 연결 |
| URL 수집 요청 | [DirectCollectionInput.vue](../../../apps/web/app/components/DirectCollectionInput.vue#L63)는 수동/자동 상태 확인이 같은 함수 사용 | 접수·재요청·수동 상태 확인만 공통 바. 접수 응답 후 바 종료, 수집기 대기는 요청 상태로 표시 |
| 공개 목록·상세 | [게시판](../../../apps/web/app/pages/[boardSlug]/index.vue), [상세](../../../apps/web/app/pages/[boardSlug]/posts/[postId].vue#L293)는 useFetch 및 하단 목록 수동 요청. 목록 skeleton/진행 문구 존재 | 페이지 이동·페이지 번호·다시 시도 연결, 기존 skeleton 유지 |
| 정책 화면/모달 | [PolicyViewer.vue](../../../apps/web/app/components/PolicyViewer.vue#L8)는 최초·버전 변경·재시도에 pending 문구 | 정책 조회 연결. 모달 안의 진행 문구도 유지 |
| 관리자 로그인 | [admin-login.vue](../../../apps/web/app/pages/admin-login.vue)는 로그인 중 문구, 세션 조회/로그아웃 요청 | 로그인·세션 재확인·로그아웃 연결 |
| legacy 수집/출처 | [admin-collect.vue](../../../apps/web/app/pages/admin-collect.vue#L63), [admin-collect-sources.vue](../../../apps/web/app/pages/admin-collect-sources.vue#L16) | 활성화된 환경에서 조회·저장·업로드 연결. legacy 목록 refresh는 busy/예외 처리가 없어 별도 보강 필요 |
| 쿠키/리다이렉트/오류 | 쿠키 저장은 localStorage 동기 처리. index/source-codes는 리다이렉트. error.vue는 별도 오류 루트 | 동기 토글에 바 불필요. 이동은 공통 처리, 오류 진입 시 남은 작업 표시 해제 |

## 권장 공통 규칙

1. 뷰포트 상단 고정, 높이3px, 브랜드 청록색. 레이아웃을 밀지 않고 클릭을 가리지 않는다.
2. 페이지 이동과 사용자가 시작한 네트워크 작업을 공통 상태로 관리한다. 버튼에는 `조회 중…`, `저장 중…` 등 동작을 병기하고 기존 중복 제출 차단을 유지한다.
3. 기본 표시 지연150ms와 표시 후 최소300ms 유지를 제안한다. 실제 요청을 지연하지 않으며 빠른 응답의 깜빡임만 줄인다. 수치는 구현 시 수용 검증 대상이다.
4. 시작/종료를 요청별 토큰으로 관리해 중첩 작업을 집계한다. POST→상세 확인→목록 재조회는 하나의 사용자 작업으로 묶고, 다른 진행 작업이 남아 있으면 바를 유지한다.
5. 성공·실패·취소·화면 이탈 시 토큰을 정확히 한 번 해제한다. 로딩바 종료와 저장 성공을 동일시하지 않으며 기존 오류·불확실 응답 복구 안내를 유지한다.
6. 서버에서 작업률을 받지 않으므로 퍼센트 숫자는 표시하지 않는다. 업로드도 실제 전송률처럼 표현하지 않는다. 동작 줄이기 설정·스크린리더 상태 안내를 지원한다.
7. 이미 표시된 목록과 사용자의 편집 입력을 보존한다. 공통 바 때문에 전체 화면을 차단하지 않는다.

## 전역 네트워크 감시에서 제외할 동작

- DirectCollectionInput 상태 폴링5초, runtime 설정 폴링30초: 자동 실행은 제외하고 같은 함수의 수동 실행만 포함한다.
- 게시글 조회수 기록, 분석 이벤트, 링크 미리 불러오기, 이미지 지연 로딩과 SNS 위젯: 공통 바 제외, 필요한 경우 해당 영역 표시 유지.
- 쿠키 설정·접기/펼치기·입력 수정 등 동기 UI 조작: 제외.
- HTML/JS가 도착하기 전 최초 브라우저 문서 로딩이나 외부 인증 사이트 화면은 앱 내부 바의 보장 범위가 아니다.

## 구현 방안과 주의점

- 제안 구성: `AppLoadingBar.vue` 1개 + `useUiLoading` 작업 추적 + 페이지 이동 연결. 모든 화면은 같은 시작/종료 도구를 사용한다. 기존 `$fetch`를 전역 교체하거나 서버 호출까지 강제로 감싸지 않는다.
- 설치본 Nuxt4.5.2의 `NuxtLoadingIndicator`는 기본 높이3px이며 `useLoadingIndicator`는 page:loading:start/end에 연결된다. 이 구성요소를 추가하는 것만으로 같은 화면의 조회 버튼 요청까지 자동 추적하지는 않는다.
- 설치본 `loading-indicator.js`의 finish는 공통 isLoading을 직접 종료하고 요청 수를 집계하지 않는다. 페이지 이동과 수동 요청을 각각 start/finish에 단순 연결하면 먼저 끝난 작업이 바를 숨길 수 있다. renderer 재사용 여부보다 공통 작업 집계가 우선이다.
- [Nuxt 공식 custom useFetch](https://nuxt.com/docs/4.x/guide/recipes/custom-usefetch), [useLoadingIndicator](https://nuxt.com/docs/4.x/api/composables/use-loading-indicator)를 대조했다. 로컬 설치본 동작을 현재 구현 검토의 기준으로 삼았다.
- SSR 요청의 인증 헤더·쿠키 전달, useFetch 캐시/중복 요청 방지, AbortSignal, Idempotency-Key 및 기존 오류 복구는 유지해야 한다.
- 정책 모달은 `showModal()`로 열리므로 브라우저 최상위 레이어에 놓인다. 일반 앱 루트의 z-index만 높여도 이를 넘어설 수 있다는 가정은 금지한다. 모달 내부 진행 문구를 유지하고 실제 가림을 검증한다.

## 구현 순서·수용 검사 제안

- P1: 공통 컴포넌트/작업 추적 + 수집 결과·공통코드·게시글 관리.
- P2: 공개 목록/상세·정책·로그인·수집 URL 및 활성 legacy 경로 연결. 두 단계 모두 포함해야 전체 화면 적용으로 판정한다.
- 느린 성공·503·401·연결 실패·Abort, 병렬 요청, POST 후 연속 GET, 연속 페이지 이동, 폴링 제외를 브라우저에서 검증한다.
- 상단3px/고정 헤더 겹침/모바일320px/동작 줄이기/정책 모달/중복 클릭 방지를 검증한다.
- 검증 결과: 소스·기획·설치 라이브러리·공식 문서 정적 대조, `git diff --check` 완료. 신규 기능 build/test/브라우저·운영 적용은 미실행이며 완료로 보고하지 않는다.
