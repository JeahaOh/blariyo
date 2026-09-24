# M0 실제 운영 전환·7일 관찰 기록

현재 상태: **수집 운영 전환·7일 관찰 미시작**. Core 공개 배포·관리자 batch 검수 활성화와 별도다.
2026-09-24 문서 대조 기준으로 [현재 운영 상태](current-status.md)에는 9월 23일 Core 배포·DB 반영 기록이
있으나 URL·Discord 접수와 자동 수집은 비활성이다. 격리 테스트 결과를 실제 관찰값으로 복사하지 않는다.
현행 direct 경로는 [수집 설계](../system-design/07-spring-collector-design.md)·[설치·복구 안내](../../apps/collector/ops/README.md)·
[로드맵](../roadmap.md)을 따른다. [과거 완료 조건 S7](../../worklog/2026-09-08/core-spring-acceptance/acceptance.md#7-운영-전환)은
legacy Python→Spring 전환 당시 기준이며 direct batch/Discord의 운영 인수로 자동 승계하지 않는다.

## 시작 전 입력·확인

| 항목 | 현재 값/상태 | 완료 증거 |
| --- | --- | --- |
| 비밀 제외 운영 설정 파일 경로 | (미정) | 실제 PC의 0600 파일·0700 저장 경로 검사 |
| 승인 출처 설정·이용 조건·robots·selector·요청 한도·연락처 | (미정) | 승인한 대상의 실제 결과 확인 |
| Discord App·허용 대상 설정 | (미정) | 원본 ID/token을 이 문서에 쓰지 않고 허용/거부·확인 interaction 시험 결과만 기록 |
| 운영자 계정·Keychain | (미정) | 잠금/해제·재기동·자격 분리 확인, 비밀값 기록 금지 |
| Core R2/Access/CDN/timer·원격 backup·복원 | 9월 23일 배포·DB 반영 및 백업 복원 기록 있음. 실제 MFA·알림 실수신·복귀/재부팅 미검증 | 현재 구성 재조회 후 수집 실행 대상과의 접속·권한을 별도 검증 |
| 법무 실값·정책 artifact | Core 발행 기록 있음. direct raw/media/report/queue 보존·고지(QD-04)는 미정 | [법무 조건](../legal/README.md#출시-차단-항목)을 기능별로 대조; Core 발행을 수집 승인으로 사용하지 않음 |
| direct batch·Discord 실행 대상/DB/object·입력 소유권 | (미정) | QD-03~06 결정과 API/batch 제한 role·VPN/사설 경로·object 권한 readback |
| direct 단건 E2E·실패/재시작·중복·알림 | 미검증 | 승인 출처에서 수집→검수→초안→별도 수동 발행 및 queue/재시작·권한 거부 확인 |
| Python 신규 claim 중지·기존 실행/preview drain | legacy 전환에만 해당, 미검증 | 해당 경로를 전환할 때 잔여 건수 0, 임의 삭제/backfill 없음 |
| strict CHECK 및 V2 단독 활성화 | legacy 전환에만 해당, 미검증 | 해당 경로의 apply/check 결과와 legacy 신규 mutation 거부 |
| launchd·daily backup·절전 복귀 | 미검증 | 실제 설치·기동·최종 종료 코드·백업 생성/복원 |
| REST→Discord→Quartz 실제 단건 E2E | legacy 경로, 미검증 | direct Discord는 독립 queue worker를 쓰며 이 경로의 통과로 대체하지 않음 |

## 관찰 기간

- 시작 시각: (미정)
- 종료 시각: (미정)
- 관찰 대상 구성/빌드 식별: (미정)
- 운영 전환 승인: 미승인

| 일차 | 실제 날짜/관찰 구간 | 완료/실패/중단/조정 필요 건수 | quota·중복 외부 요청 | 알림·의존성·spool·백업 | 문제·복구·운영자 확인 |
| --- | --- | --- | --- | --- | --- |
| 1 | (미정) | (미정) | (미정) | (미정) | (미정) |
| 2 | (미정) | (미정) | (미정) | (미정) | (미정) |
| 3 | (미정) | (미정) | (미정) | (미정) | (미정) |
| 4 | (미정) | (미정) | (미정) | (미정) | (미정) |
| 5 | (미정) | (미정) | (미정) | (미정) | (미정) |
| 6 | (미정) | (미정) | (미정) | (미정) | (미정) |
| 7 | (미정) | (미정) | (미정) | (미정) | (미정) |

중복 송신·권한 경계 위반·소유권 상실 후 mutation·복원 차단 무시가 확인되면 신규 수집을 끄고 Core 수동 게시를 유지한다. legacy 수집을 자동 재활성화하지 않는다. 7일 관찰과 문제 조정이 끝나기 전에는 legacy 자격 폐기·go-live 승인을 완료로 표시하지 않는다.

- 7일 관찰 판정: 미검증
- legacy 자격 폐기: 미수행
- go-live 승인: 미승인
