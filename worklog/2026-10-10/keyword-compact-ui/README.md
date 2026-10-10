# 키워드 관리 목록 UI 개선

- 요청: 시각 재검토 후 “잘 좀 해봐” — 행별 select/저장 유지, 목록 밀도·공간·모바일 배치 개선.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 21:26 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, HEAD `6990dea`. 직전 keyword-visual-review 종료 확인.
- 담당 경로: 키워드 page/form/table/bulk/style, 관련 planning 화면 계약, 키워드 브라우저 검사의 시각 증거 경로, 이 기록. 기존 dirty/untracked 보존. API/DB/Collector/공통 관리자 CSS/선택 컴포넌트 변경 없음.
- 변경: 제목 옆 추가 버튼/필요할 때만 추가 폼, 필터·일괄 도구·표 통합, 반복 건수 제거/규칙 버전 하단, 데스크톱 행 축소/선택·수정 강조, 모바일 키워드+체크 묶음/44px 조작 영역.
- 검사: 새 빌드 → 기존 키워드 회귀9개 → 데스크톱/모바일 실제 화면·치수 → 타입/lint/최종 quality → 개발3000 새 빌드 반영/기존125개 보존. 새 기능·커밋·운영 배포·배치 활성화 없음.

## 결과와 증거

- 추가 폼을 제목 옆 버튼으로 펼치도록 변경했다. v-show로 접힌 폼 입력을 보존하며 기존 dirty/이탈 방어를 유지한다. API·편집/선택 composable·공통 select 동작 변경 없음.
- 필터·일괄 작업·표·페이지 이동을 한 패널로 묶고 중복 건수를 제거했다. 규칙 버전은 하단에 둔다. 데스크톱 행은 작은 입력/select·텍스트 작업 버튼, 선택 행은 녹색·수정 행은 노란색/수정됨 표시다.
- 높이 원인: 공통 admin input min-height42px + checkbox margin24px + td padding24px가 기존 행91px을 만들었다. 키워드 화면 checkbox의 min-height/height/margin을 명시하고 label의 공통 margin12px도 화면 내에서 초기화했다. 공통 CSS는 수정하지 않았다.
- 최종 [브라우저 로그](browser-final.log): 9/9 통과, fail/cancelled/skipped/todo0. 기존 저장·일괄·EDITOR·오류 입력 보존·충돌·응답 유실 복구·이탈 방어·모바일 선택 검증 유지. 기존 첫 테스트에 1280×900에서 table top330px 미만/행56px 이하/완전 표시8행 이상 판정을 추가했다. 1280/1024/900/390/320에서 가로 넘침 없음. [첫 화면](initial-desktop.png), [모바일 회귀 화면](bulk-mobile.png).
- 중간 browser.log는 macOS Chromium 실행 sandbox 권한 오류로 실패9건, browser-confirmed.log는 상단 label 여백이 남아 table top334.3px로 밀도 판정 실패1건(기타8통과). 권한을 요청해 정상 실행하고 소스의 label 여백을 고쳤으며 기대값을 완화하지 않았다. 중간 quality.log receipt는 최종 CSS의 근거로 사용하지 않는다.
- 최종 [품질 로그](quality-final.log): quality 14/14 통과(계약·CI·빌드·API 테스트 빌드·타입·lint·unit). [최종 receipt](verification/2026-10-10T12-24-45.021Z-quality-41891.json) 재검사 valid:true/problems:[] 확인.
- 실제 개발서비스 새 빌드 반영: `com.blariyo.discord-review.development` 재시작, API ready READY. [localhost 데스크톱](localhost-desktop.png)/[localhost 모바일390px](localhost-mobile.png) 직접 확인. 동일1367×806 기준 table top463.8→315.8px, 행91→51px, 완전히 보이는 데이터 행2→8개. 모바일390/320에서 추가 폼을 펼쳐도 가로 넘침 없음. 화면 크기 복원/폼 접음/미저장 값 없는 상태로 탭 유지.
- 실제 로컬 DB readback: life-humor-v1 / keywords125 / revisions1 유지. 실데이터 저장·삭제 없음. 브라우저 검사의 데이터 쓰기는 전용 임시 PostgreSQL `blariyo-keyword-compact-pg-20261010`의 임의 fixture DB만 사용, 완료 후 임시 container 제거. 기존 개발 DB 유지, 운영 접근/변경 없음.
- git diff --check 통과. 기존 변경 보존, 이번 수정 범위는 page/form/table/style/화면 정본/기존 검사 내 시각 판정·증거 경로/이 기록이다. 커밋·push·운영 배포·배치 활성화는 수행하지 않았다.
