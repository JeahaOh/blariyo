# 원격 브랜치 추가 정리

- 요청: 원격 브랜치 중 추가 정리할 대상을 선정해 실행.
- 담당: Codex / 상태: 종료 (원격3개 정리·보존 검증) / 갱신: 2026-09-30T22:38:13.319737+09:00.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / `feature/remote-branch-cleanup`.
- 기준 release: `d8ef8764540b3381e4f20588bb1a375a5a09f134`, 원격17개.
- 변경 범위: 검증한 원격 branch ref와 이 작업 기록. 앱 source·main·기존 미커밋88파일은 보존.
- 선택 기준: 현행 구현에 보존되거나 다른 유지 브랜치에 이력이 포함된 종료 브랜치, 명시적으로 폐기된 과거 prototype. 열린 PR의 head/base와 미반영 작업은 유지한다.
- 삭제 전 SHA 고정·bundle 복구·필요한 archive 참조·PR 조회를 확인한다. 삭제는 대상별 SHA lease를 사용한다.

## 정리 결과

원격 branch **17개 → 14개**. 원격 archive tag2개를 추가해 보관 목적과 개발 branch를 분리했다.

| 삭제한 원격 branch | 보존 위치·근거 |
| --- | --- |
| `feature/HARN-09-browser-retry` | `2b61c4c`가 유지한 `develop@1ad626c`와6개 PR branch의 조상. [PR3](https://github.com/JeahaOh/blariyo/pull/3) Merged 확인 |
| `docs/git-governance-design-archive` | 원격 tag `archive/2026-09-30/git-governance-design` → `20c7863`. 고유3문서와 전체 commit/tree 그대로 보존. release 반영으로 간주하지 않음 |
| `feature/m0-core-web` | 원격 tag `archive/2026-09-30/m0-core-web` → `c48f084`. 9/7에 폐기한 과거 Express prototype을 보관. 현재 `feature/m0-core` 작업본과 다른 branch |

- prototype 판단 근거: [현행 AI 안내](../../../docs/ai/README.md), [9/7 신규 개발 결정](../../2026-09-07/docs-consolidation/report.md). 원본 prototype source를 현행 source에 합치거나 삭제하지 않았다.
- 각 삭제는 확인한 SHA에 대한 lease와 atomic push로 실행했다. 원격 head 목록 readback에서3개 삭제와 나머지14개 SHA 불변을 확인했다.
- [전체 선정표](DECISIONS.json), [PR 대조](PR-CHECK.json), [삭제 결과](RESULT.json), [원격 archive readback](ARCHIVE-READBACK.json).

## 보존한14개

- main/release2개: 영구 branch. main은 `8af7244` 유지.
- 열린 PR8개의 head8개와 공통 base `develop`1개: branch 연결을 유지했다. PR 폐쇄·base 변경·미반영 harness 도입은 수행하지 않았다.
- `feature/DPL-00-nightly-deploy-design`: 원격 고유 설계15경로가 release와 다르며 미반영 상태여서 유지.
- `feature/discord-env-setup`: 환경 template·백업 기록 등5경로 미반영 작업을 유지.
- `feature/m0-core`: 별도 작업 폴더의 수정20+untracked68=88개와 HEAD·status·파일해시 모두 보존.

## 복구·검증

- [백업 검증](BACKUP-VERIFICATION.json): `.local-data/git-backups/remote-cleanup-20260930/before-cleanup.bundle`, 10,398,339bytes. Git bundle verify, 독립 bare 저장소17개 ref commit/tree readback, fsck PASS.
- bundle은 `refs/remotes/origin/*`를 담는다. 일반 bare clone은 해당 namespace를 자동 가져오지 않아 최초 복구 검사는 실패했다. 명시적 `refs/remotes/origin/*:refs/heads/*` fetch 후17개 모두 조회·검증해 복구 완료를 판정했다.
- 원격 보관 tag2개의 peeled commit은 삭제 전 tip과 정확히 같다. tag는 작업 이력 보관용이며 제품 출시 tag가 아니다. 브라우저 수정 커밋은 유지한 develop에서도 복구 가능하다.
- 복구 예: `git branch restore/m0-core-web archive/2026-09-30/m0-core-web`. 이 명령은 복구 방법이며 이번 작업에서 실행하지 않았다.
- hook 설치 검사, JSON parse, 기록 링크·staged 범위·`git diff --check` 확인. 앱 source·migration·test·workflow는 변경하지 않았으므로 제품 시험을 반복하지 않는다.
- 이 결과를 feature에서 commit 후 release에 병합·일반 push한다. 최종 SHA·원격 동기화·root clean은 실행 후 응답으로 보고한다. main 승격·운영 배포는 포함하지 않는다.
