# 분야별 상태와 실행 기록

[전체 안내](../README.md) · [로컬 폐기 결과](results/LOCAL-CLEANUP.md) · [폐기 전 세션 계획](requests/README.md)

**2026-09-26 최종 선택:** 제품 작업은 보존하고, 문서·증거는 로컬 `release`에 기록한다. 수동 Git 검사 실행 코드·테스트는 이번 이관에서 제외하고 원문 patch·Git bundle에 보관한다. 나머지 거버넌스 구현의 로컬 폐기 기록은 아래 결과를 따른다.
아래는 분야별 찾아보기이며 새 실행 순서나 후속 승인 요청이 아니다.

## 분야별 상태

| 세션 | 분야 | 최종 선택·진척 | 근거 |
| --- | --- | --- | --- |
| [S01](requests/S01-git-assets.md) | Git 자산·브랜치·작업본 | 원문 백업·복원 검증 완료. 후속 로컬 폐기도 완료 | [백업 결과](results/S01-RESULT.md), [폐기 결과](results/LOCAL-CLEANUP.md) |
| [S02](requests/S02-product-preservation.md) | 제품 변경·원문 fixture | 제품 후보·원문·회귀 수정 보존. 후보 검증과 develop 통합은 별도 | [실행 결과](results/S02-RESULT.md), [제품 보존 자료](results/S02-assets/README.md) |
| [S03](requests/S03-hooks-secrets.md) | Git hook·수동 비밀 검사 | 강제 hook 연결 복원 완료. 비활성 wrapper 폐기. 당시 분리한 수동 검사 원문은 보존하되 이번 release에 구현은 포함하지 않음 | [실행 결과](results/S03-RESULT.md), [당시 사용 안내·source 원문](results/S03-assets/manual-checks.patch) |
| [S04](requests/S04-lint-tooling.md) | lint·format·도구 구성 | 추가 거버넌스 설정·스크립트·캐시 폐기. 별도 유지 구현은 진행하지 않음 | [폐기 목록](../archive/2026-09-26-local-cleanup/manifest.json) |
| [S05](requests/S05-architecture.md) | 아키텍처 검사 보강 | 보강 브랜치 폐기. 기존 제품 작업본·추적 파일은 보존 | [보존 검증](../archive/2026-09-26-local-cleanup/verification.json) |
| [S06](requests/S06-mixed-cleanup.md) | 혼합 cleanup 변경 | 추가 선별·통합 중단. 원문 이력은 bundle에 보존 | [복원 안내](../archive/2026-09-26-s01-a-backup-145815/RESTORE.md) |
| [S07](requests/S07-migration-checksum.md) | migration checksum 호환 | 추가 구현 폐기. 기존 제품 migration·DB 변경 없음 | [폐기 결과](results/LOCAL-CLEANUP.md) |
| [S08](requests/S08-database-restore.md) | Core·Collector 복원 시험 | 추가 시험 구현 폐기. 기존 데이터·복구 증거 보존 | [폐기 결과](results/LOCAL-CLEANUP.md) |
| [S09](requests/S09-harness-policy-release.md) | Harness·task·브랜치·릴리스 정책 | 로컬 구현 폐기, 설계만 별도 원격 보관 | [전체 안내](../README.md), [폐기 결과](results/LOCAL-CLEANUP.md) |
| [S10](requests/S10-ci-integration.md) | CI·공유 설정·통합 검증 | 거버넌스 통합 중단. 기존 workflow 유지, CI 재실행 없음 | [폐기 결과](results/LOCAL-CLEANUP.md) |
| [S11](requests/S11-docs-closeout.md) | 문서 정리 | 이번 요청으로 문서 분류·탐색 링크 정리. 원래 S11 전체 감사의 완료를 뜻하지 않음 | [이번 변경 목록](../archive/2026-09-26-document-layout/manifest.json) |

## 요청과 결과의 위치

- **`requests/`**: 이전 요청서 11개, 당시 전체 계획, 결과 양식, 담당·순서 JSON. 취소·폐기 전 문맥을 확인할 때 읽는다.
- **`results/`**: S01~S03의 실제 실행 결과, 제품 후보·fixture·hook 검증 자료, 최종 로컬 폐기 결과. 수행하지 않은 S04~S11의 결과 파일은 만들지 않는다.
- **`../archive/`**: 초기 구현 기록, 전체 조사, 취소 계획, 복구 백업, 폐기 목록과 문서 이동 기록.

기존 IDE 북마크가 이 파일을 가리켜도 현재 상태부터 확인할 수 있도록 안내 경로를 유지했다.
과거 요청서와 JSON의 실행 시점 경로·SHA는 현재 경로로 소급 수정하지 않았다. 실제 이동 목록은 전체 안내에 연결했다.
