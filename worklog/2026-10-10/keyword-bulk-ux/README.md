# 키워드 일괄 작업 사용성 개선

- 요청: 일괄 관리 사용법이 번거롭다는 피드백 반영.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 20:27 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, HEAD `6990dea`. 직전 키워드 일괄 담당 종료 확인. 기존 사용자/다른 작업 변경 보존.
- 담당 경로: 키워드 뷰·브라우저 검사, 관련 planning/system-design/spec/status/roadmap, 이 기록. API/DB 계약 변경 없음.
- 변경: 기본 대상은 필터 결과 전체, 체크하면 선택 행만. 대상 수 명시, 일치 방식 유지/부분/단어 선택 후 일괄 저장 한 번으로 수정과 반영. 중간 적용 버튼 제거, 선택/행 편집 보존 및 삭제 확인 유지. 일괄 영역을 한 줄 도구 모음으로 축소.
- 검증: [브라우저 검사](browser.log) 3/3 통과. 필터 기본 대상·체크 선택 우선·한 번 저장·비대상 편집 보존·삭제 확인/취소/충돌·EDITOR 읽기 전용을 검증했다. 너비 1280/1024/900/390/320에서 가로 넘침 0. [데스크톱](bulk-desktop.png), [모바일](bulk-mobile.png).
- 최종 품질: [quality.log](quality.log) 14개 검사 통과. [receipt](verification/2026-10-10T11-23-45.529Z-quality-45256.json) 재검증 valid=true, problems=[]. 관련 문서 상대 링크 누락 0, git diff --check 통과.
- 로컬 반영: 기존 개발 LaunchAgent만 재시작, Core READY/200. Chrome의 실제 localhost:3000/admin/keywords에서 필터 결과 20개·변경 20개·일괄 저장 활성 상태를 확인했다. [실제 화면](localhost-ux.png)은 확인용 미저장 선택 상태이며, 확인 후 전체 분류/일치 방식 유지로 초기화했다. [DB readback](local-runtime.json): 125개·life-humor-v1·revision1 유지.
- 잔여: 커밋/운영 배포 미수행. 실제 키워드값 변경·수집/발행 실행 없음. 전용 임시 테스트 PostgreSQL 컨테이너만 제거했고 기존 개발 DB와 중지된 배치 일정은 유지했다.
