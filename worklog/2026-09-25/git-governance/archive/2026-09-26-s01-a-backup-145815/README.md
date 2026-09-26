# S01-A Git 자산 백업 — 2026-09-26

- 상태: **원본 백업·격리 readback·미커밋 작업본 복원 검증 완료**.
- 백업 기준 시각: 2026-09-26 14:58:15 KST. 종료 검증 시각은 [최종 검사](final-check.json)를 따른다.
- 범위/사용자 지시: `session-tasks/README.md`를 읽고 `S01-A — 백업` 진행 후 보고.
- 결과: [S01-RESULT.md](../../session-tasks/results/S01-RESULT.md).
- S01-B 정리, 다른 세션, commit/push, PR 변경, CI, DB, 배포는 실행하지 않았다.

## 보존과 검증

| 대상 | 수량·결과 |
| --- | --- |
| 기존 worktree | 6개 HEAD·branch·status 보존 |
| 미커밋/미추적 원문 | 188개: 추적 수정 28개 + 미추적 160개 |
| Git 내부·hook·설정·기록 | 153개; 설치 wrapper 16개와 설치 전 hook 위치 포함 |
| 외부 Git config 원본 | 2개; 값은 `private/config-sources/`에만 보관 |
| 연결 worktree `.git` 포인터 | 5개 |
| Git ignore된 governance 증거 로그 | 6개 |
| 원본 복사 검증 합계 | 354개 내용 SHA-256·권한 일치 |
| Git bundle | 7,986,944 bytes; `bundle verify` 및 격리 `fsck --full --strict` 통과 |
| ref·필수 객체 readback | 원래 ref 41개 일치; commit 23개·tree 4개 읽기 성공 |
| 기존 inventory의 파일 객체 | 실제 blob 976개 읽기 성공; 삭제 표시인 all-zero ID는 객체에서 제외 |
| GOV-32 HTML fixture | 49개 × 원본/변형본 = 98개 추출·hash 대조 성공 |
| 미커밋 작업본 실제 복원 | 기본 90개, m0-core 88개, stash-recovery 10개 status·diff·index 일치 |
| 원격 읽기 | branch 17개·열린 PR 8개; 기존 inventory의 branch 및 PR base/head/state와 동일 |

주 bundle SHA-256:

```text
53fd80869f224a392421bde410fecab9278a68cab407c6e422965e7248780738
```

## 산출물

- [before.json](before.json), [after.json](after.json): 원본 Git 기준선과 백업 직후 비교.
- [inventory-delta.json](inventory-delta.json): 이전 조사 이후 차이. 기본 미추적 70→90개, Codex 보조 ref 5개 증가. 작업본 HEAD와 원격 branch/PR 변경 없음.
- [remote.json](remote.json): 공개 GitHub REST GET 및 `ls-remote`로 확인한 branch·PR·SHA. 보호 정책 권한 감사나 CI 재실행 증거가 아니다.
- [source-file-manifest.json](source-file-manifest.json): 원본 경로↔보관 경로·종류·SHA-256·권한 354개.
- [fixtures.json](fixtures.json): S02 인계용 49개 원본/변형본 blob·SHA-256·보관 경로·현재 작업본 비교.
- [verification.json](verification.json): bundle·객체·원문 검증과 원본 불변 확인.
- [restore-readback.json](restore-readback.json): 백업만 이용한 미커밋 작업본 3개 실제 복원 검증.
- [final-check.json](final-check.json): 최종 원본 불변·범위·링크·공백·Git ignore 검사.
- [SHA256SUMS](SHA256SUMS): 이 파일 자체를 제외한 archive 전체 파일의 체크섬. `S01-RESULT.md`는 archive 밖의 인계 문서다.
- [복원 명령](RESTORE.md).

## 원본 보관 위치와 경계

- `private/git-assets.bundle`: 기존 local ref·stash·필수 과거 SHA·현재 remote/PR SHA를 포함한 독립 복구 bundle. `refs/s01/*`는 격리 저장소에서만 만든 백업용 이름이다.
- `private/local-original.bundle`: 원본 저장소에서 `--all`로 만든 최초 bundle.
- `private/worktrees/<작업본명>/files/`: dirty/untracked 원문. `staged.patch`, `unstaged.patch`, `index-entries.z`, `effective-config.z`도 함께 보관.
- `private/git-admin/`: Git 관리 원본; hook wrapper·설치 metadata·설치 전 hook·index·refs·reflog·설정·작업 기록.
- `private/config-sources/`, `private/remote-*-raw.json`: 외부 Git config·API 원문. 민감한 값은 보고서에 복사하지 않았다.
- `private/fixtures/{baseline,stash}/`: HTML 원본과 stash 변형본. 선택·원복하지 않았다.
- `private/`는 권한 `0700`이고 이 archive의 `.gitignore`로 제외했다. 암호화본 또는 별도 장치 사본은 아니다. 공유 시 raw payload 포함 여부를 별도로 판단한다.
- `.git/objects`는 bundle로 보존했다. 재생성 가능한 quality/collector 가상환경·도구 캐시, ignored build/dependency/runtime DB, 저장소 밖 OS 자격 증명은 이 Git 자산 백업 범위에서 제외했다. ignored 목록은 `before.json`에 남겼다.
- 검증용 `/private/tmp/blariyo-s01-*`는 보조 산출물이며 archive 복원에 필요하지 않다.

## 검사 중 보완

- Codex 보조 ref가 tree를 가리키는 사례와 삭제 경로의 all-zero blob 표시를 검증 입력에서 구분했다.
- 두 입력 처리 문제는 각각 원인 확인 후 수정했다. Git 원본·hook·제품 코드는 변경하지 않았다.
- 최종 검증은 모두 통과했으며, 실행 스크립트와 로그는 `private/`에 보관했다.
