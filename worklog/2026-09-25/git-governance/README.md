# Git governance 기록 모음

**현재 결정: 설계는 원격 보관, 정리한 문서·증거 112개는 로컬 `release`에 보존, 제품 작업은 `main`과 `feature/*`에서 유지.**
2026-09-26 후속 지시에 따라 로컬 브랜치는 `main`·`release`·`feature/*` 체계를 사용한다. 문서 정리 커밋을 `release` 위로 rebase하며, 선행 문서·복구 근거는 포함하고 수동 Git 검사 실행 코드·테스트 3개는 제외한다. 거버넌스 도입·통합을 재개하는 실행 계획은 없다.

## 먼저 볼 문서

| 확인할 내용 | 문서 |
| --- | --- |
| 무엇을 삭제하고 무엇을 남겼는가 | [로컬 폐기 결과](session-tasks/results/LOCAL-CLEANUP.md) |
| hook·lint·아키텍처 등 분야별 최종 선택 | [세션별 상태와 결과](session-tasks/README.md) |
| 남겨 둔 설계 | [원격 설계 보관 안내](https://github.com/JeahaOh/blariyo/blob/20c7863150bd071e32d20507d5a48c004430c0e6/worklog/2026-09-25/git-governance/design-archive/README.md) |
| 원래 구현 범위와 32개 issue | [전체 조사 기록](archive/2026-09-26-full-inventory/README.md) |
| 삭제한 자료의 복원 | [S01 복원 안내](archive/2026-09-26-s01-a-backup-145815/RESTORE.md) |

## 문서 구조

```text
git-governance/
├── README.md                         현재 안내
├── session-tasks/
│   ├── README.md                     분야별 상태·결과
│   ├── requests/                     폐기 전 요청서·11개 세션 계획
│   └── results/                      실제 실행 결과·검증 자료
└── archive/
    ├── README.md                     시점별 기록·백업 안내
    ├── 2026-09-25-implementation/     초기 설계 요청·구현·lint 기록
    ├── 2026-09-26-t0-t1-cancelled/    취소한 통합 계획
    ├── 2026-09-26-full-inventory/     32개 issue·495개 경로 조사
    ├── 2026-09-26-s01-a-backup-145815/ 원문·Git bundle·복원 근거
    ├── 2026-09-26-local-cleanup/      실제 로컬 폐기 목록·검증
    └── 2026-09-26-document-layout/    이번 문서 이동·검증 기록
```

## 남긴 것과 종료한 것

| 구분 | 결정·근거 |
| --- | --- |
| Git·Harness 설계 | 별도 원격 보관 브랜치 `docs/git-governance-design-archive`, 보관 commit `20c7863150bd071e32d20507d5a48c004430c0e6` |
| 제품 변경·원문 fixture | 보존. [S02 결과](session-tasks/results/S02-RESULT.md)와 로컬 폐기 결과에서 후보·백업을 확인 |
| 수동 공백·비밀 후보 검사 | 이번 `release`에는 실행 코드·테스트를 포함하지 않음. [당시 사용 안내·source 원문](session-tasks/results/S03-assets/manual-checks.patch)과 이관 전 Git bundle로 보존. 자동 hook과 task·branch 강제 연결은 해제 |
| 로컬 거버넌스 구현 | 작업본 4개, HARN 브랜치 10개, 미추적 구현 51개, stash 1개와 비활성 hook·관련 캐시 삭제 |
| 기존 원격 HARN 브랜치·PR | 로컬 폐기 작업에서는 변경하지 않음. 이 문서 재구성에서도 원격 상태를 다시 조회하거나 변경하지 않음 |
| 과거 T0/T1·S04~S11 실행 계획 | 과거 요청으로 보관. 구현·통합을 자동 재개하지 않으며, 폐기를 각 세션의 구현 완료로 바꾸지 않음 |

원격 설계 본문: [Git 작업 설계](https://github.com/JeahaOh/blariyo/blob/20c7863150bd071e32d20507d5a48c004430c0e6/worklog/2026-09-25/git-governance/design-archive/git-workflow.md) · [Harness 구현 계획](https://github.com/JeahaOh/blariyo/blob/20c7863150bd071e32d20507d5a48c004430c0e6/worklog/2026-09-25/git-governance/design-archive/harness-implementation-plan.md).
원격 파일 확인 근거는 [당시 readback](archive/2026-09-26-local-cleanup/design-archive-readback.json)에 있다.

## 기록을 읽는 기준

- `requests/`와 시점별 archive의 “현재”, “다음 작업”, “승인 필요”, CI 결과는 **그 기록을 작성한 당시**의 표현이다. 지금의 실행 지시로 사용하지 않는다.
- 원문 JSON·patch·로그·스크린샷·Git bundle·`SHA256SUMS`는 복구·검증 자료다. 내부의 과거 절대 경로와 SHA는 증거로 보존했다.
- S01 백업과 S02·S03 증거 묶음의 위치·내용은 유지했다. 이번 작업에서는 문서 위치와 탐색 링크만 정리했다.
- 문서 재구성 당시 이동은 [이전→현재 경로 목록](archive/2026-09-26-document-layout/manifest.json), 당시 검증은 [문서 구조 검증](archive/2026-09-26-document-layout/verification.json)에서 확인한다. 이 기록을 작성한 뒤 문서 정리 커밋과 로컬 `release` 이관을 진행했다. 원격 push는 하지 않는다.
- 이관 전 `develop`의 두 커밋과 삭제 후보 브랜치 원문은 로컬 `/Users/zeaha/task_list/20260926-blariyo-release-docs-transition/before.bundle`에 별도 보존한다. `main`의 제품 커밋과 `feature/m0-core`의 미커밋 작업은 이번 문서 이관에 섞지 않는다.
