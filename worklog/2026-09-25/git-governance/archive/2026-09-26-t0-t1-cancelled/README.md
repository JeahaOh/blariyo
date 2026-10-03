# 2026-09-26 Git governance T0·T1 취소 보관본

- 상태: **사용자 요청으로 작업 중단 및 이번 세션 변경 원복 완료.**
- 확인 시각: 2026-09-26 13:21 KST.
- 이 폴더의 요청서·계획·실행 기록은 취소 당시의 과거 자료다. 현재 실행 지시나 재개 승인으로 사용하지 않는다.
- 기존 T1 goal은 `paused`로 전환했다. T1 통합을 완료 처리하지 않았으며 후속 task를 자동 실행하지 않는다.

## 보관 자료

- [REQUEST.md](REQUEST.md): 기존 T0 요청서. 이동에 따른 상대 링크 2개만 보정했다.
- [PLAN.md](PLAN.md): T0에서 작성한 통합 계획 원문.
- [T1.md](T1.md): 취소 전 최소 수정·로컬 검증·중단 기록 원문.
- [evidence/](evidence): 검증 로그, 기준 상태, 이력·SHA 검사, 되돌린 선택자 patch 등 12개 파일.
- [manifest.json](manifest.json): 원본·보관 경로와 SHA-256, 보관 시 변경한 링크의 범위.
- [rollback-before.json](rollback-before.json), [rollback-result.json](rollback-result.json): 원복 전 기준과 원복·보존 확인 결과.

## 원복 결과

- `tests/browser/admin-recovery.test.ts`의 이번 세션 선택자 2줄 수정을 H4 원본으로 복원했다.
- clean 상태를 확인한 뒤 이번 세션에서 만든 `/private/tmp/blariyo-governance-t1-20260926` worktree와 설치·빌드 산출물을 제거했다. 기존 H4 branch와 commit은 보존했다.
- 문서 3개와 검증 자료 12개를 이 폴더에 보관·검증한 뒤 기존 `worklog/2026-09-26/git-governance`와 임시 evidence 폴더를 제거했다.
- 기본·delivery 작업본의 기존 파일·변경, 기존 branch·stash, 다른 worktree, 공용·delivery Git 설정과 hook의 보존을 확인했다.
- 이번 세션에서는 commit·push·새 CI·PR 변경·병합·hook 설치를 실행하지 않았다. 이전 세션의 구현·PR·commit은 이번 원복에서 변경하지 않았다.

## 검증

- 보관 15개 파일의 manifest hash 일치. PLAN·T1 및 검증 자료 12개는 원본과 byte 단위로 동일하다.
- 보관 전 15개 파일의 기존 비밀 탐지 검사 결과 0건.
- 이동 문서의 상대 링크 5개 존재 확인. 보관 색인 링크와 공백·변경 범위도 확인했다.
- 코드 원복은 Git 원본 복원과 clean 상태로 검증했다. 취소한 구현의 CI나 테스트를 새로 실행하지 않았다.
