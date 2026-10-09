# 출처별 자동 발행 개발

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / 시작 HEAD: `abf21ea` / release 공통 기준: `7df63de`.
- 요청: 기존 변경을 주제별 커밋 후 출처별 자동 발행 여부 개발.
- 선행 커밋 완료: `fdcdff5` 이미지 정책·소스·회귀/실사이트 검증, `97d2f81` 개발 중지·실패 원인, `8fd1124` Discord 검수 조사, `da39bf5` SNS 방향, `7768563` 미개발 점검, `abd93f6` 구성 시각화, `abf21ea` 자동 발행 사전 검토. 각각 staged 범위·diff 및 hook 검사 통과. 빌드 출력 로그의 줄 끝 공백만 정규화했다.
- 담당 범위: planning/system-design/spec/OpenAPI, API migration·출처 정책·공통 발행 명령·운영 command, 관리자 출처 설정 UI, 관련 테스트/생성 계약, 이 기록.
- 기본 결정: 전 출처 기본 OFF, OWNER 설정 변경/OWNER·EDITOR 조회, 켠 뒤 수집을 시작한 신규 글만 자동 처리, 기존 사람 판정 보존, OFF/버전 변경을 실제 발행 시 재확인. 게시판은 현행 수집 발행 대상 meme 유지.
- 자동 실행은 API 운영 명령에 연결하며 Discord 검수 작업 실행 여부와 분리한다. 개발 예약 중지 유지. 실제 출처 자동 발행 활성화·운영 배포·push는 실행하지 않는다.
- 검증 계획: 격리 DB에서 OFF/ON/이전 글 제외/권한/중복/정책 변경 및 관리자 반려 경합/초안 이후 재시도/Discord 비활성 동작, 관리자 HTTP·화면 검증, migration/grant/계약 검사.

## 구현

- API V015: `collect.batch_source_publish_policy`와 `batch_source_publish_policy_change`, 변경 이력 트리거, AUTO 명령/시스템 actor 제약, 데이터가 있으면 down 차단. API ORM·권한·readiness·선택 백업 보존 목록 반영.
- OWNER 설정/OWNER·EDITOR 조회 API와 `/admin/batch`의 접이식 출처 설정. 기존 source 공통코드 연결 키 사용, 기본 OFF, 낙관적 버전 검사·변경 이력.
- `SourceAutoPublishService`: 기존 공통 검수/발행 경로 재사용, 새 run만 처리, 사람 검수/Discord 전달 보존, 중복·관리자 반려 우선·최종 정책 재확인. `posts:publish-due`에 후속 실행 연결, `npm run collection:auto-publish` 단독 명령 추가. 최대5건/회, 결과 코드별 집계 로그.
- planning·system-design·개발 Spec·OpenAPI 및 생성 계약 동기화. 원문 수집/이미지 정책이나 기존 법무 placeholder는 추가 완화하지 않음.
- 자동 대상은 Discord 신규 검수 전송에서 제외. 자동 발행 알림 추가 없음. 사람의 예외 처리·상태 상세는 현행 Discord 공통 검수 설정의 관리자 경로 사용.

## 검증 중 발견·수정

- Web BFF가 새 정책 경로를 legacy 수집으로 분류해404를 반환했다. batch-review flag에 연결하고 브라우저에서 실제 저장/조회로 재검증했다.
- API V015 추가에 맞춰 health·direct-request·collection-operations의 명시적 버전 검사 갱신. 기존 migration의 bytes/checksum은 보존했다.
- V015 이전을 대상으로 하던 down 검증은 빈 V015를 먼저 내려 V014의 기존 차단 검사를 그대로 수행하도록 수정했다. ORM 기대값은 새2개 테이블/FK1개에 맞춰32 entities/23 FK로 변경했고 실제 catalog와 전체 column·관계 동일성 검사를 유지했다.
- 손상 이미지(체크섬 불일치)는 NEEDS_ADMIN, 읽기 장애는 기존503 재시도라는 계약에 맞춰 시험 입력을 각각 분리했다. 원문 만료 시험은 collected_at<=expires_at 제약을 유지한 과거 fixture로 재현했다.
- macOS sandbox의 Chromium 실행 제한 후 Docker Playwright로 전환했다. `npx playwright`가 최신1.64를 받아 client1.63과 불일치하는 문제가 있어 설치된 client/image의 정확한 버전으로 서버 실행을 고정했다. 패키지 의존성 업그레이드·검사 skip 없음.
- 전체 API 회귀의 JVM mailbox fixture는55449의 임시 DB만 허용한다. 개발5439에서 실행한 회귀는 `ISOLATED_MAILBOX_DATABASE_REQUIRED`로 실패해, 별도55449 임시 PostgreSQL에서 전체를 다시 실행했다. fixture의 격리 조건은 변경하지 않았다.

