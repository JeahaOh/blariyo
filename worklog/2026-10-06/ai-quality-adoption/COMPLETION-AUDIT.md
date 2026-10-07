# 도입 계획 수용 조건 대조

- 대상: [승인 계획](../ai-slop-tools-review/ADOPTION-PLAN.md) 전체0~5단계. 각 결과는 이 파일의 확인 시점과 실제 증거를 따른다.
- Git 반영·원격 CI·운영 배포는 이번 권한/완료 범위가 아니다. 기존 제품의 모든 오류 처리 경고를 해결하는 프로젝트로 확대하지 않는다.

| 요구 | 구현·증거 | 판정 |
| --- | --- | --- |
| 담당·기준선·기존 변경 보존 | 시작12df6ae, 명시적 차단 후 사용자 resume/인계b932366. 브랜치 이동·stash·reset 없음 | 확인 |
| 한국어 간결 보고·추측성 확장 억제 | AGENTS 최소2문장, 별도 전역 스킬/규칙집 설치 없음 | 확인 |
| API/Web/scripts/tests 공통 lint | package `lint`의 순차 && 연결, CI 기존 quality에 연결, 실패 exit 전파 | 구현·실행 결과는 README |
| 기존 CI 범위 유지 | workflow diff는 quality의 lint 연결/선택 규칙 타입 검사 추가뿐. DB/browser/Collector job 불변 | 확인 |
| 최소 실행기·프로필 분리 | quality/api/browser/browser-docker. Collector JUnit·운영 수용 미지원 명시 | 확인 |
| 입력·HEAD·dirty/untracked/config/lock 연결 | snapshot: 전체 Git 입력, 내용·실행권한·삭제/rename, worklog 제외. 회귀 테스트 | 확인 |
| 시작/종료 변경 감지·과거 PASS 거부 | stale-inputs/inputs-changed-during-run 및 명령/중복/누락 독립 재판정 테스트 | 확인 |
| 명령·시간·종료코드·버전·test 수 | receipt schema와 현재 실행 JSON, parser별 결과 및 null 범위 | 확인 |
| fail/not_run/unknown, 0건/파싱/skip/중단 | 실제 child failure/missing command/abort 및 malformed/duplicate/skip/zero count 회귀 | 확인 |
| 출력 경로·비밀 보호 | worklog 경로/심볼릭 링크 탈출 거부, 로그 원문/환경값 미보존, advisory snippet 제거 테스트 | 확인 |
| 기록 손상 거부 | JSON/schema/snapshot digest 오류 테스트, 완료 표시와 실제 결과 별도 확인 | 확인 |
| 테스트/설정 약화 후보 | JS/TS AST, 삭제·skip/only·assertion·disable·설정/실행 정책 후보, Java/Vue 등 한계 표시 | 확인 |
| 정상 대조 | 동등 assertion·이름 변경·fixture 문자열·실제 git rename 정상, untracked only 탐지 | 확인 |
| 자동 승인/우회 금지 | 신규 도입 정책 후보는 사용자 요청/실제 diff와 대조. V013 기대 건수 증가와 브라우저 조작 가능 상태 대기도 근거를 기록. 자동 ignore/skip/expectation 완화 없음 | 확인 |
| 14파일·고정 source·정상/결함9쌍 | EVALUATION과 external-evaluation.json, sample-paths와 재현 스크립트 | 확인 |
| 기존 ESLint 대비·추가효과/중복 | reducer2개 추가, assertion 중복 미도입, safety comment 제외 | 확인 |
| 언어 공백·cold1/warm3·시간 | Vue/Java/Gradle 미지원·미검증 비율·process-cold 한계·실행시간 기록 | 확인 |
| 선택 규칙·라이선스·버전·담당 | MIT source2개 byte 동일, plugin/Oxlint1.78.0, Python 전용 lock/설정 | 확인 |
| 실제 변경5건 관찰 | TS3/Vue1/Java1 실제 전후 hash·경고·시간. 기존 변경 재현이며 미래5회/장기관찰 아님 | 확인 |
| 불필요한 코드·입력 경계 훼손/오탐 | 규칙 대응용 리팩터링 없음. admin.vue instanceof 확인, 정상 fallback2개 유지 | 확인 |
| 기존 build/type/ESLint/구조/unit 유지 | 최종 quality14개·CI16/공통86 tests, 21:17:36 시점 receipt valid:true | 확인 |
| DB/API/browser/Collector 유지 | API140·browser85·Collector299/readback20 PASS, 21:17:36 같은 입력 hash 대조 | 확인 |
| 문서 정본/사용법/status/roadmap | AGENTS/harness/testing/root README/status/roadmap 연결, 링크 검사236개 누락0(진행 중 시점) | 확인 |
| 되돌리기·예외 기준 | EVALUATION 정책 변경 검토와 도구 README. 기존 검사/실패 증거 유지 | 확인 |

