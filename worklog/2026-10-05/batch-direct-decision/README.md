# 검수 시작 단계 제거

- 요청: 검수 시작/다시 검수 버튼과 검수 중 상태 제거.
- 담당: Codex / 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 기준 HEAD/release `12df6aed`
- 상태: 종료(구현·검증·로컬 적용 완료) / 갱신: 2026-10-05 18:57 KST
- 범위: planning·API/DB 계약·OpenAPI·생성 타입, API review 저장/판정·추가 migration, 관리자 검수 UI와 통합/브라우저 회귀. 이전 보존기한/게시글 뒤로가기 등 미커밋 변경 보존. 앞선 담당 종료 확인.
- 새 흐름: 수집 완료 항목 조회 → 바로 승인/반려 → 승인 항목 초안 생성 → 별도 편집·발행. 승인·반려 결과는 유지하되 REVIEWING 요청/노출/신규 저장 제거.
- 일관성: 상세 조회 snapshot digest를 승인/반려 요청에 포함해 읽은 이후의 원문/미디어 변경을 거부한다. 버전 충돌·동일 요청 재시도·이미 승격된 원문 보호·보존기한·중복 승격 방어 유지.
- 호환: 기존 DB REVIEWING은 조회 시 UNREVIEWED로 매핑하고 다음 판단으로 직접 전환한다. 만료 자료와 과거 이력을 소급 수정하지 않는다. 새 상태 생성을 막는 추가 migration을 사용하고 과거 SQL checksum은 유지한다.
- 완료 조건: 직접 승인/반려·재판정·구 상태 호환, stale snapshot/동시 판정/멱등/만료/승격 회귀 통과 후 현재 세션 소유 로컬 서버에 새 빌드 적용. 운영 배포·commit/push는 미실행.
- 이전 검토: [사용 흐름 확인](../batch-review-flow/README.md).

## 구현과 검증

- UI: 시작/재검수 버튼·검수 중 선택 옵션 제거. 수집 완료·초안 미연결 항목에서 바로 승인/반려. 승인 주 버튼 강조. 예전 브라우저의 REVIEWING 검색 조건은 UNREVIEWED로 복원.
- API: 상세에 contentDigest 반환, 승인/반려 시 표시한 snapshot과 현재 snapshot 대조. 직접 판단의 최초 INSERT 및 기존 판정 전환 지원. REVIEWING 입력은400, 기존 기록의 응답/검색은 UNREVIEWED로 매핑.
- V011: 신규 REVIEWING 금지, 직접 승인/반려 허용. 원문 식별자·검수 버전·기존 초안 연결·승격 시 snapshot 보호 유지. 기존 V001~V010 checksum과 만료·보존 trigger를 변경하지 않음. down/up에서 검수 데이터 재작성 없음.
- 버전 의존성: batch readiness는 V011 필요. 기존 direct 접수와 collection operation의 준비 확인은 V011도 인식하도록 갱신. CLI도 상세 digest를 명시적으로 요구하도록 정렬. 계약 변경 manifest는 실제 hash로 갱신했고 baseline은 보존.
- 로컬 DB 적용 전 조회: API V010, 승인40/반려2/기존 REVIEWING1. 기존 원문이나 글을 테스트 승인 대상으로 사용하지 않음.
- 격리 PostgreSQL: review20 tests(직접 판단·구 상태·동시 충돌·본문/미디어 변경·이미지49장·애니메이션257프레임·승격·응답 재생 등), retention7 tests, migration2 tests 통과. 보존 검사는 중간 상태 대신 실제 첫 판정에서7일이 시작되고 재판정·실패한 transaction으로 연장되지 않는 새 계약으로 정렬.
- Chromium: 검수/만료2파일13 tests 통과. 승인/반려 즉시 가능, 시작 버튼 부재, 판정 후 목록 오류·stale 상세·401/403·응답 유실·중복 초안·만료 화면 닫힘을 확인.
- 실제 제한5역할/SCRAM 격리 검사 통과: 새 migration·직접 승인·초안 승격·별도 발행·권한 거부 포함. API/Web 빌드, Web·테스트·스크립트 타입 및 변경 API/Web/테스트/스크립트 lint 통과. 작업 트리 계약 hash37개·migration inventory·OpenAPI 복사본 일치 확인. index/hook 실행 결과와 혼동하지 않음.
- 해결한 검사 문제: YAML 필수 필드의 중첩 위치를 바로잡아 생성 성공. migration 최신 기대값/준비 검사를 V011로 정렬. 신규 테스트의 unknown 타입 표기를 보완해 lint 통과. mailbox 추가 검사는 처음 JAVA_HOME 누락, 다음에는 Java fixture가5439를 거부했으므로 제한을 유지한 채 별도55449 PostgreSQL에서 재실행 중.

## 최종 결과 및 로컬 적용

- 추가 호환 재검사: Java25·별도55449 격리 PostgreSQL에서 mailbox8 tests와 collection operation5 tests PASS. 앞선 review20·retention7·migration2와 합쳐42 tests PASS, 실패0/skip0. 브라우저13 tests PASS. 실제5역할 검사는 백업 dump/독립 restore의73개 table 전체 행/ledger·16개 sequence 일치까지 완료했다.
- 격리 DB/시험 컨테이너는 회수했다. 기존 작업의 미커밋 변경과 HEAD/release `12df6aed` 유지. 소스와 문서 외 생성 빌드/로컬 실행 자료는 기존 도구 경로만 사용했다.
- 현재 세션이 띄운 개발 서버 세션1419를 정상 종료한 뒤, 고정 loopback 개발 DB에 V011만 추가 적용했다. migration 전후 승인40/반려2/기존 REVIEWING1건 동일 확인. raw·게시글·검수 데이터 소급 수정 없음.
- 서버 새 세션68324: Core PID94160/3100, Web PID94170/3000, workers=false. Web 로그인·Core 준비 상태 HTTP200. 실행 유지.
- Chrome 실제 로컬 화면에서 검수 상태 옵션은 검수 전/승인/반려만 표시됨을 확인. 기존 REVIEWING 항목을 열어 검수 전 표시, 시작 버튼0개, 승인·반려 모두 활성 확인. 확인 과정에서 실제 자료를 승인·반려·승격·발행하지 않았다.
- 정본·Spec·OpenAPI·DB/CLI 문서와 현재 상태를 동기화했다. 변경 파일 lint/타입·계약 hash·공백·범위 검사를 완료했다. commit/push/release 통합·운영 V011 적용·배포는 미실행이다.
