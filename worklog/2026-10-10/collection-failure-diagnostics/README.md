# 수집 실패 상세 진단 기록·조회

- 요청: 세부 로그를 볼 수 있도록 수정하고 테스트.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 08:55 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`.
- 담당 경로: Collector 실패/HTTP/URL 정책/파서·direct runner 및 관련 테스트, source policy API 조회·OpenAPI/generated 계약·관리 화면 및 관련 테스트, 관련 planning/system-design/spec·계약 변경 이력, 이 기록 폴더.
- 기존 변경: 관리자 제목 수정3파일은 이전 작업으로 보존하고 planning의 이번 추가와 구분한다. 다른 세션 코드 감사와 당일 종료 기록 보존. 진행 담당 중복 없음 확인.
- 구현 범위: 기존 실패 코드 유지, 검사 종류·대상 호스트·HTTP 상태를 안전한 구조화 진단으로 추가. DB failure.detail과 배치 report에 저장하고 수집처 화면의 최근 실행 상세 로그로 조회. 비밀·query·응답 본문·예외 메시지/stack은 기록하지 않는다. 과거 미기록 사유는 추정하지 않는다.
- 검증: 실패 재현 단위 검사, 실제 격리 DB 저장/readback·API 계약/정보 비노출 검사, PC/모바일 상세 로그 화면·이전 실패/정상 실행 필터 회귀, build/type/lint 및 diff 검사.
- 시간 제한 종료 상태 수정·정책 완화·재수집·운영 배포·Git 반영은 이번 범위에 포함하지 않는다. 개발 예약 배치는 중지 유지.
- 이전 조사: [새벽 실패 확인](../morning-collection-failures/README.md).

## 구현 결과

- Collector: 기존 오류 코드를 유지하면서 URL 허용 검사(승인/프로토콜/호스트/경로/포트/인증값/fragment), DNS/IP 검사, HTTP 상태/재시도/redirect, TLS/시간 초과, 접근 확인 화면과 parser 실패를 고정 진단 코드로 구분한다.
- batch_failure.detail의 기존 JSONB에 진단 코드·호스트·실제 HTTP 상태를 저장한다. direct batch report와 deploy/collector/run.py의 구조화 실행 결과에도 최대10건을 포함한다. 개별 게시글 실패 뒤 발생한 목록 실패도 별도 기록한다.
- API: 최신 WRITE_DB 실행의 실패만 최신순 최대10건으로 조회하며, 응답은 시각/단계/코드와 검증된 위3개 필드로 제한한다. 정상 최신 실행은 과거 실패를 반환하지 않는다. 기존 또는 잘못된 detail은 안전한 null로 반환한다.
- 화면: 수집처 행의 `상세 로그`에서 KST 시각·처리 단계·구체 사유·대상 호스트·HTTP 상태·기존 코드를 펼친다. 과거 사유는 `세부 진단 미기록`으로 표시한다. settings/filter/권한 계약은 유지한다.
- 관련 화면/Collector/개발 Spec과 두 OpenAPI 정본, 생성 계약 및 contract-evolution.json의 변경 근거·해시를 함께 반영했다. 적용된 SQL/migration은 변경하지 않았다.

## 검증

- Node24.18.0 / Java25 / 로컬 PostgreSQL5439 사용. API/Collector/browser 검사는 생성·정리되는 격리 테스트 DB를 사용하며 운영 DB에 쓰지 않았다.
- API 통합14건: 최신 실행만 조회, 최대10건/최신순, 과거 null, 성공 최신 실행의 오류 제거, 비밀 fixture 값 비노출 및 기존 정책/권한 회귀 통과.
- 브라우저6건: 1280/390/320px 가로 넘침 없음, 상세 펼침/Enter 토글, 기존 저장·권한·필터·재조회 회귀 통과. screenshots는 이 폴더의 fixture/settings/custom-options 파일로 저장했다.
- Python schedule4건: report diagnostics의 운영 구조화 결과 전달과 기존 실행 실패/누락 report 회귀 통과.
- quality 최종14항목 통과: contracts/CI/build/API test build/type4종/lint5종/unit. [최종 receipt](verification/2026-10-09T23-52-05.756Z-quality-86281.json)를 실행 당시와 동일한 JAVA_HOME/PATH로 검증하여 valid=true, problems=[] 확인.
- 초기 quality는 계약 해시 변경 이력 누락 및 실행 도중 fixture 수정으로 실패했다. 사용자 요구의 계약 변경 근거/해시를 갱신하고 입력을 고정한 최종 재검사를 통과했다. 검사 assertion·hook·범위를 완화하지 않았다.
- Collector 초기 전체319건은 중간 입력에서 통과. 추가 목록 실패 회귀 fixture의 claim/ObjectStore 설정 누락으로 중간320건 실행 중1건 실패했다. 실제 claim과 로컬 ObjectStore를 제공하도록 fixture를 수정한 최종 전체 재실행은88 suites / 320건 / 실패0 / 오류0 / skip0 / 실제 DB readback23건으로 통과했다. [수집기 결과](collector-result.json).
- 로컬 개발 앱을 빌드 결과로 재시작하고 Chrome에서 율도 행의 과거 로그를 펼쳐 `본문 분석 / 세부 진단 미기록 / SOURCE_NOT_ALLOWED` 표시를 직접 확인했다. [로컬 기존 기록 화면](local-legacy-log.png). 개발 예약 배치는 재개하지 않았다.
- 과거 브라우저 테스트의 screenshot 경로가 10/09 추적 이미지를 덮어쓰는 것을 발견해 이번 실행의 변경만 기준 HEAD bytes로 복구하고 SHA-256 동일성을 확인했다. 모든 출력 경로를 당일 이 폴더로 변경한 뒤6건을 재실행했다.
- git diff --check 통과. 두 OpenAPI 원문 byte 일치 확인. 신규 문서 링크 대상 존재 확인. 기존 다른 작업의 변경/기록 보존.

## 적용 한계

- 소스 수정 및 로컬 실행 반영 완료. commit/push/운영 배포·실제 외부 수집 재실행 미실행.
- 기존 JSONB 사용으로 운영 DB migration 불필요. 신규 구체 진단은 변경된 Collector를 실제 실행한 이후 쌓인다. 오늘 새벽 당시 누락된 진단은 소급 복원하지 않는다.
- TIME_LIMIT 프로세스 종료의 DB RUNNING 상태 정리는 별도 잔여 작업이다. 이번 요청에서 종료 정책·수집 허용 정책은 변경하지 않았다.
