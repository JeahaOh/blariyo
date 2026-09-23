# M0 진행 보관·로컬 커밋 기록 — 2026-09-23

## 요청과 현재 판정

- 사용자 요청: docs/worklog 갱신, 현재 진행 상태 보관, 현재 변경 커밋.
- **로컬 변경 저장 완료. M0 전체는 부분 완료이며 운영자 인수·원격 검증·계약 입력 대기 상태다.**
- 현재 상태 정본: [현재 진행 상황](../../../../docs/implementation/m0-interim-2026-09-23/current-progress.md).
  작업 순서와 완료 기준: [잔여 과정](../../../../docs/implementation/m0-interim-2026-09-23/remaining-process.md).
- push·merge·서버 전송·배포·실제 콘텐츠 공개는 수행하지 않았다. 기존 목표의 blocked 사유는 커밋만으로 해소되지 않는다.

## Git 범위와 보존

- 시작 HEAD: `8cda23e3e3681c9c8fcc777e189496b337c09e17`, `main...origin/main [ahead 1]`.
- 시작 개별 변경 파일 182개를 전수 분류했다. staged 변경은 없었다.
- 변경 원본·삭제 경로·파일별 SHA-256·tracked binary diff를
  `.local-data/commit-preparation/20260923T130729Z/`에 보존했다. 이 사본은 Git 제외이며 소스 원본을 이동하지 않았다.
- 구현 155개 경로를 아래 6개 커밋으로 저장했다. 새 현황/이 기록을 포함한 문서 29개는 후속 문서 커밋으로 저장한다.
- 각 커밋에서 지정한 pathspec, staged 목록, 실제 commit 경로가 일치하는지 검사했다.
  기존 커밋을 amend/reset/rebase하지 않았고, `git add .`로 무관한 파일을 일괄 포함하지 않았다.
- 아래 파일 수는 rename 전후 경로를 따로 세는 `--no-renames` 기준이다. Git 기본 통계의 rename 파일 수와 다를 수 있다.

## 기능별 커밋

| 순서 | commit | 범위 | 경로 수 |
| --- | --- | --- | ---: |
| 1 | `aa54e78e98bcbe9e7ae95904ca64966072d4f679` | refactor(collector): 출처별 adapter와 parser 모듈 분리 | 121 |
| 2 | `6bfe59e7a74a4d2d6ac0f2ff64b70e416501bea0` | ci: Java fixture 준비와 Collector 전체 검증 추가 | 6 |
| 3 | `9d0267b09c0f9b44e0849b8cf3d80e947782f3da` | feat(api): batch 검수 목록의 수집·검수 상태 필터 지원 | 10 |
| 4 | `8251e6b7c9b66ca579ff0bf1040900a57776fc16` | feat(local): 격리 인수 환경과 Core worker 실행 지원 | 6 |
| 5 | `1460f1202dfc052aefaa4809110da06151a7ea59` | feat(web): 관리자 검수 탐색과 불확실 저장 복구 보강 | 8 |
| 6 | `630a33fa3a7da03b281a75c3d05c5cd44e58e369` | test(deploy): Core 후보와 이전 이미지의 DB 호환 검증 | 4 |
| 7 | 이 기록을 포함한 `docs: M0 진행 현황과 검증·재개 기록 보관` 커밋 | 기획/기술 정합성, 실행서, 결과 보고서, 현재 진행·인수/배포 후보 및 재개 입력 | 29 |

문서 커밋의 자기 SHA는 본문에 순환 기록하지 않는다. `git log -1 --format=fuller -- worklog/task-list/09/23/progress-checkpoint.md`로
해당 커밋을 찾고 위 구현 6개 커밋의 후속인지 확인한다. 7개는 로컬 저장 단위이며 각각의 운영 승인이나 독립 배포 단위는 아니다.

## 문서 갱신

- [현재 진행 상황](../../../../docs/implementation/m0-interim-2026-09-23/current-progress.md)에 단계별 완료/미검증, 기존 증거, 재개 순서, 비공개 자원 경로를 한곳에 보관했다.
- 잔여 과정·다음 계획·감사 README·오늘 목차가 새 현황을 가리키게 했다. 과거 보고서의 당시 수치·미커밋 진술은 소급 수정하지 않았다.
- 요구사항 C09의 검색/목록·게시판/수정일·빈 결과/재시도 구현을 현재 source와 후속 결과로 확인해 I로 정정했다.
  C16은 최소 UI의 로컬 검증과 실제 반복 업무 인수를 구분해 P로 유지했다. 전체 집계는 **I30/P9/U1, 총40개**다.
- P0-05는 로컬 후보 준비 완료/운영 배포 미실행으로 명시했다. 이미지 생성 당시 HEAD·dirty snapshot은 과거 식별 정보로 보존했다.
- 개인정보처리방침 본문·미정 보관 기간·출시 조건을 임의 변경하지 않았다.

## 이번 실행의 검증

- Node `24.18.0`에서 `node --test tests/*.test.ts`: **29/29 통과**, 실패·취소·생략0.
  앞선 UI 보고서의 28/29 뒤 계약 검사 1/1 재실행과 별개로 이번에는 루트 전체 묶음을 실행했다.
- 구현 원본 155개 경로의 내용/삭제 상태는 커밋 전 백업과 동일하다. 소스·테스트·schema를 커밋 과정에서 추가 수정하지 않았다.
- 알려진 private key/GitHub token/AWS access-key 형식 검사의 검출0. 비공개 설정·로그·runtime·image archive는 stage 대상에서 제외했다.
- 문서29개·상대 링크628개 검사에서 누락0, whitespace/`git diff --check` 통과. 요구사항40개 집계 I30/P9/U1을 확인했다.
- 현재 이미지 입력 SHA-256은 기존 후보의 `00630e561cb9ad1b9a1edc4c6cafad1626c6ef9ab1be91f3f78aab36936cdfa5`와 같다.
  개인정보처리방침 본문은 작업 시작 HEAD와 동일하다. 최종 Git/commit 경로 readback은 같은 로컬 검증 디렉터리에 남긴다.
- 기존 Java273·API15·브라우저27·Core 통합/worker·이미지 호환 결과는 연결된 원본 보고서의 당시 실행 증거다.
  이번 문서/커밋 작업에서 DB·브라우저·Docker·원격 CI를 다시 통과했다고 집계하지 않는다.
- 이번 로그/경로 manifest/commit 원문/검증 JSON은 위 Git 제외 commit-preparation 디렉터리에 보관한다.

## 남은 일과 재개 조건

1. 운영자 수동 인수 12건: 사람이 직접 수행해 혼동·시간·재작업·복구 결과를 기록한다.
2. 별도 push 요청 후 최종 SHA의 원격 CI·API/Web image 게시·digest 확인. 이미지 게시와 서버 배포는 구분한다.
3. 실제 서버 ledger·현재 설정·백업/복귀 경로 확인 후 별도 배포 요청 범위에서 운영 검증.
4. QD-03 Web 입력/source 정본·변경 권한과 QD-04 raw/media/report/queue 보관·회수 기준 결정.
5. 비운영 DB/object·Discord 시험 대상·별도 PC/Windows 실행 준비 후 실연동. 차단4개 출처는 허용 경로 확보 전 blocked 유지.
6. Core 운영 개시 후 실제 7일 관찰. 시간 전진 fixture로 완료 처리하지 않는다.
