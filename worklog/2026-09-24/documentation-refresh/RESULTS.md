# 운영 문서 최신화 실행 결과 — 2026-09-24

## 판정과 기준선

- **문서 최신화 TASK-01~07 완료. M0 제품·운영자 인수는 부분 완료 상태를 유지한다.** 9월 23일 운영 관측을 현행 문서에 반영했고, 9월 24일에는 원격 서버·DB·CI·Cloudflare/AWS를 재조회하지 않았다.
- 기준 운영 증거: [SHA `5c581c2` CI·API/Web 배포](../../2026-09-23/release/production-deployment-5c581c2.md), [API V008·Collector V006 및 콘텐츠 반영](../../2026-09-23/release/production-db-promotion.md). 당시 최종 공개 응답 검증은 9월 23일 22:54:49 KST다. 마지막 관측 구성은 [운영 상태](../../../docs/operations/current-status.md)를 따르며 실시간 값은 별도 재조회가 필요하다.
- **계획 기록 당시** HEAD `82c0ba9`, 로컬 `main...origin/main [ahead 5]`, 작업 트리 clean이었다([당시 검증](VALIDATION.md)). **실행 시작 시** 계획 폴더와 `worklog/README.md`는 이미 미커밋 사용자 변경이었다. 이를 보존한 채 현행 문서를 수정했다. 원격 추적 참조는 실제 원격 재조회 증거가 아니다.
- GPT-6 Sol 하위 모델 3명이 TASK-01~06 범위를 나누어 조사·편집했고, root가 근거와 변경을 직접 검수·정정했다. TASK-07은 전체 문서·링크·Git 범위를 통합 검증했다.

## 변경 범위

현행 안내 13개 문서를 수정했다. `README.md`; `docs/status.md`, `docs/roadmap.md`, `docs/development-specs/requirements-status.md`; `docs/operations/current-status.md`, `deployment-policy.md`, `deployment-runbook.md`, `security-protection-status.md`, `owner-setup-checklist.md`; `docs/system-design/05-security-operations.md`; `docs/testing/operator-acceptance.md`; `deploy/application/README.md`, `deploy/postgresql/README.md`다. 기존 전체 색인 `worklog/README.md`를 갱신했다. 실행 시작 전에 있던 계획 Markdown 10개는 보존·갱신하고 `EVIDENCE.md`·`RESULTS.md` 2개를 추가했다. Git HEAD 대비 9월 24일 작업 기록 Markdown 12개는 모두 미추적 상태다. 기존 9월 23일 이전 worklog 원본과 앱 source·migration·설정은 수정하지 않았다.

- 운영 상태: `5c581c2` 원격 CI·GHCR digest 기반 API/Web 배포, DB V008/Collector V006, 공개 게시글 74·이미지 308·수집 항목 108은 **9월 23일 관측값**으로 기록했다. batch 검수 API/Web flag ON과 URL·Discord 접수·자동 수집 OFF를 구분했다.
- 배포·복구: 최초 설치 V005 절차와 현재 V008 운영을 구분했다. V008에서 9월 20일 구 API의 readiness 503을 반영하고, 앱만 복귀할 때 V008 호환 `5c581c2` Core release를 기준으로 정리했다. 다음 배포의 최근 18시간 이내 백업·복원, ledger·checksum·후보 SHA별 CI/digest·실제 복귀 경로 확인을 유지했다.
- 보안·인수: 앱 원본 JSON 오류의 9월 20일 로컬 완료·배포 대기 기록은 보존하고, 9월 23일 Web 직접·공개 HTML/JSON 404 `no-store` 확인을 후속 결과로 연결했다. 기존 Cloudflare 9개 캐시 규칙의 새 자산 미포함, AWS 예산/MFA·알림 수신·정상 이용자/공유 IP·구 탭 검증 잔여를 유지했다. 로컬 sandbox 수집 OFF와 운영 batch 검수 ON을 분리하고, 운영자 수동 12건은 전부 미실행으로 남겼다.
- 경계 정정: 근거표의 수정 전 행 번호, C15의 검증 시점·증거 범위, 로컬 12건과 실제 MFA 운영 인수의 혼합 표현, 18시간 백업 기준, `FIX-RESULTS` 근거 링크, 운영 이미지 주소 `media.blariyo.com`의 오래된 `(미정)` 표기를 검수 중 바로잡았다. direct raw/media/report/queue 보존·파기·고지(QD-04), Web 입력/source 소유권(QD-03), 실제 실행 PC/시험 자원은 임의 확정하지 않았다.

