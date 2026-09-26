# S01 실행 결과 — A 백업

- 세션/분야: S01-A / GOV-28 Git 자산 백업.
- 실행일: 2026-09-26 KST. 원문 snapshot 14:58:15, 객체·원문 대조 14:59:54. 작업본 복원·마감 시각은 연결한 JSON 증거에 기록.
- 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, `develop`, HEAD `8af72449a7d56c9701efd0d73dc7d430a66f9610`.
- 입력: [세션 안내](../requests/README.md), [S01 요청서](../requests/S01-git-assets.md), [이전 inventory](../../archive/2026-09-26-full-inventory/inventory.json).
- 사용자 지시: “문서를 읽고 `S01-A — 백업` 진행후 보고 해”.
- 결과 상태: **S01-A 백업 및 로컬 복원 검증 완료 / S01-B 미실행**.
- [archive 안내](../../archive/2026-09-26-s01-a-backup-145815/README.md) · [복원 명령](../../archive/2026-09-26-s01-a-backup-145815/RESTORE.md).

## 1. 선택과 진척

| issue | 기존 완료 범위 | 선택과 근거 | 이번 수행 | 남은 항목 |
| --- | --- | --- | --- | --- |
| GOV-28 | 자산 inventory 작성 | 사용자 지정 S01-A 백업; 유지/철회 선택은 보류 | 원문·bundle·hook/config 보관, 독립 readback 및 작업본 복원 | S01-B는 후속 선택·결과와 명시된 정리 범위 확보 후 별도 실행 |

## 2. 입력과 보존

| 작업본 | HEAD | 추적 수정 | 미추적 | 결과 |
| --- | --- | ---: | ---: | --- |
| 기본 develop | `8af72449a7d56c9701efd0d73dc7d430a66f9610` | 0 | 90 | 모두 보존·복원 대조 |
| ci-browser-review | `2b61c4ca038adea80069f0d020019199b4c1e53c` | 0 | 0 | HEAD·Git 상태 보존 |
| git-governance | `f376e3dd7a2a41d489d5e0e67b591d62fe151753` | 0 | 0 | HEAD·Git 상태 보존 |
| governance-delivery | `6a431358db73b9c59be4125fa0749beb014e7acd` | 0 | 0 | HEAD·Git 상태 보존 |
| m0-core | `a273f3c853fe0cf8260e3c7eb9daa2cfd1b02727` | 20 | 68 | 다른 작업의 원문 보존·복원 대조; 정리 대상 아님 |
| stash-recovery | `5957492429b668377bede866c90f878b43225785` | 8 | 2 | 모두 보존·복원 대조 |

- 이전 inventory 대비: 기본 미추적 70→90개. 증가분은 inventory 5개와 session-tasks 15개 문서/JSON이며 삭제·누락은 없다. S01 요청서의 51개보다 실제 최신 목록을 우선했다.
- 이전 목록의 ref 36개에 Codex 보조 ref 5개가 추가되어 현재 41개다. 작업 시작·종료 간에는 ref·stash·worktree·설정이 동일하다.
- 로컬 HARN branch 10개, 원격 HARN 9개, 전체 원격 branch 17개, 열린 PR 8개. 원격 branch SHA·PR base/head/state는 이전 inventory와 같다.
- 로컬 develop `8af7244`와 원격 develop `1ad626c`를 각각 보관했다. 로컬 ref 갱신은 하지 않았다.
- stash `c373dac4ad6584e663ad958d1c9d64767dc48605`와 부모 2개, 보조 ref `fixprep/harness`, 기존 main 제품 commit을 bundle에 포함했다.
- 원문/변형본 HTML 49쌍과 현재 작업본 hash는 [fixtures.json](../../archive/2026-09-26-s01-a-backup-145815/fixtures.json)에 기록했다.
- 원본 354개 경로·SHA-256·권한은 [manifest](../../archive/2026-09-26-s01-a-backup-145815/source-file-manifest.json), 각 작업본 staged/unstaged diff SHA-256은 [before.json](../../archive/2026-09-26-s01-a-backup-145815/before.json)에 있다.

## 3. 변경과 검증

