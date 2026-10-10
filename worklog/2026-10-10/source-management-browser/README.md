# 운영 수집처 관리 로그인 후 화면 확인

- 요청: 전일 배포 후 로그인 대기에서 사용자가 `로그인 완료`를 전달해 운영 화면 검증 재개.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 08:30 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`.
- 담당 경로: 이 기록 폴더만. 다른 세션의 `worklog/2026-10-09/code-structure-audit/` 및 과거 배포 기록은 보존한다. 기존 진행 담당 없음 확인.
- 이전 기록: [운영 배포](../../2026-10-09/source-management-deployment/README.md).
- 기준: `docs/planning/03-screen-design.md`의 `/admin/sources` 계약, `docs/planning/content-collection/README.md`의 OWNER 변경/EDITOR 조회·자동발행 기본 OFF.
- 사용자 Cloudflare 계정 로그인은 대시보드 표시로 확인. `https://blariyo.com/admin/sources`로 별도 탭을 열자 Cloudflare Access의 `Authenticate your identity`·인증 앱6자리 코드·Verify 화면이 표시됐다. Cloudflare 계정 로그인과 운영 관리자 Access 2차 인증은 별개다.
- 사용자가 새 운영 확인 탭에서 2차 인증하도록 요청하고 탭을 유지했다. 코드·인증 토큰은 기록하지 않는다.
- 아직 미검증: 운영 관리자 화면의 목록·필터·선택 UI·수집 시각/실패 사유. 운영 설정 저장·배치·발행·DB 변경은 실행하지 않았다.

- 인계: 다음 담당 사용자(운영 확인 탭의 기존 Access 2차 인증 완료) → Codex(목록/필터/선택 메뉴/이력 확인). 운영 설정 값 변경은 이번 로그인 확인 요청으로 승인된 것으로 해석하지 않는다.
- 검증: 이전 배포와 구분해 현재 Chrome 대시보드 로그인과 운영 Access의 별도 인증 화면을 직접 확인. `git diff --check` 통과, 앱/DB/운영 설정 변경 없음.


## 2차 인증 후 운영 화면 검증 완료

- 사용자가 운영 Access 2차 인증을 완료한 뒤 실제 `https://blariyo.com/admin/sources`의 인증됨·수집처 관리 메뉴·목록21/21개를 확인했다. 이전 로그인 대기 판정은 이 후속 증거로 해소했다.
- 이름 `클리앙` 검색과 URL `clien.net` 검색 모두1/21개. 초기화는21/21개로 복귀.
- 수집함 필터13/21개, 수집 안 함8/21개(임시OFF6+제한2). 최근 오류 있음9/21개(과거 실행 오류 포함). 자동발행 사용 필터0/21개와 빈 결과 문구 확인.
- 선택 메뉴는 페이지 안의 사용자 정의 listbox로 열리고 현재 값에 체크가 표시된다. 더쿠 자동발행 `사용 안 함` 선택 표시, Esc 닫기·메뉴0개 확인. 뽐뿌의 수집함 option은 disabled이고 수집 안 함이 선택돼 수집 불가 제한이 유지된다. [선택 메뉴 화면](select-menu.png).
- 각 행의 URL, 마지막 정상 수집 KST, 최근 실행 KST/상태, 안전한 실패 코드가 표시된다. 예: 고급유머04:35 정상 수집·완료, 오늘의유머05:05 정상 수집·완료, 율도05:11 마지막 정상 수집과 최근 실행 실패 `LIST_STRUCTURE_CHANGED`가 별도로 표시됨. 상세 값은 [운영 화면 관찰](production-sources.txt)을 따른다.
- 새벽 실행의 차단/실패 표시6개: 클리앙 `SOURCE_NOT_ALLOWED`, 디미토리/개드립 `SOURCE_ACCESS_BLOCKED`, 이토랜드 `PARSE_FAILED`, 루리웹 `SOURCE_FETCH_FAILED`, 율도 `LIST_STRUCTURE_CHANGED`. 오류 필터9개를 오늘 새벽 실패9개로 해석하지 않는다.
- 더쿠/웃긴대학/인스티즈3개는08시대 화면에서도04~05시 실행이 `수집 중`으로 표시된다. 실제 worker 가동·종료 누락·강제 종료 여부는 이 브라우저 확인에서 조회하지 않았으며 원인 미확정이다. 별도 운영 배치 점검 대상으로 남긴다.
- 초기화한 전체 목록과 닫힌 선택 메뉴 상태로 확인 탭을 유지했다. [운영 화면](production-sources.png). 사용자가 원래 인증 탭에서 공통코드 관리로 이동한 것을 확인해 별도 확인 탭에서 검사했다.
- DB 설정을 바꾸거나 저장 버튼을 누르지 않았다. 자동발행0개 유지. 이번 증거는 실제 설정 저장·OWNER/EDITOR 전체 권한 인수·배치 성공률·재수집/발행 결과 검증을 대신하지 않는다.
- 앱·운영 코드 변경 없음. 작업 기록의 상대 링크·`git diff --check`, 지정 기록 폴더만 추가되는지 확인했다. 기존 다른 세션 기록 보존, 이번 후속 기록 commit/push는 실행하지 않음.