## 검증과 한계

- [근거·불일치 표](EVIDENCE.md)의 원문·source·9월 23일 실행 기록을 대조했고, 변경 문서의 release·DB 버전·기능 flag·복귀 기준·검증 시각이 일치한다. 과거 `배포 대기`·`V005`·`공개 글 없음`·`수집 OFF`는 당시 기록 또는 신규 설정/sandbox 조건일 때 날짜와 범위를 명시했다.
- [요구사항 대조표](../../../docs/development-specs/requirements-status.md)는 C01~C16, A01~A08, B01~B08, O01~O08의 40개 고유 ID다. 구현 집계 **I30/P9/U1**, I 30/40 = 75%는 [전체 상태](../../../docs/status.md)와 같다. 이는 기능 묶음의 주요 구현 확인 비율이며 출시 준비율이 아니다.
- [제품 기획](../../../docs/planning/01-service-plan.md), [수집 기획](../../../docs/planning/content-collection/README.md), [법무 차단 조건](../../../docs/legal/README.md), 관련 system-design과 대조했다. direct 보존·고지와 출처별 활성화 gate는 미해결이며, 검수 flag ON은 실제 MFA 인수나 법무 승인 증거가 아니다.
- `git diff --name-only -- '*.md'`로 추적 문서 14개와 9월 24일 신설 Markdown 12개를 모아 Python `pathlib`·정규식으로 상대 파일 링크와 제목 앵커를 검사했다. `rg -n`으로 배포 대기·V005·공개 글 없음·수집 OFF의 남은 위치를 확인했고, 요구사항 행과 인수표는 별도 Python 집계로 재계산했다. 링크 검사는 대상·앵커 존재 증거이며 문서 내용의 정확성을 대신하지 않는다. 설치·발행·DB 변경 명령, 전체 앱 build/test, 브라우저 인수, 원격 CI/서버/DB 재조회는 실행하지 않았다.

| 검사 | 결과 |
| --- | --- |
| 변경·신설 Markdown 26개의 상대 파일 링크 | 464개 검사, 대상 누락 0 |
| 변경·신설 Markdown의 제목 앵커 | 참조 19개 검사, 누락 0. 보안 §9의 기존 제목·인바운드 앵커 유지 |
| 기존 문서에서 변경 문서로 들어오는 앵커 | 18개 검사, 누락 0 |
| 요구사항 ID/구현 집계 | 40개 고유 ID, I30/P9/U1, 30/40=75% |
| 운영자 수동 인수표 | 12행 모두 미실행 |
| `git diff --check`·`git status --short --branch` | diff 오류 0. `main...origin/main [ahead 5]`, 현행 Markdown 13개와 기존 `worklog/README.md` 수정, 9월 24일 작업 기록 폴더 untracked. 원격 재조회 아님 |
| 앱 build/test·원격 CI·서버/DB/콘솔 재조회 | 미실행 |
| commit·push·배포·DB mutation·외부 설정 변경 | 미실행 |

## 인계

