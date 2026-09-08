# Spring 수집 계약 정합성 보완 결과

- 작업일: 2026-09-08
- 상태: 문서 보완 완료 · 구현 미착수/미검증
- 입력: `../문서정합성/review.md`의 D05–D09, D12와 추가 확인 2건
- 범위: 수집 기능 명세와 `system-design/01~06`의 승인된 최소 수정
- 제외: 새 API·운영값·Job/Step·버전·저장소 결정, source 구현, commit, push

## 수정 전 스냅샷

담당 7개 파일의 수정 전 사본을 `/private/tmp/blariyo-collector-snapshot.OBYSLV`에 보존했다.
아래 SHA-256은 이 작업 시작 직전 사본과 작업 결과를 구분하는 근거다.

| 파일 | 수정 전 SHA-256 | 작업 결과 SHA-256 |
| --- | --- | --- |
| `collection-assist.dev.md` | `94ebeb4c2a038fb9f845e9669f207df98a8f17d806021422a6dff53df5e0d1a0` | `cd64b11b8fef1da83f755a93e5a98ce2d4eb38aae6e98d6279cd0ec2d7b88620` |
| `01-system-architecture.md` | `00c79e57f40ac9e2f634998e0bdc28783f685c2fddec8f6e69eb4b41953e2572` | `c6b174d02fc0c8810b48e5d14bcb314e99ce921d2a84c73307f59ba108af3dfb` |
| `02-data-model.md` | `ad0a3ba4b2c34bddf15147fae60570a9ef4477b513389cf88cdb65f16595d113` | `54d3abcb2d63005641f136316bcbc4c1107a15f0b97f28bfa373701c9beb5b36` |
| `03-api-design.md` | `a22cc424a76e50c898767e01e6193998cf6964f40efd7f382a35f51f6404520e` | `ec484aa11f4ef825d56c451511af4cfcc2e30c98241f05b22b70f70aa6fffbfb` |
| `04-infrastructure-design.md` | `60da35c5e070802c246ca7e5eef1ed6cbf5bffb5c5ac3950838327214fa76a6e` | `1bf0e263f6fb7144ef2a75d013f062764e3bdab6fb068a70ada4772060e4c67b` |
| `05-security-operations.md` | `f5f41d279f7a8d12938721a5d701739462ea8d30288d4bb6dc05b850ea5934d5` | `261f639d2ec9351e727020a770975fdf00cfd57a57fc33b968978372e954e155` |
| `06-member-community-design.md` | `a7ebd84107dc8b70d63945ecc3ffe28e0a2e2fdfd15d0ea8a50bbc1ef475d70d` | `03ba1bfd91d56e3a60496c52046566d34d5b291e84cce993c9874f0c07c33756` |

## 반영 내용

### D05 — `/collect status` 제품 범위 유지

- `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:938-945`에
  `/collect status`가 읽기 전용 초기 명령임을 반영했다.
- 같은 파일 `:975-980`, `:1019-1027`에 상태 명령 이벤트와 수용 조건을 추가했다.
- 최근 Job·대기 후보·실패·비활성 출처를 요약한다는 기존 제품 범위만 유지했다. 조회 원천·응답 형식·
  보존 기간은 `(미정)`으로 남겼고 새 endpoint를 만들지 않았다.

### D06 — result 뒤 ID/version 기반 preview 순차 업로드

- 기능 명세 `:347-361`, `:626-646`의 흐름을 `result metadata 제출 -> candidateImageId 매핑과 최신
  lockVersion 수신 -> preview 순차 업로드`로 분리했다.
- preview마다 반환된 새 `lockVersion`을 다음 업로드에 사용하도록 기존 API 계약을 직접 연결했다.
- 기능 명세 `:1019-1027`의 프로그램 수용 조건도 result와 preview를 별도 호출로 구분했다.

### D07 — Discord 상태 변경 전 확인

- 기능 명세 `:626-646`에서 guild·channel·user 권한 검증 뒤 실행 대상·요청 범위·출처 상태를 보여주고
  확인 interaction을 거친 다음 PENDING 접수하도록 했다.
