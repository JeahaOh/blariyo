# Git 통합·원격 동기화·종료 브랜치 정리 실행

- 요청: [확정 계획](../git-cleanup-plan/README.md)을 진행. 사용자의 실행 지시는 계획의 commit·merge·일반 release push·확인된 종료 브랜치 삭제 범위를 포함한다.
- 담당: Codex / 상태: 통합·동기화 종료, 새 파비콘 작업과 현재 feature 마감은 보류 / 작업일: 2026-09-30 KST.
- 기본 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 시작 feature/m0-design-completion@578c058.
- 변경 범위: 승인된 계획의 GIT-01~06, docs/status.md·docs/roadmap.md의 Git 현황, 격리 release 병합/검증/기록. main·별도 m0-core worktree·고유 원격14개·열린 governance PR은 보존한다.
- 별도 m0-core 미커밋88개는 SHA-256 기준선으로 보호한다. 원격PR8개를 GitHub 로그인 화면에서 읽기 전용 확인했으며 삭제 후보의 연결 여부를 별도로 검사한다.
- 초기 단계: 기록·현행 Git 상태 문서를 마감한 뒤 bundle 복구 검증, release에 최신 feature 병합, 실제 통합 검증, 일반 push/readback, 확인된 종료 브랜치 정리 순서로 진행한다.
- API/웹·DB·브라우저 검증은 격리 비운영 환경만 사용한다. main 승격·운영 배포·실제 외부 수집은 실행하지 않는다.

## 보존·충돌 처리

- 첫 준비 commit: `da3a96e`. local release `0545759`를 첫 부모로 두고 이 feature를 병합한다. 날짜순14개 commit과 원격 release `6b91402`의 조상을 모두 보존한다.
- 격리 폴더: 기본 저장소 `.worktree/git-integration/`. 기존 별도 m0-core 폴더의88개 dirty 파일 SHA-256·HEAD 불변을 재확인했다.
- [백업 검증](BACKUP-VERIFICATION.json): 기본 저장소 `.local-data/git-backups/git-cleanup-20260930/before-integration.bundle`,10,167,543 bytes. bundle verify·별도 bare 복구·29개 refs의 commit/tree readback·fsck 통과. 미커밋88개를 bundle로 백업했다고 해석하지 않는다.
- [PR 조회](PR-CHECK.json): 삭제 후보 feature/m0-design-completion과 planning-design-only를 head/base로 하는 열린PR은 각각0. 기존 governance PR8개는 보존한다.
-22개 충돌은 original release `bb19c48`의 내용을 보조 기준으로 비교했다. 동일 변경의 cherry-pick 이력을 중복 적용하지 않고, 양쪽의 실제 후속 변경을 수동 대조했다. 전체 ours/theirs 선택은 하지 않았다.
- 공개 화면: GA4 v1 이벤트·view/attempt 식별값과 목록 초점·영역 내 재시도·공유 성공/취소 안내를 함께 유지했다. 동의 오류 처리를v3/analytics_v1 계약과 결합했다.
- 관리자: split 화면·재인증/검수 문맥 복원과 Web URL 입력·원문 기한 만료 처리를 결합했다. 공통 workspace 메뉴에 directInput flag를 반영하고 중복 관리 메뉴를 제거했다.
- schema는 양쪽 schema 문자열을 이어 붙이지 않고 정본 OpenAPI에서 재생성했다. 계약 진화 manifest를 새 schema hash와 맞췄고 기존 SQL checksum은 보존했다.
- 문서:9/25 배포·GTM/백업 증거와9/27 M0 로컬 구현·9/30 commit 사실을 결합했다. 실제 운영자는 사용자(OWNER)이며 미실행 운영 인수·법무 gate는 유지했다. 과거 worklog 충돌은 원문을 보존한 후속39줄을 유지했다.
- 재시험 screenshot 출력은 `test-results/browser/`로 변경해9/27 작업 증거를 덮어쓰지 않도록 했다.

## 시험 진행과 재시도 근거

- API/Web build, 공통35, API service35, Collector289(실DB readback18 포함) 통과. 타입7개·lint5개·hook 설치/회귀·backup unit 통과. 전체 결과는 후속 검증 JSON으로 확정한다.
- Chromium 최초 실행은 macOS sandbox의 Mach port 생성 거부로 차단됐다. 실행 권한을 적용한 재시험은 실제 화면까지 진행했다.
- 관리자 회귀에서 공개 목록 링크가 새 workspace로 이동했는데 옛 test locator가 남은 점과 batch 화면에 중복 메뉴가 생긴 점을 확인했다. 현재 공개 사이트 링크를 사용해 이탈 방지 assertion을 유지하고 중복 메뉴를 제거했다. 검증 assertion/테스트를 삭제하지 않았다.
- API mailbox Java fixture는 `127.0.0.1:55449/nest_*`만 허용한다. 최초5439 임시 DB 시험은 이 안전 경계에서 거부됐다. guard를 완화하지 않고 작업 전용 PostgreSQL18 container를55449에 만들어 실패 파일과 미실행 후속 파일을 실행한다.
- 역할5개 실제 SCRAM/DDL·역할 전환 거부·batch/retention 경계·dump/restore73table/16sequence 통과. 로컬 준비도구 임시DB 최소권한1개 통과.

