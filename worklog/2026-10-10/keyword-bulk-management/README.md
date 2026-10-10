# 키워드 일괄 수정·저장·삭제

- 요청: 키워드 일치 방식 일괄 변경, 일괄 저장 및 삭제.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 19:35 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, HEAD `6990dea`. 직전 로컬 적용/제외 검토 담당 종료 확인. 기존 dirty/untracked 변경 보존.
- 담당 경로: 키워드 Web/API/저장소·권한·계약·관련 검사, planning/system-design/spec·status/roadmap·계약 해시, 이 기록 폴더. 기존 키워드 기능의 후속 개발이며 브랜치/Git 반영 없음.
- 범위: 행 체크 선택, 현재 페이지/필터 전체 선택, 선택한 일치 방식 적용 및 일괄 저장, 행/선택 삭제. 삭제 확인에 대상 수 표시. 기존 불변 snapshot 이력 보존, 단일 transaction/버전검사/중복검사로 전체 성공 또는 전체 실패. OWNER 변경·EDITOR 조회 유지.
- 검증: 격리 API atomic 저장/삭제/권한/동시 변경/중복, 브라우저 선택/필터/일괄 수정/저장/삭제/충돌/모바일, 최종 품질 및 로컬 최신 화면 반영. 기존 로컬 키워드 변경·실제 발행/배치 실행·운영 배포 없음.

## 진행 증거

- 최초 test-build를 API 본 빌드와 동시에 시작해 dist가 재생성 중일 때 모듈 미존재 오류가 발생했다. 본 빌드 완료 뒤 순서대로 재실행해 PASS. 테스트 코드/기대값/규칙 완화 없음.
- macOS sandbox에서 최초 Chromium 실행이 MachPort 권한으로 차단됐다. 동일 격리 시험을 승인된 sandbox 외부 실행으로 수행했다. API26건 및 브라우저3건 PASS/실패·skip0.
- 선택 저장/삭제는 전체 head 잠금과 한 snapshot 반영. 다른 행 미저장 편집 유지, 삭제 확인에 포커스 이동, 모바일 현재 페이지 선택 버튼 추가. 입력 오류/중복 실패는 선택 행 편집도 유지한다. 마지막 UI 보완 뒤 최종 빌드/검사를 재실행한다.
- 운영/지속 로컬 데이터는 시험 대상이 아니다. task 전용 loopback55449 tmpfs PostgreSQL18을 사용한다.

## 최종 결과

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| 전체 API 회귀 | 37파일·175건 PASS, 실패/skip/cancel0 | `api-regression.log`, `api-regression-summary.json` |
| API 단위 | 47건 PASS, 실패/skip0 | `api-unit.log` |
| 브라우저 | 최종3건 PASS, 실패/skip0 | `browser-final.log`, `bulk-desktop.png`, `bulk-mobile.png` |
| 공통 품질 | 14/14 PASS, 최종 입력 receipt 유효 | `verification/2026-10-10T10-31-11.385Z-quality-22622.json`, `quality.log` |
| 문서/변경 | 상대 링크6파일 누락0, diff check PASS | planning/system-design/spec/OpenAPI/generated/hash 동기화 |

- API: POST bulk SAVE/DELETE, 1~500개·중복 ID/입력/존재/중복 조건/버전 검증, 한 snapshot으로 전체 성공 또는 rollback. no-op version 유지. 삭제된 키워드도 과거 snapshot에 보존. 기존 권한/유지보수/Origin 경계 유지, SQL/DB 최소 권한 변경 없음.
- UI: 체크 선택·현재 페이지/필터 전체 선택·미저장 수, 일치 방식 적용 후 선택 저장, 행/선택 삭제 확인·취소. 페이지 이동 유지/필터 변경 해제, 다른 행 미저장 보존. OWNER 변경/EDITOR 조회. 모바일320~1280px 가로 넘침0.
- 로컬: 기존 개발 LaunchAgent만 재시작하고 새 빌드의 `/admin/keywords`를 Chrome에서 직접 확인했다. Core READY/200. 25개 선택 버튼 동작 확인 뒤 선택 해제, 실제 저장/삭제는 하지 않음. [실제 3000 화면](localhost-bulk.png), [로컬 DB 결과](local-runtime.json): V017·125개·life-humor-v1·revision1 유지. 추가 migration 필요 없음.
- 격리 task container 및 시험 DB는 정리했다. 기존 지속 로컬 PostgreSQL/미디어/키워드는 보존. 운영 변경·Git commit/push·자동 발행/수집 예약 활성화 없음. HEAD6990dea/feature/discord-review 및 기존 사용자 변경 보존.
- 이번 결과는 기능 구현·격리 검증·로컬 실행 반영 완료다. 실제 운영 반영과 선별 정확도/오탐율 검증은 수행하지 않았다. 이력은 보존하지만 이력 조회/복원 UI는 이번 요청 범위에 포함하지 않는다.
