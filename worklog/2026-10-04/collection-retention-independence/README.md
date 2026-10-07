# 신규 수집과 만료 원문 회수 분리

- 요청: 새 원문을 계속 적재하면서 보존기한이 지난 원문은 제거 처리한다.
- 담당: Codex / 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 기준 release/HEAD `12df6aedce57d41993d49060793656870c5c318f`
- 상태: 종료(정책·코드·로컬 검증 완료, 운영 적용 잔여) / 갱신: 2026-10-04 19:35 KST
- 기존 변경: production-acceptance, production-collection 미커밋 기록 보존. 다른 담당 진행 기록 없음.
- 범위: planning 보존 운영 정책 → D01 기술 계약·운영 인계 동기화, Collector 목록/URL queue/Web mailbox의 전역 backlog 차단 제거, 실제 DB 회귀 검증.
- 유지: 7일/28일 보존기한, 만료 원문 접근 거부, 영구 dedup, 게시글 독립 사본, 객체 부재 검증, 삭제 실패 재시도·알림, 선택 백업 검증, 복원 전용 배타 잠금, robots/quota.
- 완료 조건: LIVE/PURGE_PENDING/PURGE_FAILED 만료 backlog와 무관한 신규 수집 성공, 독립 회수 성공·실패 기록, 신규 객체 보존, 기존 권한·복원/만료 방어 회귀 통과. 운영 원문8건 처리/신규 적재는 로컬 코드 완료와 분리한다.
- 이전 운영 조회: [전체 사이트 실행 기록](../production-collection/README.md). 운영 retention 서비스 미설치·선택 백업 gate 미완료는 실제 운영 적용 전에 해소해야 한다.

## 구현 및 검증 — 19:34 KST

- planning에10/4 사용자 결정을 반영하고 D01·운영 인계·선택 백업 runbook을 동기화했다. 만료/삭제 실패가 원인인 전역 수집 차단만 해제한다. 보존기한·삭제 활성화의 선택 백업 검증·복원 inventory의 배타 잠금은 유지한다.
- `BatchStore.begin`, `BatchQueueWorker.once`, `BatchMailbox.pull`의 backlog 거부를 제거했다. 사용되지 않는 Java 진단 wrapper는 제거하고 기존 DB 함수/권한/과거 migration checksum은 유지했다. DB schema 변경 없음.
- 기존 서버 retention worker가 신규 수집과 별도 연결/lease로 실행되는 구조를 사용한다. 새 수집 프로세스에 운영 원문 삭제 권한을 주거나 삭제를 내장하지 않았다.
- 격리 PostgreSQL18에서 실제 Java 목록/URL queue runner를 실행했다. 만료 LIVE + 삭제 gate 닫힘, PURGE_FAILED, PURGE_PENDING의 세 상태마다2건씩 총6건의 신규 본문/raw/이미지 저장을 확인했다.
- PURGE_PENDING 시험은 실제 삭제 worker의 DELETE 도중 별도 DB 연결에서 목록/queue 수집을 완료한다. 이후 기존 원문/raw/media/report만 삭제되고 신규6건 raw 존재·이미지 SHA-256 일치·retention row 보존을 확인했다.
- 실제 Java Web mailbox도 만료 backlog=true 상태에서 접수 성공. 제한 역할·중복 방지·60초 lease 만료 후 이전 담당 거절까지 검증했다.
- 보존·회수·Web 통합3파일23 tests PASS, 실패0/skip0. 테스트 타입 보완 후 회수 worker8 tests 재실행 PASS. API test build 및 변경 TS2파일 ESLint PASS. Java25 testClasses/fixtureClasspath/bootJar PASS.
- 초기 확장 시험은 기존 V008 fixture에 Web receipt 정리 함수가 없어 실패했다. queue 실행에 필요한 실제 V009 migration을 fixture에 적용했다. V010은 해당 fixture가 만들지 않는 collector.restore_gate에 의존하므로 추가하지 않았다. 별도 Collector 전체 검사에서는 정식 V001~V010 migration으로 검증한다. 실패를 assertion 완화로 처리하지 않았다. 신규6건 보존 요구 때문에 기존 전체 retention0 단언을 만료0 및 신규6건 존재 단언으로 명시적으로 변경했다.
- 검사 전용 Docker 컨테이너 `blariyo-retention-independence-test-20261004`와 매 테스트의 무작위DB를 생성·사용 후 회수했다. 기존 blariyo_local DB와 운영 데이터를 시험 대상으로 사용하지 않았다.
- 운영 읽기 전용 재조회: retention108/LIVE만료8, 선택 백업 검증false, 회수 service/timer not-found, 일회성 batch role 부재. 이 작업에서 운영 삭제·적재·배포는 수행하지 않았다.
- 문서의 새 상대 링크·공백 검사 PASS. 법무 placeholder·발행된 정책·권리 대응 문구 변경 없음. 기존 생산 수집 시도 기록은 당시 사실로 보존한다.

## 최종 확인

- Collector 전체 격리 DB 검사:80 suites/289 tests PASS, 실패0·오류0·skip0, DB readback18 tests 포함. 3분14초. runner가 생성한 무작위 테스트 DB 제거 완료.
- 보존·회수·Web 접수 통합23 tests PASS, 수정한 회수 worker8 tests 최종 재실행 PASS. API test build/변경 TS lint/문서 링크/diff whitespace PASS.
- 미실행: commit/push/release 통합/운영 수집기 적용, 운영 회수 서비스 설치, 운영8건 삭제 및 오늘자 재수집. 기존 서비스 배포·원격 main·운영 원문을 이번 로컬 구현 완료로 보고하지 않는다.
- 다음 담당: Codex. 잔여 실행: 검증된 변경의 Git 반영·운영 수집기 전달과 선택 백업/기존full 대체 증거·제한 회수 설치를 완료한 뒤 운영8건 회수 및 전체 사이트 수집을 재개한다. 사용자의 만료 원문 제거 의사는 이미 확인됐으며 같은 삭제 범위를 다시 승인 대상으로 삼지 않는다.

## 로컬 테스트 준비 상태 문의 — 19:39 KST

- 사용자 질문: 로컬 테스트를 진행해도 되는지 확인. 담당·브랜치 동일, 상태 조회 및 이 기록 외 변경 없음.
- 현재3000(Web)/3100(Core) listen 없음. 직전 Collector 결과 파일은289 PASS/실패0/skip0이며, 이번 문의에서 검사를 재실행하지 않았다.
- Node24.18.0의 로컬 실행기와 `/admin/login` 진입을 안내한다. 만료 회수 병행 동작은 앞선 격리 DB 통합 검증을 따르며, 웹 서버 시작만으로 retention worker가 실행되는 것은 아니다.
- 상태: 문의 응답 종료. 기존 미커밋 변경 보존.
