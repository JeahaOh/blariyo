# Git governance 설계 보관본

- 보관일: 2026-09-26 KST.
- 목적: 거버넌스 설계를 원격의 별도 보관 브랜치에 남긴다. **현재 운영 지침이나 구현 재개 계획이 아니다.**
- 브랜치: `docs/git-governance-design-archive`.
- 기준: 원격 main의 `8af72449a7d56c9701efd0d73dc7d430a66f9610`. 이 기준에서 추가하는 파일은 이 폴더의 Markdown 3개뿐이다.
- 설계 출처: 후속 구현 검토본의 `6a431358db73b9c59be4125fa0749beb014e7acd`. 파일은 이 commit에서 직접 읽었다. 미커밋 수정본을 최신본으로 간주하거나 다른 변경과 합치지 않았다.

## 보관 문서

| 문서 | 원본 줄 수 | 원본 Git blob |
| --- | ---: | --- |
| [git-workflow.md](git-workflow.md) | 466 | `20c542e615352323d441ea6b073a9f32b4790c15` |
| [harness-implementation-plan.md](harness-implementation-plan.md) | 295 | `b52734fe08d6a25762a269863b968f1a3fcbc66c` |

초기 설계는 `21b8828d07e059fc93b23caf81d0ecf97957cb15`에서 작성됐으며, 여기에는 이후 설계 보완이 담긴 후속본을 보관한다. 초기본과 미커밋 복구본을 별도로 덮어쓰거나 삭제하지 않는다.

## 보관 방식과 해석

- 각 파일에 과거 설계라는 안내를 추가하고, 두 설계 간 링크는 이 폴더 안에서 연결했다.
- 나머지 상대 링크는 원본 commit의 GitHub 경로로 고정했다. 링크된 source·workflow·작업 기록은 당시의 참고 자료이며 이 브랜치에 새로 반영한 구현이 아니다.
- 위 두 조정 외에는 원본의 내용·순서·미정 표시를 보존했다. 안내와 링크 변환을 역으로 적용하면 원본 bytes와 일치하는지 확인한다.
- 본문의 현재 checkout, hook 설치, PR/CI 성공·실패, 승인·운영 상태는 **문서 작성 당시의 설명**이다. 보관일 현재 상태나 앞으로 따라야 할 강제 규칙으로 사용하지 않는다.
- 이 브랜치에 설계를 보관했다는 사실은 main/release/develop 통합, governance 운영 도입, 배포 완료를 뜻하지 않는다.

## 원본 식별

원본 SHA-256:

- `git-workflow.md`: `afb8e20f490a1d70e522f583058c481c45e5bd29f12f887ba4a6a4b77bd8f53d`
- `harness-implementation-plan.md`: `2ee2aef970cdf24a5f6ed561aa32427cc6e9defe52c3cf4c7bb964d81ce28661`

대조 기준은 원본 commit에서 읽은 파일이다. 원본 참조 링크의 대상 파일 존재, 상대 링크, Markdown 공백 및 추가 파일 범위가 보관 검증 대상이다. 외부 사이트의 현재 내용이나 제품 runtime은 이 보관 작업의 검증 범위가 아니다.

## 변경 범위

이 브랜치의 새 commit은 설계 두 문서와 이 안내만 추가한다. 기존 제품 코드·테스트·workflow·정책 파일·Git 설정을 수정하지 않으며, S01~S03 결과·수동 검사 도구·미커밋 파일·stash를 함께 올리지 않는다. 기존 branch/PR/worktree 삭제와 배포는 별도 작업으로 남긴다.
