# 수집처 선택 박스 디자인

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / HEAD: `abf21ea`.
- 요청: 수집처 관리 select box 디자인 변경.
- 범위: SourcePublishPolicies.vue 선택 박스 모양·상태/포커스/비활성 표현, 기존 브라우저 테스트의 이번 화면 캡처 위치, 이 기록. 기존 미커밋 변경 보존.
- 방향: 둥근 테두리·상태 점·일관된 화살표, ON은 청록/옅은 청록 표면, OFF는 중립색. native select를 유지해 키보드·모바일 선택을 지원한다.
- 검증 예정: Web build/type/lint, 기존 수집처 관리 브라우저 5개 및 데스크톱/모바일 화면, 로컬 재시작/readiness. DB 설정·수집·예약은 변경하지 않는다.

## 결과

- 선택 박스는 높이44px/폭136px/모서리10px, 왼쪽 상태 점과 오른쪽 SVG 화살표로 정리했다. ON은 기존 팔레트의 옅은 청록 배경·진한 청록 글자, OFF는 흰 배경·중립색으로 구분한다. hover/키보드 focus/비활성/동작 감소 설정을 반영했다.
- native select와 기존 aria-label·행별 저장/충돌/권한 로직을 유지했다. 팝업 선택 목록은 OS/브라우저 기본 UI를 사용한다.
- Web build/typecheck/lint 통과. 기존 수집처 관리 Docker 브라우저 테스트5개 통과, 실패·skip0. 행별 저장/재조회/충돌/다중 행 미저장 값 보존/OWNER·EDITOR 포함. 1280/390/320px 전체 화면 넘침 없음 확인.
- [데스크톱 화면](admin-sources.png), [모바일 화면](admin-sources-mobile.png)을 이번 작업 폴더에 보관했다. 이전 작업의 화면 파일은 덮어쓰지 않았다. 모바일 표는 기존 내부 가로 스크롤을 사용한다.
- 로컬 LaunchAgent 재시작 후 API88718/Web88725(3100/3000), readiness READY. 실제 Chrome 화면에서 ON 배경 rgb(226,244,243)·선택 높이44px·기본 화살표 제거 확인.
- git diff --check 통과, feature/discord-review 및 HEAD abf21ea 유지. 기존 미커밋 변경 보존. 운영 반영/commit/push 없음. 기존 종합 품질 receipt는 이번 소스 변경 후 최종 입력 증거로 사용하지 않는다.