## 검증 범위의 한계

- 기록은 인증 서명이 아니며 작업자에 의한 조작·중간 변경 후 복구를 증명하지 못한다.
- 정적 경고 없음은 프로그램 의미·보안 전체 통과가 아니다. iron-laws 전체 후보114건 중 미해결 REVIEW 목록은 보존했다.
- 실제 변경5건은 현재 저장소의 이미 수행된 변경을 재현한 도입 표본이다. 미래 운영 기간에서 오탐률/개발 비용이 같다고 일반화하지 않는다.
- 재사용할 때는 `quality:receipt`로 현재 입력과 비교한다. 현재 상태를 바꾼 뒤 이전 receipt를 유효하다고 보고하지 않는다.

## 당시 검증 대기 판정 — 2026-10-06 20:58 KST

현재 전체 수용은 성립하지 않는다. 이후 source 변경으로 quality/API/Collector 이전 기록은 현재 입력의 유효한 통과가 아니고 전체 browser 실패도 남았다. 위 확인 항목은 구현·평가 범위의 증거이며 전체 완료 판정을 대신하지 않는다. 실행 순서 조율 후 README의 잔여6단계를 마감해야 한다. 실행하지 않은 원격 CI·commit/push·배포는 별도 범위로 유지한다.


## 최종 수용 — 2026-10-06 21:18 KST

- 위20:58 판정 이후 동시 변경과 Collector fixture 오류를 보완하고 전체 검증을 다시 실행했다. 최신 [README 최종 수용](README.md)은 계획0~5단계의 로컬 완료 기준이다. 각 숫자와 JSON 원문은 README 표에서 확인한다.
- quality/API/browser의 독립 receipt 검증과 Collector 수동 JUnit 입력 재대조 모두21:17:36 시점의 같은 hash에서 통과했다. 실패·중간 입력 변경 기록은 덮어쓰지 않았다.
- 실제 변경5건은 전후 재현 관찰로 충족했고 장기 운영 관찰로 주장하지 않는다. iron-laws114후보는 검토 보조 한계로 남으며 제품 전체 경고 해소를 이번 완료 조건으로 바꾸지 않는다.
- 원격 CI·Git 반영·배포·운영자 수용은 이번 도입 권한/범위 밖이며 미실행이다. 이 한계를 로컬 검증 성공으로 대체하지 않는다.


## 수용 이후 입력 변경

21:18에 다른 담당의 임시 출처 제외4경로가 바뀌어 receipt는 모두 stale이 됐다. 도입 파일37개는 수용 시점 그대로다. 도입의 완료 증거는21:17:36 고정 입력이며, 이후 변경된 작업 폴더 전체의 통과는 미검증이다. 상세 증거와 Git 담당 종료는 README 마지막 절을 따른다. 이 이후의 독립 기능 수정·커밋 검증을 도입 수용 시점으로 소급하지 않는다.