1. 운영 담당이 현재 release·DB ledger/권한·기능 flag·백업/timer·공개 응답을 읽기 전용으로 재조회한다. 9월 23일 수량과 백업을 현재값으로 재사용하지 않는다.
2. 운영자는 격리 sandbox에서 수동 12건을 수행하고, 별도 실제 Access MFA 세션에서 작성·업로드·발행·예약·숨김 및 batch 검수를 인수한다. 운영 콘텐츠와 비밀 입력은 승인된 운영 경로에서만 다룬다.
3. QD-03/04, 실행 PC/OS·비운영 DB/object·Discord 시험 대상과 출처별 허용 범위를 결정한 뒤 수집 기능을 개별 검증한다. direct 보존·고지 조건과 실제 운영자 인수가 끝나기 전에는 기능 완료로 표시하지 않는다.
4. 다음 배포가 필요하면 [배포 정책](../../../docs/operations/deployment-policy.md)과 [실행서](../../../docs/operations/deployment-runbook.md)의 SHA별 CI/digest, V008 호환성, 최근 18시간 이내 백업·복원 및 복귀 기준을 다시 적용한다.

## 1차 재검토 보완 결과

- 요청: 2026-09-24 재검토 발견 C1-1·A1-2 모두 보완. 위 최초 실행 결과와 검증 수치는 당시 기록으로 보존한다.
- C1-1: [현행 설계 준비 상태](../../../docs/system-design/design-readiness.md)에 M0의 최신 구현·운영 근거를 반영했다. 자동 수집 I6/P1/U1과 17출처 로컬 검증/4출처 차단을 연결하고, 비활성·direct 보존/고지·실제 운영 인수 잔여를 유지했다. Core의 입력/공개 기록과 남은 운영 검증을 구분하고, 수집 보조의 legacy/direct 및 입력 연결 미완료를 반영했다. M1·M1.5 설계 판정은 9월 9일 기준으로 유지했다.
- A1-2: [배포 실행서](../../../docs/operations/deployment-runbook.md)의 기본 검사 → 부팅 경로 갱신 → timer 재개 → 캐시 대조 → 최종 검사 순서를 명시했다. 기본 검사와 최종 성공 기준을 분리해 선행 조건의 순환을 제거했다. 실제 MFA 업무 인수·오류 캐시 금지·복귀 시 helper/timer 확인 조건을 유지했다.
- 이번 보완 변경: 위 현행 문서 2개와 README·TASK-03·TASK-06·TASK-07·이 RESULTS의 5개 기록, 총 7개 Markdown. 최초 최신화 대비 현행 문서가 13개에서 14개로 늘었으며 신설 문서는 없다.
- 검증은 아래와 같다. 문서 정적 검증이며 앱 build/test·운영 배포·서버/DB/외부 콘솔 재조회·commit·push는 실행하지 않았다.

| 보완 후 검사 | 결과 |
| --- | --- |
| 전체 최신화 범위 Markdown | 27개, 상대 파일 링크 492개 검사, 누락 0 |
| 제목 앵커 | 변경 문서 내 참조 30개·기존 문서의 유입 참조 25개, 누락 0 |
| 과거 기록의 행 번호 참조 | 1개, 대상 파일의 행 범위 확인. 과거 worklog 원문 보존 |
| 요구사항·수동 인수 | 고유 ID 40개, I30/P9/U1; 자동 수집 I6/P1/U1; 수동 인수 12행 모두 미실행 유지 |
| 설계·활성화 조건 | M1·M1.5·GA4/광고/제휴 행은 HEAD와 동일. direct 보존/고지·출처별 활성화·실제 인수 잔여 유지 |
| 배포 선후 관계 | 5단계 교체 → 기본 검사 → 6단계 helper 갱신 → 7단계 timer 재개 → 8단계 캐시 대조 → 9단계 최종 검사. 실패 시 복귀 및 helper/timer 확인 경로 정적 대조 |
| 기존 변경 보존 | 보완 시작 시 파일 1,157개의 SHA-256과 대조해 위 7개 Markdown만 추가 변경, 삭제·신설 없음. 앱 source·migration·설정 및 범위 밖 문서 불변 |
| Git | `git diff --check` 통과. 기존 수정 14개에 design-readiness.md 1개 추가; 9월 24일 worklog 폴더는 기존 untracked 상태 유지 |

판정: C1-1·A1-2 보완 완료. 문서 최신화의 두 발견을 해소했으며 제품·운영 수용 완료 판정은 올리지 않았다.
