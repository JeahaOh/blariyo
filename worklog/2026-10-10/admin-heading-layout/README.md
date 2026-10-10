# 관리자 제목 중복 제거

- 요청: 게시글·수집처·공통코드 관리의 공통 헤더와 본문에서 같은 제목이 반복되는 화면 개선.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 08:35 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`.
- 담당 경로: `apps/web/app/components/AdminWorkspace.vue`, `apps/web/app/assets/css/admin.css`, `docs/planning/03-screen-design.md`, 이 기록 폴더.
- 기존 담당 확인: 전일 코드 구조 감사와 당일 운영 화면 확인은 종료. 기존 untracked 기록과 과거 배포 결과를 보존한다.
- 변경 기준: 화면 제목은 본문 H1에서 한 번 표시. 현재 위치는 활성 메뉴로 표시. 공통 상단은 인증 상태·세션 이동만 간결하게 표시한다.
- 검증 계획: Web build·typecheck·lint, 로컬 재시작 후 세 화면의 데스크톱/모바일 표시·제목·활성 메뉴·인증 이동·가로 넘침 확인, `git diff --check`.
- 범위: 로컬 구현·검증. 이번 요청으로 commit·push·운영 배포·DB 변경을 실행하지 않는다.
- 이전 기록: [운영 화면 확인](../source-management-browser/README.md).

## 변경·검증 결과

- 공통 레이아웃의 `BLARIYO / ADMIN`, 중복 페이지 제목과 사용하지 않는 제목 매핑·CSS를 제거했다. 본문 H1·설명은 유지했다. 인증 영역은 오른쪽 정렬, PC 최소 높이78→56px. 모바일은 인증 문구도 표시하고 세션 링크 높이40px로 유지했다.
- 화면 설계 정본에 제목1회 표시·활성 메뉴의 현재 위치 표시·상단 인증 영역 기준을 반영했다. API·DB·권한 계약 변경 없음.
- Node24.18.0에서 Web build·typecheck·lint 모두 exit0. `git diff --check` 통과. 기존 개발 LaunchAgent를 빌드 후 재시작하고 로컬 관리자 버튼으로 로그인했다. 개발 배치 설정은 변경하지 않았다.
- Chrome1280×900 및390×844에서 수집처·공통코드·게시글 관리6개 화면 관찰. 각각 본문 H1 1개, 상단 중복 제목 없음, 활성 메뉴 정확, 문서 가로 넘침 없음. PC 상단 실측56px, 모바일53px(내용·테두리 포함).
- 화면 증거: [수집처 PC](sources-desktop.png) / [모바일](sources-mobile.png), [공통코드 PC](common-codes-desktop.png) / [모바일](common-codes-mobile.png), [게시글 PC](posts-desktop.png) / [모바일](posts-mobile.png).
- 세션 관리 링크에서 `관리자 인증이 완료됐습니다` 화면과 `/admin/sources` 복귀 링크를 확인하고 원래 수집처 관리로 복귀했다. 초기 로그인 상태의 제목을 기다린 검사는 세션이 이미 인증된 경우와 달라 timeout 발생; 실제 인증 완료 화면을 직접 확인해 판정했다.
- 임시 viewport 해제, 로컬 미리보기 탭 유지. 화면 조회·메뉴/세션 이동만 실행했으며 저장·발행·설정 DB 변경은 실행하지 않았다. 이번 UI 변경의 전체 편집/저장 회귀는 실행하지 않았으며 기존 결과를 이번 변경의 통과 근거로 재사용하지 않는다.
- 지정 앱2파일·planning1파일·이 기록 폴더만 변경. 다른 세션 및 이전 작업 기록 보존. commit·push·운영 배포는 미실행; 운영은 기존 버전이다.