## 실행 도중 별도 작업 감지

-21:38 KST 기본 폴더에서 Gemini의 파비콘 변경8파일을 발견했다. 담당 기록은21:35 종료·미커밋이며, [별도 기준선](CONCURRENT-CHANGE.json)으로 보존한다.
- 기존 통합 대상은 `da3a96e`로 고정했다. 새 변경을 이번 merge에 암묵 포함하거나 root를 자동 전환·stash·reset하지 않는다. 사용자에게 별도feature 보존/이번통합 포함/미커밋 유지 범위를 확인 중이다.

## 통합 후보 검증 완료

- [검증 결과](VALIDATION.json): API/Web build, API service35·공통35·Collector289·API 실DB30files/130tests·로컬권한1·hook12·backup unit17 및 Python runner 통과. 타입7개·lint5개 통과, 변경된 Web/tests 검사는 다시 통과했다.
- Chromium 첫 실제 실행은54개 중44PASS/10FAIL이었다. 실패 원인2개를 수정한 뒤 영향 파일5개의23개가 모두 통과해 전체54개 항목의 통과 증거를 확보했다. 실제 예약 시각/재시작 시험도 통과했다. 초기 실패를 최종통과와 구분하고 assertion 약화·skip은 하지 않았다.
- API mailbox 지정 포트 오류는 별도55449 시험 환경으로 해결했다. 먼저 통과한17files를 반복하지 않고 해당 파일과 잔여12files를 통과했다. 합계30files/130tests, 실패0·skip0.
- [관리자 검수390px](artifacts/batch-review-390.png), [직접 입력390px](artifacts/direct-input-390.png), [공유320px](artifacts/public-share-320.png)를 저장·시각 확인했다. 초기 중복 메뉴가 제거됐고 가로 넘침 검증도 통과했다.
- Markdown 상대 경로1224개 누락0, 기존 법무 placeholder 제거0, historical worklog 원문 삭제0, SQL/생성 계약 checksum과 OpenAPI 정본/복사본 동일성을 확인했다.
- 이 시점은 로컬 병합 후보의 검증 완료다. merge commit·원격 readback·종료 브랜치 처리는 후속 마감 기록으로 구분한다.

## 원격 반영·브랜치 정리 결과

- 통합 commit **`53873d06806bf3e75356d581a16cf3efe3d19887`**, tree `738cbe7ac98605e5e3dbf3caf38cf65ecf57b076`. 검증 후 stage tree와 commit tree가 같다. 부모는 날짜순 release `0545759`와 feature `da3a96e`다.
- 일반 `git push origin release:release` 완료. 서버 직접 SHA와 local/origin release 동일, ahead/behind0/0. main은 local/origin 모두 `8af7244`로 유지했다. main 승격·운영 배포·실제 외부 수집은 없다.
- 삭제: 로컬 `feature/ai-workflow-design`, `feature/git-local-guards`, 기존 backup3개(총5); 원격 `planning-design-only`1개. 원격 삭제는 기대 SHA를 명시한 lease로 다른 변경을 보호했다. release 강제 push는 하지 않았다.
- 삭제 전 로컬2개는 통합 release의 조상임을 확인했고 backup3개는 bundle SHA·별도 bare 복구 commit/tree로 다시 확인했다. 원격 planning branch는 main 조상이고 head/base 열린PR0이었다.
- 유지: main/release, feature/m0-core의 별도 worktree와 dirty88개, 나머지 고유 원격14개, 현재 feature/m0-design-completion local/remote. 기존 PR8개는 그대로다. 작업용 임시 PostgreSQL container는 소유 ID·label 대조 후 제거했다.
- 실행 중 새로 생긴 Gemini 파비콘8파일은 SHA-256 불변이다. 사용자 범위 답변 전에는 임의 커밋·통합·이동하지 않는다. 이에 따라 root feature 삭제와 root release 전환/clean 마감은 보류한다. 이 예외를 전체 clean으로 보고하지 않는다.
- [상세 결과](INTEGRATION-RESULT.json), [검증한 source subtree](VALIDATED-SOURCE-TREES.json)를 따른다. 이 마감 문서는 검증한 source를 바꾸지 않는 별도 feature→release 경로로 반영한다. 최종 release tip에는 마감 기록 커밋/병합이 더해질 수 있다.