## 확인한 결과

- 자동 발행 전용 DB 시험12건 통과: 기본 OFF·OWNER/EDITOR·낡은 버전·동시 변경·이력·신규 run/다른 출처 제외·1회 발행·OFF/승격 중 OFF·손상 이미지 격리·관리자 반려·Discord 경합·저장소 재시도·만료·제한 API 역할의 실제 발행·사용 중 down 차단.
- Chromium25건 통과: 새 정책 저장/OFF/충돌/새로고침/EDITOR, 기존 검수/일괄 반려/URL 입력.320·390·1280px overflow 없음. [설정 화면](admin-settings.png) 직접 확인.
- 별도 PostgreSQL의5개 역할·API/Collector V015·앱 draft/publish·최소 권한·삭제/retention 검사 통과. backup 역할 dump 후 별도 DB restore에서86개 table 전체 행/ledger·17개 sequence 일치. 운영 서버 미접속.
- 공통 테스트88건, 변경 문서12개의 상대 링크, `git diff --check` 통과. 최종 quality 기록 및 전체 API 회귀 결과는 아래 최종 검증에 기록한다.
- `review-guards.json` 후보1건은 package.json의 `collection:auto-publish` 업무 명령 추가다. 기존 검사 명령·정책·실패 판정 변경 없음. SQL·Vue·문서는 도구 지원 밖이므로 실제 diff·DB·브라우저·정본 대조로 별도 검토했다.

## 최종 검증·인계

- 전체 API 회귀: 전용55449 임시 PostgreSQL,37개 integration 파일/161 tests PASS, fail/skip/todo0. 실제 JVM mailbox·60초 lease·schema/backup restore 포함. 생성한 임시 DB/container 정리 완료. [집계](test-results.json), [시험별 결과](api-results.txt).
- quality14개 검사 전부 PASS: API/Web build, API test build, scripts/tests/Web/quality-rule 타입, API/Web/scripts/tests/Oxlint, contracts, CI16 tests, 공통88 tests. [최종 receipt](verification/2026-10-09T12-31-43.910Z-quality-2573.json). 동일 Node24.18.0/JDK25 환경으로 receipt 재검증 valid=true. JDK 환경 없이 검증한 최초 호출의 runtime-changed는 실행 환경을 일치시켜 확인했다.
- 실제 로컬 DB readback: API V014 유지, 새 정책 테이블 없음. 실제 로컬 데이터에 migration·정책 ON·발행을 실행하지 않았다. 개발 예약4개는 disabled이며 unloaded 유지.
- Git: 기존 변경7개 커밋 완료. 새 자동 발행 개발분은 미커밋이며 최종 HEAD `abf21ea` 유지. push·merge·운영 배포 없음. 변경 파일과 문서 링크·`git diff --check` 최종 확인.
- 잔여 적용: 개발분 커밋/통합, 대상 환경의 V015·권한·API/Web 적용, 운영자가 선택한 출처 ON, 실제 주기 실행·운영 발행 수용은 별도 작업이다. 사람 검수의 예외 처리 화면은 기존 Discord 공통 검수 설정을 따른다.
- 최종 갱신: 2026-10-09 21:35:41 KST.
