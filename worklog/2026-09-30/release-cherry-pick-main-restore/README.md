# release 날짜순 cherry-pick 및 local main 원복

- 사용자 요청: local main 고유 변경을 local release에 cherry-pick하고 작성일 순서로 정리. 검증 후 local main을 origin/main과 동일하게 원복.
- 담당: Codex / 본 세션. 상태: 종료. 갱신: 2026-09-30T20:30:07+09:00.
- 기본 작업 폴더·브랜치: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / `feature/m0-design-completion@c49d27fd1a6dd5a29df8165648fc912990563364`. HEAD·index·기존 변경 27개 SHA-256 보존.
- 변경 범위: 이 기록 폴더, 작업 전용 `.worktree/release-chronological-pick/`, local release/main ref와 복구용 backup ref. 임시 worktree·후보 브랜치 정리 완료.
- 사용자 최신 지시가 이력 재작성 및 local main 원복의 근거다. hook을 끄거나 기존 파일을 stash/reset하지 않았다.

## 결과

| 대상 | 변경 전 | 변경 후 |
| --- | --- | --- |
| local main | `e51f1b501f7cc327da279102dd69eac2f4c554db` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` |
| local release | `2126c053b35f2e2b4e45a8496e259ac211812772` | `054575928df7bd7e8f8a630c1234d7b3d054969c` |
| origin/main | `8af72449a7d56c9701efd0d73dc7d430a66f9610` | 동일 |
| origin/release | `6b91402f11df5c08c0147bab14fd2df7c681cbd8` | 동일 |

- 원격 `git ls-remote` 재조회 후 local main과 origin/main이 동일함을 확인했다. main/release는 예상 이전 SHA를 확인하는 하나의 ref transaction으로 갱신했다.
- `origin/main` 위에 **9/25 local main 고유 8개 → 9/26 기존 release 6개**, 총 14개를 작성일 오름차순으로 `cherry-pick -x` 했다. 원래 작성자·작성일 보존, 새 commit 생성일은 실제 실행 시각이다.
- 원본 merge `6b91402`는 앞선 `92f1e04`와 tree가 같아 `-m 1 --empty=keep`으로 단일 부모의 빈 이력 커밋으로 보존했다. 원래 merge 구조는 backup에 보존돼 있다.
- local release는 local main보다 14개 앞서며 main에만 남은 커밋은 0개다. 전체 tree `5d9cc2679e12fc580fee10d7e128281725303207`가 작업 전 release와 완전히 동일하다.
- 상태·운영 문서, Git workflow, roadmap 충돌은 앞선 통합 때 확인한 파일 내용으로 해결했다. 각 단계의 tree 일치 및 최종 tree 일치를 확인했다.
- 원본→신규 SHA와 날짜: [PICK-MAPPING.json](PICK-MAPPING.json). [대상·순서](PICK-ORDER.json), [시작 기준선](BASELINE.json).

## 검증

- 후보 `0545759`에서 Node 24.18.0으로 의존성 설치 후 API build 성공, 루트 테스트 **34/34 통과**(실패·skip 0), hook 설치 검사 통과.
- 의존성 설치 시 기존 패키지 deprecated 및 esbuild/fsevents/sharp install-script 미승인 경고가 있었다. 승인 정책을 변경하지 않았으며 이번 build/test는 정상 종료했다.
- [검사 명령·exit code](TEST-RESULTS.json), [API 빌드](api-build.log), [테스트](root-tests.log), [hook 검사](git-hooks.log).
- 14개 전부 원본 SHA 추적, 작성자·작성일 보존, 날짜순·단일 부모 확인. 전체 tree 일치: [후보 검증](CANDIDATE-VERIFICATION.json).
- 기존 변경 27개, 현재 feature HEAD/index 보존. 작업 범위 밖 변경 없음. `git diff --check` 통과. [ref 반영 결과](REF-RESULTS.json), [최종 검증](FINAL-VERIFICATION.json).
- 전체 웹 빌드·브라우저·DB·운영 검증은 이번 작업에서 실행하지 않았다. 이번 통과는 이력 재구성 및 위 로컬 검증 범위다.

## 복구 지점 및 잔여 범위

- `backup/main-before-release-pick-20260930` → `e51f1b501f7cc327da279102dd69eac2f4c554db`.
- `backup/release-before-chronological-pick-20260930` → `2126c053b35f2e2b4e45a8496e259ac211812772`.
- 앞선 `backup/release-before-main-rebase-20260930` → `bb19c486f3cafa847bd34828a699382c6d5bd0b6`도 유지했다.
- 원격 push·배포 없음. 재작성으로 origin/release에만 4개, local release에만 14개의 커밋 ID가 있다. 원격 반영은 단순 fast-forward가 불가능하며 별도 범위에서 결정한다.
- 현재 feature의 추가 구현·기존 미커밋 파일은 이번 release에 추가 통합하지 않았다. 이번 작업 기록도 현재 feature 폴더의 미커밋 파일로 남겼다.
- [이전 진행 계획](../release-rebase-and-next-plan/PROGRESS-PLAN.md)과 [문서 갱신 계획](../release-rebase-and-next-plan/DOCUMENT-UPDATE-PLAN.md)의 제품·운영 검증 항목은 유지한다. 브랜치 정리 방식·SHA·이력은 이번 결과가 대체한다. 과거 작업 기록은 소급 수정하지 않았다.