| 수행 | 명령/방법 | 실제 결과·근거 |
| --- | --- | --- |
| 최초 이력 백업 | 원본에서 `git bundle create … --all` | 원본 refs·stash를 포함한 최초 bundle 보존 |
| 최종 bundle 구성 | 격리 bare repo에 bundle import, 필요 SHA·remote/PR ref 추가, 새 bundle 생성 | 원본 저장소 ref/config 쓰기 없음; 별도 `refs/s01/*` 이름 사용 |
| Git 독립 복구 | 빈 bare repo에서 `git bundle verify`, bundle fetch, `git fsck --full --strict --no-reflogs` | 모두 통과 |
| commit/tree/blob 읽기 | 격리 repo `git cat-file` | commit 23개·tree 4개, inventory blob 976개, fixture 49쌍 통과 |
| 원문 보관·readback | 파일 내용 SHA-256 및 mode 대조 | 원본 354개 모두 일치; 불일치 0 |
| 미커밋 복구 | 빈 저장소에서 bundle fetch→해당 HEAD→staged/unstaged patch→원문 복원 | 3개 작업본 총 188개 status, 두 diff, index 항목 일치 |
| 작업 전후 보존 | HEAD·branch·refs·stash·status·diff·Git metadata/config hash 대조 | 기존 상태 불변 |
| 원격 현황 | 공개 GitHub REST GET / `git ls-remote` | branch/PR 기록 일치; 원격 쓰기 0 |
| 산출물 마감 | SHA-256 목록·링크·공백·Git ignore·소유 경로 확인 | [최종 검사](../../archive/2026-09-26-s01-a-backup-145815/final-check.json) |

- 검증 상세: [verification.json](../../archive/2026-09-26-s01-a-backup-145815/verification.json), [restore-readback.json](../../archive/2026-09-26-s01-a-backup-145815/restore-readback.json).
- 주 bundle: `private/git-assets.bundle`, 7,986,944 bytes.
- 주 bundle SHA-256: `53fd80869f224a392421bde410fecab9278a68cab407c6e422965e7248780738`.
- 실제 추가 경로: 이번 archive 디렉터리와 이 결과 파일만. 제품 코드·공유 파일은 수정하지 않았다.
- 검증 스크립트는 Codex tree ref와 all-zero 삭제 표시를 구분하도록 보완했다. 최종 readback 통과; 남은 차단 없음.
- hook 실행/복원·설정 적용 검증은 이번 범위가 아니다. 설치된 wrapper 16개와 metadata·이전 hook 위치를 보관했다.

## 4. 완료 조건과 미완료

- 완료: 복원 가능한 bundle·미커밋/미추적 원본·hook/config 원본, hash 목록, 격리 readback, 작업 전후 불변, 복원 명령 확보.
- 원본 payload는 archive의 `private/`에 저장하고 Git ignore 및 디렉터리 `0700`을 적용했다. 민감한 원문은 추적 문서에 옮기지 않았다.
- 동일 저장 장치의 로컬 백업이다. 별도 장치 복사·암호화·외부 업로드는 수행하지 않았다.
- 범위 제외: 재생성 가능한 tool/dependency/build cache, ignored runtime DB, 저장소 밖 OS 자격 증명. 제외 목록은 `before.json`과 `verification.json`에 있다.
- 미실행: S01-B, 삭제, reset/rebase/amend, stash pop/drop, branch/worktree 정리, hook 설정 변경, commit, push, PR 변경, 원격 보호 변경, CI, DB 변경, 배포.
- 앱 코드를 바꾸지 않아 제품 build/test는 실행하지 않았다. 이 결과는 원격 통합이나 운영 도입 완료를 뜻하지 않는다.

## 5. 다음 담당에 넘길 자료

- 다음 담당 **S02**: [fixtures.json](../../archive/2026-09-26-s01-a-backup-145815/fixtures.json)과 `private/fixtures/{baseline,stash}/`의 HTML 49쌍, 제품 commit이 포함된 bundle을 사용해 보존 대상을 선택한다.
- S03 참조: `private/git-admin/`의 wrapper·metadata·config와 `private/config-sources/`. 원본 설정에 일괄 덮어쓰지 않는다.
- archive 전체 SHA-256: [SHA256SUMS](../../archive/2026-09-26-s01-a-backup-145815/SHA256SUMS).
- 어느 원본 worktree도 사용 종료 또는 정리 가능으로 판정하지 않았다. m0-core를 포함한 6개 모두 보존했다.
- S02~S11, S01-B, 취소된 T1은 자동 시작하지 않았다.
