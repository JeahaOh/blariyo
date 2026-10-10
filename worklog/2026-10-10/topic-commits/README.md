# 변경사항 주제별 커밋

- 요청: 현재 변경사항을 주제별로 커밋. push/merge/운영 배포는 요청 범위에 포함하지 않는다.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 21:32 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, 시작 HEAD `6990dea`. 각 기능/검토 기록의 담당 종료 확인, 시작 index 비어 있음. 기존 작업 파일 내용 보존.
- 담당 범위: 현재 dirty/untracked 파일의 내용 대조·주제별 index 구성·커밋, 이 기록. source 기능 변경 없음. 공유 파일은 index만 부분 구성하고 working tree 원문은 보존한다.
- 순서: 수집·키워드 API/DB 계약 → 관리자 제목 중복 제거 → 수집 실패 안전 진단 → 생활·유머 분류/DB 키워드/독립 배치 → 키워드 관리 UI/일괄/복구/모듈화 → 운영·검토 기록.
- 검증: hooks:check 설치본 일치, 커밋마다 staged diff/계약 hook, 최종 tree와 작업 시작 source bytes 동일 확인, 최종 상태 확인. 이전 최종 품질14/14·브라우저9/9 결과는 입력 일치 확인 후에만 연결한다.

## Git 반영

| 커밋 | 주제 |
| --- | --- |
| f5c11b2 | 안전 진단·키워드 API 계약/생성 타입/런타임 스키마, V016/V017 SQL·해시 계약 |
| 7e741b9 | 관리자 공통 상단 제목 중복 제거와 레이아웃 |
| 9760651 | Collector/API/수집처 화면의 안전 실패 상세 로그·회귀 |
| 08d979d | 생활·유머 분류, DB 키워드 규칙, 최종 발행 재검사, 독립 배치·권한·백업·회귀 |
| ffa0913 | 키워드 관리 메뉴·일괄 작업·오류/이탈 복구·모듈화·컴팩트 UI·회귀 |

- 이 파일과 남은 운영/선별 기준/구조·UI 검토 기록을 마지막 문서 커밋으로 함께 반영한다. 자체 커밋 SHA는 `git log`에서 확인한다.
- 공유 AdminWorkspace/화면 기획/개발 명세/API 저장소/통합 검사는 index에서 주제별 부분 구성 후 원문 전체와 일치시켰다. working tree source를 수정하거나 과거 worklog 내용을 소급 변경하지 않았다.
- 시작 변경187개 파일의 SHA-256 재대조: 원문 변경0건. 검사에서 발견한 credential URL 후보는 격리 DB 검사의 런타임 생성 비밀·localhost 실패용 입력이며 고정 실제 비밀이 아니다. token/private-key/실제 Discord webhook 후보 없음.
- 각 기능 커밋의 staged diff --check 및 계약/migration/OpenAPI hook 통과. hooks:check 설치본 일치. 시작 index 비어 있었으며 대상 pathspec만 stage했다.
- 이전 최종 품질 receipt 재검사에서 HEAD 변경으로 stale-inputs를 확인했다. 기존14/14·브라우저9/9는 당시 실행 결과이며 새 SHA 실행이라고 보고하지 않는다. 이번 커밋 작업에서는 기능 변경 없이 파일 해시 동일성을 별도로 확인한다. hook 검사는 각 실제 커밋 index에서 새로 실행했다.
- 최종6개 커밋/작업 트리 clean 확인. 시작187개 파일의 HEAD SHA-256도 모두 일치하며 누락/변경0건이다. 직전 품질 receipt의1267개 입력 파일 해시 차이0건, 차이는 HEAD뿐이다. 이번 커밋 작업에서 빌드/브라우저 검사를 반복 실행하지 않았다.
- push/merge/운영 배포/DB 변경/개발 재시작/배치 활성화 없음.