- 같은 파일 `:975-980`의 Spring 이벤트 표에도 확인 단계를 반영했다.
- 확인된 interaction ID를 기존 멱등 key로 쓴다는 계약만 연결했으며 새 인증·권한 값을 정하지 않았다.

### D08 — 서비스 데이터 쓰기 주체 문언 정정

- `docs/system-design/02-data-model.md:954-960`을 “서비스 데이터 변경은 Core API만 수행한다”로 고쳐,
  기존 API 유지와 Spring의 서비스 테이블 직접 쓰기 금지가 함께 읽히도록 했다.

### D09 — 후속 자동 수집 실행 기술 중립화

- `docs/system-design/01-system-architecture.md:82-85`와 `03-api-design.md:641-646`의
  `npm run collect:crawl-due` 선결정을 제거했다.
- 실행 주체·scheduler·명령은 M0 자동 수집 단계에서 먼저 결정하고, 목록·feed 실행 경로를 별도 계약하도록
  바꿨다. 현재 M0 수집 보조와 Quartz가 신규 목록 URL을 발견하지 않는 범위는 유지했다.

### D12 — Markdown 표 셀 파이프 이스케이프

- `docs/system-design/03-api-design.md:512`의 enum union 파이프 3개를 이스케이프했다.
- `docs/system-design/06-member-community-design.md:261`, `:265`, `:266`, `:278`, `:279`, `:281`,
  `:283`, `:287`, `:344`의 nullable union 파이프만 이스케이프했다.
- 수정 전 스냅샷과 `06`의 diff에는 위 9개 표 행 이외의 변경이 없다.

### 추가 확인 1 — 공개 VM 작업과 로컬 Quartz 분리

- `docs/system-design/04-infrastructure-design.md:424-438`의 VM 이전 절차에서 공개 VM의
  scheduler·outbox와 운영자 로컬 Spring collector의 Quartz를 별도 프로세스로 명시했다.
- 서비스 DB 쓰기 차단 중에는 로컬 Quartz 신규 실행도 따로 중지하고, 새 VM 쓰기 경로 확인 뒤 각 위치에서
  재개 상태를 확인하도록 했다. 구체 명령·중지 유예·cron 값은 추가하지 않았다.

### 추가 확인 2 — 알림 제품 동작과 기술 미정 분리

- `docs/system-design/01-system-architecture.md:415-430`,
  `docs/system-design/05-security-operations.md:502-518`, 기능 명세 `:1050-1071`에서 알림 최종 실패를
  관리자 화면에 표시한다는 기존 제품 동작을 유지했다.
- Discord 재연결, 상태 조회 원천, 이력 보존, 재시도 횟수·간격·저장소는 `(미정)`으로 남겼다.

## 검증

| 검사 | 결과 |
| --- | --- |
| 수정 전 구조 기준선 | Markdown 71개, local link 660개, 표 342개, 표 문제 10건 |
| 수정 후 `check_structure.py` | Markdown 71개, local link 661개, 표 342개, 문제 0건 |
| `git diff --check` | 통과 |
| 스냅샷 대비 담당 파일 diff | D05–D09·D12·추가 확인 2건의 문언만 존재 |
| `06-member-community-design.md` 범위 | 지정된 D12 표 9행의 파이프 이스케이프만 변경 |

검사 명령:

```bash
python3 docs/task_list/09/08/문서정합성/check_structure.py
git diff --check
```

## 상태 구분

- 완료: 승인된 문서 정합성 보완, 수정 전 스냅샷, 구조·링크·표·공백 검사
- 미검증: Spring source, migration, OpenAPI 구현, test, build, runtime, 실제 Discord·출처·운영 배포
- 미정 유지: 버전, Batch/Quartz DB, Job/Step, 실행 API 경로·포트·인증, 동시 실행·중지·종료,
  cron 운영값, quota 저장, 상태 조회·알림 재처리 상세
- 수행하지 않음: commit, push, merge, 배포
