# S02 보존·브라우저 후보 증거

- 실행일: 2026-09-26 KST.
- 결과: [S02-RESULT.md](../S02-RESULT.md).
- 후보 위치: `/Users/zeaha/task_list/20260926-blariyo-s02-product-preservation`.
- 후보 기준: PR #4 `df7482704c7867712c12028d1a69e59bfd662acc`, detached HEAD. 기존 저장소와 Git 설정·refs를 공유하지 않는 독립 저장소다.
- 실제 후보 변경: `tests/browser/admin-recovery.test.ts` 선택자 2줄. 앱 source·package·workflow·원문 fixture는 변경하지 않았다.

## 보존 산출물

| 자료 | 용도 |
| --- | --- |
| [inputs.json](inputs.json) | S02 시작 전 6개 worktree HEAD·branch·기존 dirty 파일 hash·refs |
| [inputs-s01-delta.json](inputs-s01-delta.json) | S01 이후 추가된 산출물 14개·Codex 보조 ref 1개와 기존 HEAD/ref 값 불변 |
| [commits.json](commits.json) | 기존 8개 commit의 SHA·제목·경로, 제품 관련 7개/governance 설계 1개 구분 |
| [PRODUCT-PROTECTION.md](PRODUCT-PROTECTION.md) / [product-paths.json](product-paths.json) | 제품 70개 경로, 기존/제품/현재 기본/PR #4/delivery blob과 SHA-256·중첩 issue·유지 내용 |
| [product-preservation.patch](product-preservation.patch) | `8af7244` → `e51f1b5` 중 제품 70개 경로만 분리한 보존 patch; governance 설계 2개 제외 |
| [product-patch-verification.json](product-patch-verification.json) | 독립 저장소의 임시 index에 patch 적용 후 70개 blob이 제품 보존본과 일치함을 검증 |
| [FIXTURE-PROTECTION.md](FIXTURE-PROTECTION.md) / [fixtures-provenance.json](fixtures-provenance.json) | HTML 49개, 출처/정제 이력 파일 42개, 각 버전 hash와 S01 보관 위치 |
| [handoff.json](handoff.json) | S06/S10/S11 인계와 보호 경로 162개. 삭제 허용 목록이 아님 |
| [preservation-verification.json](preservation-verification.json) | 보존 수량·일치·checksum 요약 |

제품 보존 patch는 기존 `8af7244`에 대한 복구·검토 자료다. S10의 새 통합 기준에 그대로 재적용할 수 있다고 가정하지 않는다. 후보 PR #4에는 제품 70개 경로가 이미 포함되어 있으며, 69개는 `e51f1b5`와 byte가 같고 나머지 `admin-workflow.test.ts`는 PR #3의 대기 1줄이 추가된 상태다.

## 브라우저 변경과 검증

- [browser-selector.patch](browser-selector.patch): 후보에 적용한 유일한 변경. `.admin-sidebar-bottom`의 `공개 사이트 보기` 링크를 선택한다.
- [browser-pr3-preserved.patch](browser-pr3-preserved.patch): PR #3의 이미지 재조회 대기 1줄이 후보에 이미 포함됐음을 보여 주는 비교 자료. 다시 적용하지 않았다.
- [remote-readback.json](remote-readback.json): PR #3/#4/#6의 실행 시점 state·base/head; 이전 inventory와 동일. PR 수정·CI 실행은 하지 않았다.
- [checks.json](checks.json): build·API test build·test typecheck·lint 성공.
- [browser-verification.json](browser-verification.json): 관련 browser test 2개 파일 실행 성공, 전용 PostgreSQL/Playwright 컨테이너 및 정리 결과.
- [browser-workflow.json](browser-workflow.json): 12개 합성 게시물의 반복 업무·DB/media readback, browser error 0, 실제 launcher worker 검증. 운영자 인수는 미실행이다.
- [screenshots.json](screenshots.json): 캡처 6개 SHA-256. [desktop](screenshots/editor-1280.png), [mobile](screenshots/editor-320.png)을 직접 시각 확인했다.
- [final-verification.json](final-verification.json): 기존 작업 불변, 후보 diff 한정, 링크/공백, 산출물 hash와 테스트 요약.
- [SHA256SUMS](SHA256SUMS): 자신을 제외한 이 디렉터리 파일의 SHA-256. 결과 문서 `../S02-RESULT.md`는 별도다.

```sh
cd /Users/zeaha/task_list/20260926-blariyo-s02-product-preservation
export PATH="/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH"
npm run build
npm run build:test -w @blariyo/api
npm run typecheck:tests
npm run lint:tests
# 관련 브라우저 검증은 전용 loopback PostgreSQL :55449 및 Playwright :55450에서 실행했다.
# 실행 환경 구성·정리 명령은 logs/blariyo-s02-browser-check.py에 보존했다.
```

실행 로그·보조 스크립트는 Git ignore된 `logs/`에 보관했다. `logs/s01-checksums.log`는 S01 archive 500개 파일 재검증 결과다. 보존 patch·메타데이터·캡처가 실제 source·운영 정책의 새 정본을 대신하지 않는다.
