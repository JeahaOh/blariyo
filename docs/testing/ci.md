# CI 실행과 검증 기록

2026-10-04 사용자 요청: 검사 범위는 유지하면서 대기 시간을 줄이고 release PR와 main의 중복 검사를 제거한다.
실행 정본은 [ci.yml](../../.github/workflows/ci.yml), 판정 도구는 [validation.py](../../scripts/ci/validation.py)다.
이 문서와 source의 존재만으로 원격 적용·성능 개선 완료를 뜻하지 않는다.

## 실행 흐름

1. `plan`: PR 변경 경로 또는 main의 기존 PR 검증 기록을 확인한다.
2. `quality`: 계약·CI 판정 회귀, build, 타입·lint·unit 검사. Java/DB가 필요한 단계 앞에서 계약 오류를 찾는다.
3. 전체 검사 대상이면 `integration`, `browser`, `collector`를 quality와 병렬 실행한다. 각 job은 독립 runner와 PostgreSQL을 사용한다.
4. `verify`: 선택된 모든 검사 성공을 요구한다. 전체 검사에서 failed/cancelled/skipped/missing을 통과로 취급하지 않는다.
5. PR 전체 성공이면 검증 기록을 업로드한다. main의 성공 실행이면 API/Web image를 새 main SHA로 게시한다.

DB 통합에는 BFF·sitemap HTTP 검사도 있으므로 API/Web build와 Java parser fixture 준비가 모두 필요하다.
브라우저 job은 API/Web build만 준비하며 Java fixture를 사용하지 않는다. 실제 예약 시각 검사는 유지한다.
각 job 내부의 기존 파일 순차 실행은 유지하여 DB role·파일·포트 충돌을 피한다. 파일 단위 추가 병렬화는 별도 실측 후 결정한다.
API/Web Docker cache와 npm cache를 유지하고 Java job에 Gradle 의존성 cache를 추가한다.
Collector의 실제 테스트 강제 실행과 결과·skip 검사는 그대로다. schema restore는 기존 일일/수동 workflow에서 실행한다.

## main에서 무거운 검사 재사용

다음 조건을 모두 만족해야 `integration`·`browser`·`collector` 재실행을 생략한다.

- 이벤트는 main push이며 실제 main commit이 두 부모를 가진 merge commit이다.
- 해당 commit에 연결된 PR이 같은 저장소 release 또는 hotfix-* → main으로 병합됐다.
- 해당 PR head SHA의 동일 CI workflow가 completed/success이고, 선택한 실행 회차의 필수 job 5개가 전부 성공했다.
- `ci-verification-<run_id>-<attempt>` artifact가 유일하고 만료되지 않았으며 ZIP의 SHA-256이 GitHub 메타데이터와 일치한다.
- 기록의 run/회차/repository/workflow/PR/head/base/부모/tree가 실제 실행 및 main 후보와 모두 일치한다.

Git tree는 파일 경로·내용·실행 권한 등을 포함한다. main merge의 SHA는 PR 합성 merge SHA와 달라도 부모와 tree가 같을 수 있다.
부분 검사 결과나 head SHA만 같은 오래된 PR 결과는 재사용하지 않는다. 파일을 일부 제외한 tree 비교도 하지 않는다.
검증 기록은 성공 job에서 새 checkout을 읽어 생성하며, 다운로드된 JSON은 메모리에서 읽고 실행하거나 ZIP 경로로 추출하지 않는다.
GitHub API token은 signed artifact 다운로드 호스트로 전달하지 않는다.

main에서도 quality 검사는 수행한다. 원격 인증·artifact 보존·GitHub 실행 회차에 문제가 있으면 전체 검사로 돌아가며,
이 경로도 실패하면 이미지를 게시하지 않는다. PR 검사가 끝나기 전에 병합하거나 30일 보존 기간이 지났을 때도 같은 방식이다.
`workflow_dispatch`는 강제 전체 검사 경로다. main에서 수동 실행하면 전체 통과 후 이미지 게시 조건을 충족한다.

권한은 plan job의 `contents: read`, `actions: read`, `pull-requests: read`와 기존 images job의
`packages: write`다. 저장소 비밀 추가·원격 설정·PR 자동 병합은 필요 없다.

## 일반 문서 예외

main 이외 대상 PR에서 변경 파일이 모두 다음 목록에 해당할 때만 quality를 수행하고 무거운 검사를 생략한다.

- 루트 `README.md`
- `worklog/`, `docs/planning/`, `docs/legal/` 아래 `.md` 파일

빈 diff·알 수 없는 경로·실행 파일·명세·OpenAPI·공유 설정·lockfile·CI 변경은 전체 검사한다.
rename은 이전/이후 경로를 모두 판정하여 코드를 문서 경로로 옮기는 변경이 예외가 되지 않게 한다.
배포 후보인 main 대상 PR은 이 예외를 적용하지 않으며 문서만 바뀌어도 전체 검증 기록을 만든다.

## 로컬 검증과 원격 수용

```sh
npm run test:ci
npm test
actionlint .github/workflows/ci.yml
```

`test:ci`는 PR/main 동일성, 실패·누락·만료·재실행 회차·API 오류, 문서 예외와 전체 검사 fallback을 검증한다.
GitHub API는 테스트 대역으로 격리한다. 실제 토큰·원격 실행은 사용하지 않는다.

원격 적용 후 PR 전체 성공, 동일 main의 `plan` 요약에 원본 run 연결, 무거운 job skipped와 verify 성공,
새 main 이미지 게시를 각각 확인한다. 성공 기록이 없으면 전체 job이 실행되는지도 확인한다.
속도는 cache cold/warm·대기 시간을 구분해 여러 회 측정한다. 병렬화는 대기 시간을 줄이지만 총 runner 사용 시간을 늘릴 수 있다.
