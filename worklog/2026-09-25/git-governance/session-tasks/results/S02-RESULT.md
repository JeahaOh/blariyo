# S02 실행 결과 — 제품·원문 보존과 브라우저 회귀

- 세션/issue: S02 / GOV-27·GOV-30·GOV-32.
- 실행일: 2026-09-26 KST. 시작은 [inputs](S02-assets/inputs.json), 최종 검사는 [final-verification](S02-assets/final-verification.json)의 시각을 따른다.
- 사용자 지시: “s02 진행 해”; 후속 선택 “독립 작업본에 회귀 수정을 적용하고 관련 테스트까지 실행”.
- 결과 상태: **보존 목록·분리 patch 작성 완료 / 독립 후보 회귀 수정·로컬 검증 완료 / 원격 통합·운영 수용 미실행**.
- 기존 기본 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, `develop`, `8af72449a7d56c9701efd0d73dc7d430a66f9610`.
- 독립 후보: `/Users/zeaha/task_list/20260926-blariyo-s02-product-preservation`, detached HEAD `df7482704c7867712c12028d1a69e59bfd662acc` + 선택자 patch.
- 입력: [S02 요청서](../requests/S02-product-preservation.md), [S01 결과](S01-RESULT.md), [증거 전체](S02-assets/README.md).

## 1. 선택과 진척

| issue | 선택 | 이번 수행 | 남은 경계 |
| --- | --- | --- | --- |
| GOV-27 | 브라우저 회귀 수정 분리 유지 | PR #3 대기 수정이 후보에 포함됨을 확인; PR #6 선택자 2줄만 후보에 적용; 관련 브라우저 12/12 통과 | 기존 PR #4/#5 자체·develop·운영에는 미반영 |
| GOV-30 | 기존 제품 변경 보존 | 제품 관련 commit 7개·70개 경로와 governance 설계 commit 1개·2개 문서 구분; 제품 전용 patch와 blob 대조 | 제품의 최종 통합·배포·운영 수용은 별도 |
| GOV-32 | 기준 fixture와 provenance 유지; stash 변형 재사용 보류 | HTML 49개·provenance 42개 파일별 대조, S01의 두 버전 98개 readback 연결 | 변형본의 의미 동등성·재사용 미판정; stash 일괄 적용 금지 |

## 2. 입력과 보존

- S01 archive **500개 파일 checksum 재검증 통과**. 해당 archive를 수정하지 않았다.
- S01 snapshot 이후 S02 시작 전 차이: S01 산출물 14개가 미추적 목록에 추가됐고 Codex 보조 ref 1개가 추가되어 ref는 41→42개다. 기존 ref 값·작업본 HEAD 변경은 없다. [입력 차이](S02-assets/inputs-s01-delta.json)에 기록했다.
- 기존 worktree 6개를 그대로 보존하고, Git refs·설정을 공유하지 않는 새 저장소를 S01 bundle에서 만들었다.
- 실행 시 PR #3/#4/#6의 state·base/head는 이전 inventory와 같았다. PR #3만 병합 상태이며 PR #4/#6는 open이다. 이번 후보의 성공을 현재 원격 PR 성공으로 쓰지 않는다.
- 기존 8개 commit은 [commits.json](S02-assets/commits.json)에 전체 SHA·제목·변경 경로를 기록했다.
- governance 설계 전용 `21b8828d07e059fc93b23caf81d0ecf97957cb15`의 `docs/ai/git-workflow.md`, `docs/ai/harness-implementation-plan.md`는 제품 선택에서 제외했다. 파일·이력을 삭제하거나 재작성하지 않았다.
- 제품 경로 70개는 [제품 보호 표](S02-assets/PRODUCT-PROTECTION.md)와 [blob/hash 상세](S02-assets/product-paths.json)에 기록했다. GOV-30 파일 색인 70개와 정확히 일치한다.
- 후보의 69개 제품 파일은 기존 main `e51f1b5`와 byte가 같다. 나머지 `tests/browser/admin-workflow.test.ts`의 차이는 PR #3의 `aria-busy=false` 대기 1줄뿐이다.
- 제품 전용 patch를 독립 저장소의 임시 index에 적용해 **70개 blob 모두 보존본과 일치**함을 확인했다. 이 임시 검증은 제품을 원본 develop에 적용한 것이 아니다.

## 3. 실제 변경과 검증

실제 후보 diff는 다음 1개 파일의 2줄 교체다.

```diff
-          .getByRole('navigation', { name: '관리 메뉴' })
-          .getByRole('link', { name: '공개 목록' })
+          .locator('.admin-sidebar-bottom')
+          .getByRole('link', { name: '공개 사이트 보기' })
```

- 경로: `tests/browser/admin-recovery.test.ts:182`. 실제 UI의 공개 사이트 링크로 이동을 시도해 미저장 입력 보호를 검증한다.
- [후보 patch](S02-assets/browser-selector.patch) SHA-256: `1eb8725a5cba143c471cc0dd2c62fe9e381d05286443df60b503d5e426e3c357`.
- [제품 보존 patch](S02-assets/product-preservation.patch) SHA-256: `c1da1cd66035bb4206374f7973337656452ac060e6f8eddd5c6bb6c2f852aad7`.
- PR #3의 이미지 재조회 대기는 후보에 이미 있어 추가 수정하지 않았다. [해당 비교](S02-assets/browser-pr3-preserved.patch)를 별도 보관했다.
- 후보 앱 source·package/lock·workflow·SQL·fixture 변경 0개. 다른 작업본의 기존 변경도 유지했다.

