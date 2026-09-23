# 현재 변경의 분할 커밋 계획

2026-09-23 사용자 요청: 후속 작업 문서 저장과 현재 변경의 기능별 커밋.
후속 작업은 [수집 후속 작업](../../../../../docs/implementation/m0-interim-2026-09-23/collector-follow-up.md)에 저장했다.
기존 `d22dd96` 커밋은 보존한다. push와 배포는 요청 범위에 없다.

## 실행 상태

- 시작 시 `main...origin/main [ahead 1]`, 기존 staged 파일은 0개였다.
- Collector 묶음 140개 파일의 첫 staging은 성공했다.
- 이후 정제 fixture의 LF·공백 정규화와 해시 갱신을 재반영하려는 `git add`가
  `.git/index.lock: Operation not permitted`로 실패했다. 새 커밋은 생성하지 않았다.
- **현재 index에는 정규화 이전 fixture가 있다. 아래 1번의 add부터 다시 실행해야 한다.**
  작업 파일은 보존되어 있다. 권한 제한을 우회하거나 reset하지 않았다.
- 권한이 있는 사용자 터미널에서 현재 변경을 확인한 후 아래 순서로 실행한다.
  다른 작업의 새 변경이 추가됐다면 각 `git diff --cached --stat`에서 범위를 다시 확인한다.

## 커밋 구성

| 순서 | 메시지 | 범위 |
| --- | --- | --- |
| 1 | `feat: 수집기 직접 저장 큐와 원문·미디어 수집 보강` | Collector queue/Discord intake, parser·미디어·저장, V003–V006, fixture, 출처 설정·회귀 |
| 2 | `feat: 수집 결과 검수와 게시글 초안 승격 구현` | API 검수·승격·private/public 이미지, V008, OpenAPI·계약·개발 명세·회귀 |
| 3 | `feat: 관리자 수집 검수 화면과 공개 미디어 표시 개선` | 관리자 batch 화면, 링크·이미지 렌더링, Web 중계·로컬 media route·테스트 |
| 4 | `chore: 환경별 설정과 DB 권한·로컬 검증 도구 정리` | 환경 예시 5개, DB role, 로컬 실행·복구·readback 도구, 실행 문서 |
| 5 | `docs: 수집 소유권과 사이트별 모듈 설계 정렬` | planning·데이터/API/Collector/코드 구조 설계, 사이트 검증 정책 |
| 6 | `docs: 수집 검증 결과와 M0 후속 작업 기록` | 출처별 report, worklog, M0 중간 점검·후속 계획·운영 상태 |

각 커밋은 의존 순서대로 적용하는 하나의 변경 묶음이다. 개별 중간 커밋을 checkout해 전체 시험한 것은 아니다.
실제 Discord/원격 S3 검증 완료를 커밋 제목에 주장하지 않는다.

## 사용자 터미널 실행 명령

저장소 루트에서 순서대로 실행한다. 각 커밋 전에 출력된 staged 범위를 확인하고,
`git diff --cached --check`가 실패하면 다음 커밋 명령을 실행하지 않는다.
실제 `.env`와 `.local-data`는 포함하지 않는다.

```sh
# 1. 기존 staged fixture를 현재 정규화된 파일로 갱신
git add -- apps/collector ':(exclude)apps/collector/ops/reports' scripts/content/reference-sites-config.test.mjs
git diff --cached --stat
git diff --cached --check
git commit -m 'feat: 수집기 직접 저장 큐와 원문·미디어 수집 보강'

# 2. API와 공유 계약
git add -- apps/api packages/contracts docs/development-specs docs/migration/contract-evolution.json tests/migration-contracts.test.ts
git diff --cached --stat
git diff --cached --check
git commit -m 'feat: 수집 결과 검수와 게시글 초안 승격 구현'

# 3. Web
git add -- apps/web
git diff --cached --stat
git diff --cached --check
git commit -m 'feat: 관리자 수집 검수 화면과 공개 미디어 표시 개선'

# 4. 환경과 실행 도구. 환경 예시는 명시한 파일만 추가한다.
git add -- .gitignore README.md package.json .env.example .env.local.example .env.dev.example .env.stage.example .env.prod.example deploy/postgresql scripts/local scripts/test-database-roles.ts scripts/test-collector-readback.mjs docs/implementation/operations/environment-configuration.md docs/migration/REPORT.md
git diff --cached --stat
git diff --cached --check
git commit -m 'chore: 환경별 설정과 DB 권한·로컬 검증 도구 정리'

# 5. 설계
git add -- docs/planning/content-collection docs/system-design/02-data-model.md docs/system-design/03-api-design.md docs/system-design/07-spring-collector-design.md docs/system-design/08-code-structure.md
git diff --cached --stat
git diff --cached --check
git commit -m 'docs: 수집 소유권과 사이트별 모듈 설계 정렬'

# 6. 검증 기록과 후속 계획
git add -- apps/collector/ops/reports docs/implementation/m0-interim-2026-09-23 docs/implementation/operations/current-status.md worklog/task-list/09/23/batch-고도화
git diff --cached --stat
git diff --cached --check
git commit -m 'docs: 수집 검증 결과와 M0 후속 작업 기록'

git diff --check
git status --short --branch
git log -7 --oneline
```

## 이번 정리에서 실행한 검증

- 정제 fixture 36개: LF·들여쓰기·줄 끝 공백 정규화, 정제본 SHA-256 재계산.
  원본 SHA-256과 목록/상세 parser 기대 구조는 유지했다. 생성기도 해시 계산 전에 같은 정규화를 적용한다.
- 기본 셸의 JDK 탐색은 25를 찾지 못해 최초 Gradle 실행이 실패했다.
  설치된 JDK 25를 명시한 아래 실행에서 source 테스트 **94/94, 실패 0, 생략 0**을 확인했다.
- source 설정·환경 예시 Node 테스트 **4/4 통과**.
- 새 후속 문서의 상대 링크와 작업 파일 whitespace 검사 통과.
- 기존 전체 Java 170개·DB 역할/복원·브라우저/readback 증거는 [수용 기준 감사](ACCEPTANCE-AUDIT.md)에 있다.
  이번에는 DB/원격 S3/Discord/브라우저 검증을 다시 실행하지 않았다.

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home ./apps/collector/gradlew -p apps/collector test --tests '*source.*'
node --test scripts/local/environment-config.test.mjs scripts/content/reference-sites-config.test.mjs
```

한 번에 커밋하기로 변경한다면 사용할 메시지: `feat: 수집 결과 검수·게시글 승격과 로컬 미디어 검증 체계 구축`.
다만 위 6개 분할안이 기능별 검토와 되돌리기에 적합하다.
