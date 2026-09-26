# Git governance 최초 도입 절차

- 기준: `origin/develop` = `8af72449a7d56c9701efd0d73dc7d430a66f9610`.
- 원본 작업 폴더의 미추적 파일과 stash `c373dac4ad6584e663ad958d1c9d64767dc48605`를 보존하고 별도 worktree에서 준비한다.
- 범위: 정책·task 등록, harness·hook·quality 검사기, npm·CI 연결 및 회귀 테스트. SQL migration/checksum 변경, 전체 포맷 변경, local main의 다른 8개 commit은 포함하지 않는다.
- 상태: 원격 병합·필수 검사 보호·운영 배포 완료를 뜻하지 않는다. stash 문서의 과거 통과 수치는 이 분리된 브랜치에 승계하지 않는다.

## PR 순서

1. `feature/HARN-06-governance-registration` → `develop`: 정책, HARN-06·07 manifest, 설계 문서와 이 절차를 먼저 검토한다. 이 PR은 검사기의 코드를 활성화하지 않는다. 현재 develop의 기존 CI를 따른다.
2. 등록 PR이 병합된 뒤 `feature/HARN-06-git-governance-bootstrap` → `develop`: harness·hook·검사기·CI 연결을 검토한다. 구현 브랜치는 등록 commit을 기반으로 한다. 첫 PR은 merge commit으로 반영해 등록 commit의 이력을 유지한다. 다른 방식으로 병합했다면 구현 브랜치를 새 develop 기준으로 재정렬하고 검증을 다시 실행한다.
3. 전체 lint 및 원격 CI의 실패·미검증 항목을 해결하고 필수 검사와 보호 규칙을 readback한 후 도입 완료를 판정한다. 준비 중인 구현 PR은 draft로 유지한다.

`ci-context`는 base SHA의 `.harness/policy.json`을 읽고, `task-range`는 base의 manifest로 변경 경로를 검사한다. 따라서 정책 등록과 검사기 활성화를 같은 최초 PR에 넣으면 아직 없는 base 정책 때문에 차단된다. 구현 PR에서는 정책/manifest를 수정하지 않는다. PR 자신이 task 허용 경로를 확장해 통과하도록 예외를 추가하지 않는다.

## 수정과 검증 범위

- 보호 브랜치에 실제로 새 commit을 보내는 직접 push는 차단한다. local/remote SHA가 같은 입력은 ref 변경이 없으므로 통과할 수 있다. 원격에 브랜치가 없을 때의 최초 생성 예외를 추가한 것은 아니다.
- Git의 실제 무변경 push가 ref 입력을 보내는지는 Git 동작과 별도로 확인한다. 같은 SHA의 합성 hook 입력이 통과했다는 사실을 원래 초기 생성 오류의 원인으로 단정하지 않는다.
- 복원한 npm script로 `test:harness`, `test:quality`, `lint:harness`, `test:architecture`를 실행한다. npm 문맥이 필요한 테스트를 `node --test`로 직접 실행한 결과와 구분한다.
- 전체 SQL·포맷 변경은 별도 보관되어 있으므로 이 브랜치의 `lint:all` 통과를 가정하지 않는다. 실패를 숨기는 baseline 승인이나 규칙 완화는 하지 않는다.
- 외부 원격을 사용하는 push 시험은 하지 않는다. hook의 허용·거절 회귀는 격리된 로컬 bare 저장소에서 확인한다. 실제 feature 브랜치 push는 검토할 commit을 게시하는 작업으로만 수행한다.

## 현재 원격 브랜치

- `develop`과 `release`가 존재하며 local tracking도 연결되어 있다. 원격 `main`과 같은 기준 SHA에서 시작했다.
- 사용자 생성 `release`는 기존 `release/<version>` 정책에 정의된 release 후보가 아니다. Git에서는 `release` ref와 `release/<version>` ref를 함께 만들 수 없으므로 실제 버전 release를 시작하기 전에 별도 이름 이관이 필요하다. 이 작업에서는 원격 브랜치를 삭제하거나 이름을 변경하지 않는다.
- branch 생성·tracking 연결은 원격 보호 규칙 활성화나 PR 승인 증거가 아니다.
