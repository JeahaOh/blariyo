# 문서·기록 디렉터리 재구성 — 2026-09-23

- 범위: 사용자 승인 AS-IS→TO-BE의 1차 문서·작업 기록 재구성. 앱·실행 스크립트 재배치는 후속 범위다.
- 시작 HEAD: `5c581c2ad82a9f1565ac53349fbaae7afed9c9cd`, clean, main과 origin/main 추적 참조 일치.
- 이동표: [기존 경로 → 새 경로](path-mapping.json). 197개 파일을 이동했으며 기존 경로는 대응표로 찾는다.
- 새 진입점: [문서 안내](../../../docs/README.md), [현재 상태](../../../docs/status.md), [로드맵](../../../docs/roadmap.md), [작업 기록](../../README.md).

## 변경

- 현재 상태와 앞으로 할 일은 날짜가 없는 docs 진입점에서 관리한다. 세 계획서는 roadmap으로 모으고 원문은 당시 worklog에 보존했다.
- 작업/세션/AI 인계와 과거 기준선을 `worklog/YYYY-MM-DD/작업명`으로 모았다. 월·일 경로의 연도는 본문 날짜와 Git 이력을 대조했다.
- 운영·검증 문서는 docs/operations·testing으로, 정적 화면은 docs/ui/publishing·wireframes로 이동했다.
- Nest 전환 결정은 기술 규칙을 담고 있어 docs/system-design에 두었다. 전환 계획·보고·진행 기록은 worklog에 보관했다.
- OpenAPI 정본·생성 타입·DB migration·검사 입력 contract JSON은 기존 경로와 내용을 유지했다.
- 현재 안내 문서의 링크·경로와 AGENTS/Gemini/AI 안내를 갱신했다. 전역 skill 복사본은 변경하지 않았다.
- 과거 보고서의 본문·숫자·당시 경로·미완료 항목은 보존하고 실제 링크만 수정했다.
- 미완료 legacy 전환 조건은 roadmap의 보존 절에서 추적한다. 디렉터리 이동을 구현/인수/배포 완료로 표시하지 않는다.

## 검증

| 검사 | 결과 |
| --- | --- |
| 이동표 대조 | 197개 모두 새 경로 존재, 이전 파일 경로 잔존 0 |
| 과거 Markdown 본문 보존 | 이동 기록 117개, 링크 목적지를 제외한 본문 변경 0 |
| 이동 자산 보존 | Markdown·HTML·CSS 외 파일의 byte 변경 0 |
| 상대 링크·anchor 대조 | 정리로 생긴 오류 0; 기존 5개 중 1개 수정, 기존 오류 4개 보존 |
| 계약 생성 | Node 24에서 `node scripts/generate-contracts.ts` 성공; 생성 코드 변경 없음 |
| 루트 검사 | Node 24에서 `node --test tests/*.test.ts`: 29 통과, 실패·생략 0 |
| 정적 화면 | 이동한 HTML 8개 HTTP 200; 로컬 자산 요청 오류·JavaScript 오류 0 |
| 정책 화면 전환 | terms/privacy/cookies 3개 hash 경로에서 해당 제목 표시 확인 |
| 화면 육안 점검 | publishing 화면 1280px·320px 캡처 확인 |
| 개인정보처리방침 | `docs/legal/privacy-policy.md` 원본 byte 일치 |
| 변경 형식 | `git diff --check` 통과 |

- 정적 브라우저 검사는 로컬 임시 HTTP 서버에서 수행했다. 외부 요청은 차단했으며 외부 연동·실제 앱 실행·서버 배포를 검증한 결과가 아니다.
- 붙여 넣은 코드·대화 링크가 포함된 `codex-session-*` 원문은 탐색용 문서 링크 검사에서 제외하고 원본 byte를 보존했다.
- 기존 링크 오류 4개: 과거 인계 기록의 삭제된 Express `apps/api/src/collection.mjs` 참조 1개, `docs/legal/m0-core/draft-2/terms.html`의 rights/cookies 2개, 같은 폴더 `privacy.html`의 cookies 1개. 이력·법무 초안의 별도 보완 항목이며 이번 경로 이동에서 발생한 오류는 아니다.
- 최종 점검 도중 `deploy/operations/start-application.py`의 release 경로 변경을 발견했다. 이번 문서 정리에서 작성한 변경이 아니므로 그대로 보존했다. 이 파일의 배포 동작은 이번 검증 대상에 포함하지 않았다.
- 검사 상세는 `validation.json`에, 브라우저 원본·화면 캡처는 아래 로컬 백업 경로에 보관했다.

## 보존과 범위

- 원본 1,119개 tracked 파일의 archive·SHA-256과 이동표·검증 원본은 Git 제외 `.local-data/directory-reorganization/20260923T132931Z/`에 보존했다.
- 파일 이동 후 빈 디렉터리만 정리했다. 사용자 runtime/DB/object·node_modules·test-results·비공개 설정은 이동하지 않았다.
- 과거 계획의 인수·보존·외부 연동 조건을 삭제하지 않았고 제품·법무 사실을 새로 결정하지 않았다.
- 2차 scripts 용도별 재배치, legacy Python의 최종 정리와 앱 내부 변경은 수행하지 않았다.
- 디렉터리 정리 완료 시점에는 미커밋 상태였으며, 후속 사용자 요청 `커밋 해`에 따라 문서 정리 변경을 별도 커밋한다. 별도 배포 작업의 `deploy/operations/start-application.py`와 `worklog/2026-09-23/release/production-deployment-5c581c2.md`는 제외한다. push·배포는 수행하지 않는다.