| 검사 | 명령/환경 | 결과 |
| --- | --- | --- |
| 의존성 | Node 24.18.0, 독립 후보 `npm ci` | 통과 |
| 앱 build | `npm run build` | 통과 |
| API 시험용 build | `npm run build:test -w @blariyo/api` | 통과 |
| test 타입 검사 | `npm run typecheck:tests` | 통과 |
| test lint | `npm run lint:tests` | 통과 |
| 관련 browser | `node --test --test-reporter=tap --test-concurrency=1 tests/browser/admin-recovery.test.ts tests/browser/admin-workflow.test.ts` | **12 pass / 0 fail / 0 skip**, 약 28.7초 |
| 원문·출처 | 49개 기준본/변형본·현재 사본과 provenance hash 대조 | 기준본·현재 후보 49/49 일치; stash 변형본 0/49 일치 |
| 문서/상태 | 링크·공백·기존 변경 hash·refs·후보 diff·산출물 checksum | [최종 검사](S02-assets/final-verification.json) |

브라우저 증거:

- 응답/상세 조회 유실 후 401·403 복구, 중복 저장 방지, version conflict, 미저장 선택·이동·탭 종료 보호.
- 합성 게시물 12개 작성·수정·이미지·예약 취소·발행·숨김·재공개, DB/media readback.
- 실제 `start-development.mjs --sandbox --workers`의 반복 실행과 정상 종료. 기존 개발 DB를 사용하지 않고 전용 PostgreSQL `127.0.0.1:55449`의 무작위 fixture DB를 사용했다.
- 320/390/768/1280 layout·모바일 복귀·이미지 재시도 assertion, browser error 0. 캡처 6개 중 [desktop](S02-assets/screenshots/editor-1280.png)과 [mobile](S02-assets/screenshots/editor-320.png)을 직접 시각 확인했다.
- 전용 PostgreSQL·Playwright 컨테이너 2개를 이번 실행의 ID로 정리했다. 기존 컨테이너는 유지했다.
- 이번 실행 로그만 성공 근거로 사용했다. 취소된 T1 로그·과거 PR CI 성공은 승계하지 않았다.

## 4. 원문 의미와 미완료 경계

- [HTML 보호 표](S02-assets/FIXTURE-PROTECTION.md), [provenance 상세](S02-assets/fixtures-provenance.json): HTML 49개 + 대응 출처/정제 기록 42개.
- 여기서 기준 원문은 **stash 변형 이전의 저장소 fixture**다. provenance의 `redacted`/`transformation`에 따라 개인정보·본문·미디어 URL 등이 정제된 테스트 자료이며, 수집 당시의 비공개 전체 HTML 자체와 다르다.
- S01은 기준 fixture와 stash 변형본 98개를 보관했다. 이번에는 그 bytes를 대조했으며 `rawSha256`가 가리키는 비공개 전체 HTML의 실물 readback·외부 재수집은 수행하지 않았다.
- 발견: `apps/collector/src/test/resources/sites/fixture-provenance.json:1` 및 각 sidecar에 선언된 fixture checksum은 기준본과 일치하지만 **stash 변형본 49개 모두와 불일치**한다. 의미 손상을 판정한 것은 아니며, 변형본을 검증된 동등 포맷으로 취급할 수 없다는 뜻이다. S06은 기준본/provenance를 함께 보호하고 변형본 재사용 시 별도 내용·parser·checksum 검토를 수행한다.
- HTML·parser를 수정하지 않아 Collector 전체 시험은 새로 실행하지 않았다.
- GA4/GTM: source/계약·과거 기록을 보존했다. 운영 flag·동의 전후/철회 요청·GTM 중복 태그·GA4 DebugView·공개 고지/계약 수용은 이번에 검증하지 않았다.
- 관리자/수집: 로컬 합성 인증·격리 DB/media 검증이다. 운영 Access/MFA·실제 운영자 인수·원격 object·수집 출처 접근 성공은 별도다.
- 미실행: 원본 제품 적용, 원래 이력 변경, commit/push/merge, PR/원격 보호 변경, CI 실행, 실제 개발/운영 DB 변경, 배포, stash 재적용·삭제, S01-B.

## 5. 다음 담당 인계

- **S06:** [handoff.json](S02-assets/handoff.json)의 보호 경로 **162개**를 먼저 반영한다. 구성은 제품 70개 + HTML 49개 + provenance 42개 + 추가 browser 파일 1개다. 원문 byte와 제품 변경을 보호하되 필요한 포맷 수정을 일괄 금지하지 않는다. 같은 hunk는 조정 후 처리한다.
- **S10:** 검증된 [선택자 patch](S02-assets/browser-selector.patch)를 실제 최종 기준 SHA에 맞춰 통합한다. package/workflow 변경 요청은 없다. PR #3 대기를 이미 포함한 후보이므로 중복 적용하지 않는다. 제품 보존 patch는 `8af7244`용 복구 자료다.
- **S11:** 실제 통합 결과만 활성 문서에 반영한다. 이번 로컬 성공을 GA4·운영 인증·배포 완료로 올리지 않는다. governance 설계 2개는 별도 선택 대상이다.
- 독립 후보는 diff와 검증을 확인할 수 있도록 남겼다. 원래 worktree 6개를 정리 가능으로 판정하지 않았다.
- S03~S11·S01-B·취소된 T1은 자동 시작하지 않았다.
