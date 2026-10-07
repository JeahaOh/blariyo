# 수집 실패 항목 관리자 삭제

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6ae`
- 상태: 종료 / 작업일: 2026-10-06 KST / 갱신: 2026-10-06 06:36 KST
- 이전 작업: [목록 일괄 반려](../../2026-10-05/batch-bulk-reject/README.md), 종료 확인. 기존 dirty/untracked 보존.
- 요청: 관리자 화면에서 수집 실패 항목 삭제 기능 보완.
- 범위: 실패/차단·미검수·게시글 미연결 항목의 단건/선택 삭제, API 계약·권한·제한 DB 함수, 대상별 파일 정리, 관련 정본·검증.
- Scope Lock: 실제 사용자 데이터 삭제·운영 배포·commit/push 없음. 이미지 자동 재시도 오류 분류는 별도 검토 결과로 유지.
- 결정: 만료 처리로 위장하지 않는다. 명시 삭제 증거와 정확한 item/run 파일 정리 작업을 남기고 payload만 삭제한다. run 전체 failure/report/queue와 다른 항목은 보존한다. 자동 재수집으로 재등장하지 않도록 기존 dedup identity를 보존한다.
- 완료 조건: 정상/검수/연결 게시글 보호, 버전 충돌과 활성 수집 잠금, 응답 유실 동일 요청 재생, DB/파일 정리 및 대상 외 보존, 실제 브라우저 선택/확인/부분 실패 검증, 로컬 서버 적용.

## 결과

- 목록은 정상 항목 반려와 실패/차단 항목 삭제를 구분한다. 현재 페이지 체크·단건 상세 삭제, 사이트 공통 확인창의 실제 삭제 건수·취소/삭제, 모바일 우측 작업 버튼 그룹을 제공한다.
- 삭제는 detail GET에 의존하지 않아 본문 파싱 실패도 처리한다. snapshot version과 review lockVersion은 목록에서 전달하고 서버 제한 함수로 재검증한다. 항목별 부분 실패·불확실 결과와 동일 idempotency body/key 재확인을 지원한다.
- API OWNER/EDITOR 권한·유지보수 제한을 유지하며 `POST .../batch-items/:itemId/delete`만 추가했다. 원문을 삭제한 후에도 receipt를 먼저 확인한다. 삭제와 receipt는 한 transaction으로 묶었다.
- Collector V014는 이미지 자동 실패와 별도 삭제/정리 원장을 만든다. 기존 `ImageFailureCleanup`의 정확한 item/run worker를 재사용하되 출처/restore/검수 잠금, 검수 기록·기존 게시글·다른 파일 참조를 보존한다. 파일 삭제 후 실제 부재를 확인한다. 실패/재등장한 파일은 작업을 유지하거나 다시 연다.
- API V013 유지, Collector V014 적용. 새 함수가 없으면 삭제 요청503이며 기존 검수 준비 조건은 유지한다. 배포 시 migration→권한→API/Web→retention 관측 순서를 기술 계약에 기록했다.

## 검증

- 신규 삭제 Chromium7 tests, 기존 일괄 반려6 tests, 기존 검수/이동20 tests 통과(총33, 최종 버튼 그룹 변경 뒤 신규/일괄13 재실행 통과).
- 신규 브라우저 fixture는 Collector V002~V009/V011~V014의 실제 소유권·불변성 trigger를 모두 사용한다. 테스트 데이터도 출처 잠금·FETCHING→완료/실패·report/checkpoint 저장을 거쳐 생성했다. 초기 fixture의 누락 guard/보고서 경로/actor 형식 실패는 fixture를 올바르게 수정했으며 guard나 assertion을 완화하지 않았다.
- 수집/restore 잠금 차단, version 충돌, 검수 기록/동일 원문 게시글 보호, 혼합 선택·취소, payload 삭제 후 응답 유실 재생·같은 key 다른 body 거부, 상세 해제와 대상 외 보존 통과.
- 실 역할5종: app 함수 호출 가능·batch/retention/backup 호출 거부, private 원장 직접 접근 거부, Collector 전체migration V001~V014, 실제 CLI 원문·첨부 삭제·같은 run 이웃 파일/실패 이력 보존,79테이블·16시퀀스 전체 dump/restore 일치 통과.
- API/Web 빌드, Web·tests·scripts 타입 검사, 변경 API/Web/tests/scripts lint, architecture1·contract hash1·로컬 batch grants1 tests 통과. Collector testClasses/fixtureClasspath/bootJar 성공.
- 1280/390/320px 가로 넘침 확인, 1280/390px 실제 스크린샷 확인. 증거 `.local-data/admin-ux-rework/screenshots/batch-delete-*.png`.
- 로컬 적용 전후 items85/media409/failures47/reviews68/posts117 동일. V014와 API 함수 EXECUTE 권한 확인. 새 서버 인증 GET200 및 선택 삭제/확인창 HTML 확인. 실제 삭제 요청0.
- 현재 로컬 개발 실행기는 별도 retention worker를 자동 시작하지 않는다. 화면 DB 삭제와 object 회수 대기는 분리되며, 파일 정리 실증은 격리 DB·저장소에서 수행했다. 실제 로컬 데이터 삭제·만료 원문 정리 worker 실행은 하지 않았다.
- 운영 반영·commit/push 없음. 이미지 자동 재시도 분류 문제는 [별도 검토](../../2026-10-05/image-collection-process-audit/README.md)의 미수정 상태를 유지한다.

- 마감: `git diff --check` 통과, HEAD `12df6ae` 유지. 새 최소 원장2개가 선택 백업 보존 대상이고 batch_item은 제외되는 분류 검사 통과. 선택 백업 암호화 전체 왕복 검증은 이번 작업에서 재실행하지 않았으며 전체 DB dump/restore79테이블 검증과 구분한다.
