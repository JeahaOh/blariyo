# 수집처 관리 레이아웃 정리

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 22:50 KST.
- 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / HEAD: `abf21ea`.
- 요청: 사용자가 제거한 안내 문구를 유지하고 수집처 관리 화면 배치를 개선한다.
- 변경 담당 경로: admin-sources.vue, SourcePublishPolicies.vue, source-auto-publish.test.ts 화면 캡처 경로, 화면 설계의 반응형 배치 설명, 이 작업 기록.
- 방향: 제목 간격 축소, 흰 목록 영역과 얇은 구분선, 이름·URL 왼쪽/선택·저장 오른쪽 정렬. 모바일은 같은 행을 두 열 설정 영역으로 표시한다.
- 검증 예정: Web build/typecheck/lint, 기존 브라우저 5개, desktop/mobile 화면, 로컬 반영/readiness. 기존 변경과 제거된 문구 보존, DB 설정 및 예약 변경 없음.

## 결과

- 사용자 축약 문구를 유지하고 비어 있던 안내 p를 제거했다. 제목과 목록 사이 간격, 목록 제목·건수·재조회 배치를 정리했다.
- 흰 표 영역과 옅은 머리글, 고정된 이름/설정/저장 열 폭을 사용한다. URL은 남은 폭에서 줄바꿈하며 select와 저장 버튼은 같은 상단 기준으로 정렬한다. 미저장 변경 행은 옅은 청록으로 표시한다.
- 600px 이하에서는 동일한 행을 이름·URL / 두 설정 / 저장 순서로 표시한다. 별도 설정 영역이나 중복된 편집 요소를 만들지 않았다.
- Web build/typecheck/lint exit0. 기존 브라우저 테스트 5개 통과, 실패·skip0. OWNER/EDITOR, 저장·재조회·충돌·다른 행 미저장 값 유지 포함. 1280/390/320px 전체 화면 넘침 없음 확인.
- [데스크톱](admin-sources.png), [모바일](admin-sources-mobile.png) 화면을 이번 폴더에 보관하고 시각 확인했다. 과거 화면 증거는 보존했다.
- 로컬 LaunchAgent 재시작 후 API93453/Web93462, `/internal/health/ready` READY. 실제 Chrome에서 제거된 문구·새 배치·21개 목록 확인. 브라우저 연결의 debugger unattached 때문에 문서에 제공된 native Chrome 제어로 화면을 확인했다.
- git diff --check 통과. 브랜치/HEAD 유지, 범위 밖 기존 변경 보존. 운영 반영/commit/push 없음. 이전 종합 품질 receipt를 이번 입력의 검증으로 재사용하지 않는다.
