# GitHub Free 유지와 로컬 Git hook 적용

- 요청: GitHub Free를 유지하고 hook을 사용한다. 플랫폼 이전·유료 보호·추가 CI는 필수 조건에서 제외한다.
- 담당: Codex. 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/git-local-guards`. 출발: `release@6b91402f11df5c08c0147bab14fd2df7c681cbd8`.
- 상태: 종료 — 구현·현재 clone 설치·로컬 검증 완료. 갱신: 2026-09-26 19:48 KST.
- 변경 범위: `.githooks/`, `scripts/git-hooks.mjs`, `scripts/git-hooks.test.mjs`, `package.json`,
  `AGENTS.md`, `docs/ai/{README,git-workflow,harness}.md`, 이 기록과 `DECISIONS.md`의 후속 결정.
- 설치 범위: 이 clone의 Git 공통 디렉터리 `blariyo-hooks/`와 로컬 `core.hooksPath`.
- 시작 시 기존 변경 22개 파일의 SHA-256을 보존했다. 다른 작업 기록의 종료 상태를 확인하고 같은 HEAD에서 작업 브랜치를 만들었다. worktree는 만들지 않았다.
- 기존 `core.hooksPath` 설정과 실행 hook은 없었다. 과거 `.git/harness-hooks`는 존재하지 않는다.
- 검증 범위: 임시 로컬 저장소에서 실제 commit·merge·push의 허용·차단, 다른 ref 이름·복수 ref·삭제·강제 push·원격 기준 미수신, 설치 충돌·재설치·브랜치 이동 후 지속.

## 구현과 적용 결과

- 변경 13개 파일: hook 4개, 설치·테스트 script 2개, package.json, AGENTS, AI 안내·Git workflow·harness,
  DECISIONS 후속 결정, 이 기록. CLAUDE·GEMINI는 공통 AGENTS import를 유지하므로 별도 규칙을 복제하지 않았다.
- `pre-commit`: main 직접 commit·release 일반 commit 차단. MERGE_HEAD가 있는 release 병합 완료는 허용.
- `pre-merge-commit`: main 로컬 merge commit 차단. 정상 feature→release merge commit은 허용.
- `pre-push`: 실제 목적지 main의 생성·수정·삭제 차단. release 삭제·non-fast-forward 이력 변경 차단.
  release 최초 생성과 기존 이력을 보존하는 push는 허용. 원격 기준 객체가 없으면 자동 fetch 없이 중단.
- 설치: `npm run hooks:install` 성공. `core.hooksPath`는 이 clone의 `.git/config`에
  `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/blariyo-hooks`로 설정됐다.
- 설치된 사본은 브랜치 이동 후에도 유지된다. source 갱신 시 `hooks:check`가 차이를 감지하며,
  검토 후 `hooks:install`로 재설치한다. 기존 hook·알 수 없는 설치 경로는 자동 덮어쓰지 않는다.

## 검증 결과

- `npm run test:git-hooks`: 12개 통합 테스트 통과, 실패·skip 0개. 테스트마다 임시 저장소·로컬 bare remote를 만들고 종료 후 정리했다.
- 허용: feature/hotfix commit·push, release merge --no-ff와 push, --no-commit 뒤 명시적 병합 완료, release 최초 생성.
- 차단: main commit·로컬 merge commit·HEAD:main·다른 remote 이름·삭제·최초 생성,
  release 일반 commit·삭제·force/force-with-lease 이력 덮어쓰기, 원격 기준 커밋 미수신.
- 복수 ref push에 main이 포함되면 허용될 feature ref까지 전송되지 않았음을 로컬 bare remote에서 확인했다.
- 설치 반복·설치본/source 불일치·기존 hooksPath와 실행 hook 보존·source가 없는 과거 브랜치에서 차단 지속을 확인했다.
- `npm run hooks:check`: 현재 clone의 설정·설치본 SHA-256·실행 권한 확인 성공.
- `git diff --check`, 신규 파일 공백 검사, 네 shell 파일 각각의 `sh -n`, 설치 script의 `node --check` 통과.
- 문서 로컬 링크 대상 73개 확인, 누락 0개. CLAUDE·GEMINI 본문 동일·AGENTS import 각각 1개 확인.
- 시작 시 기존 변경 22개 파일의 SHA-256이 모두 동일하다. HEAD는 출발 SHA와 같고 index는 비어 있다.

## 적용 한계와 잔여

- GitHub 서버 보호·웹/API 병합 차단·다른 clone 설치는 미적용이다. 원격 GitHub에 금지 push를 시도하지 않았다.
- fast-forward merge·reset·update-ref 등 모든 로컬 ref 변경을 차단하지 않는다. 설치 hook을 거치는 main push는 차단한다.
- 작업 기록 내용·승인·제품 테스트·병합 출발점 전체를 자동 검증하지 않는다. 나머지 harness 계약은 설계 단계로 남긴다.
- 실제 Claude·Gemini 세션을 실행한 준수 검증, 제품 테스트·배포는 수행하지 않았다.
- commit·release 병합·원격 push는 미실행이다. 다음 반영 시 이번 13개 파일과 기존 변경을 분리해 처리한다.

## 후속 설명 — 현재 hook의 실행 범위

- 요청: 현재 설정한 hook의 역할·실행 시점·차단 및 허용 범위를 설명한다.
- 담당: Codex. 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/git-local-guards`. 변경 경로: 이 기록만 추가.
- 상태: 종료. 갱신: 2026-09-26 19:50 KST.
- 현재 `guard.sh`와 적용 기록을 대조하고 `npm run hooks:check`를 다시 실행해 설정·설치본 일치·실행 권한을 확인했다.
- 설명 대상: 세 hook의 실행 시점, 실제 목적지 ref 검사, release 이력 보존 판정, 원격 기준 미수신 시 중단,
  설치 source와 실행 사본, 공통 Git 명령 적용, 자동 검증하지 않는 승인·작업 기록·제품 테스트·병합 방향.
- 12개 통합 테스트 통과는 직전 구현 검증 결과이며 이번 설명 요청에서 재실행하지 않았다.
- hook·정책·설정·브랜치를 변경하지 않았고 commit·push는 실행하지 않았다.

## 후속 확인 — 커밋 대상 목록

- 요청: 현재 커밋 대상 파일을 확인한다.
- 담당: Codex. 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/git-local-guards`. 변경 경로: 이 기록만 추가.
- 상태: 종료. 갱신: 2026-09-26 19:53 KST.
- Git 상태: 변경·미추적 파일 총 35개, staged 0개. 이번 hook·규칙 적용의 직접 대상은 위에 기록한 13개다.
- 이전 플랫폼 비교 기록 `GITHUB-FREE.md`와 이전 release 반영 기록 `RELEASE-DELIVERY.md`는 별도 문서 커밋 대상으로 구분한다.
- 나머지 20개는 기존 M0·기획·설계·법무·수집 재분석 관련 변경이므로 이번 hook 커밋에 섞지 않는다.
- CLAUDE.md·GEMINI.md는 변경이 없고, `.git/blariyo-hooks/`·`.git/config`는 로컬 설치 상태이므로 커밋 대상이 아니다.
- 실제 stage·commit·push는 실행하지 않았다.
