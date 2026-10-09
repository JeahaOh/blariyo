# 수집처 관리 운영 배포

- 요청: 현재 변경을 주제별 커밋하고 운영 앱·Collector·DB에 반영.
- 담당: Codex / 상태: 진행 / 갱신: 2026-10-09 23:17 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`.
- 담당 경로: 기존 source-auto-publish·source-collection-settings·source-management-history 변경 전체, 이 기록, 필요한 운영 상태 문서. 다른 진행 담당 없음 확인. 기존 변경 보존.
- 기준: feature `abf21ea`, release `7df63de`, 원격 main `f8067ab`. 배포 대상은 웹 GUI PR 병합 후 검증된 main SHA.
- 구성: API V015, Collector V016, 수집처별 수집/자동발행 설정, 별도 관리 메뉴, 행별 저장, 사용자 정의 선택 UI, 검색/상태 필터 및 수집 이력.
- 기본 정책: 자동발행 기본 OFF, 관리자가 저장한 수집 여부 보존, URL은 조회만 제공. 개발 예약 수집은 중지 상태 유지.
- 검증·Git·백업·DB·실행 증거는 완료 후 아래에 기록한다. 운영 실행·백업 복원·배포는 아직 미실행.


## 배포 후보 검증

- 최종 입력 품질14검사 통과(problems 없음), 아키텍처4검사 통과. API14건·브라우저6건 최신 검증은 [수집 이력 기록](../source-management-history/README.md), Collector313건과 권한·복원 검증은 [수집 설정 기록](../source-collection-settings/README.md). 원격 CI는 별도로 확인한다.
- 기능 커밋 `7c635d7`: API·Collector·DB·권한·계약. 화면 커밋 `38b812e`: 수집처 관리·선택 UI·필터·이력.
