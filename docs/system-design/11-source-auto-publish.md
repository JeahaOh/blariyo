# 출처별 자동 발행

- 제품 정본: [수집 기획](../planning/content-collection/README.md). 2026-10-09 사용자 요청으로 출처별 검수 생략 발행을 추가한다.
- 구현·검증 및 배포 여부: [작업 기록](../../worklog/2026-10-09/source-auto-publish/README.md). 이 계약의 존재가 운영 활성화를 뜻하지 않는다.

## 정책과 권한

| 항목 | 계약 |
| --- | --- |
| 설정 단위 | `content.common_code`의 `source` 그룹 `reference_key`인 수집 출처 식별자 |
| 기본값 | 모든 출처 OFF. 정책 행이 없으면 OFF·lockVersion 0 |
| 변경 권한 | OWNER만 변경, OWNER·EDITOR 조회. 변경 actor·시각·버전·ON/OFF 이력 보관 |
| 신규 적용 | ON 전환의 enabled_since 이후 시작한 batch_run의 FETCHED 글만 대상. 진행 중이던 run과 기존 검수 대기 글은 소급하지 않음 |
| 사람 결정 | review·command·Discord delivery가 이미 존재하면 자동 접수하지 않음. 관리자 명령이 AUTO보다 우선 |
| 발행 내용 | 원문 전체 block과 이미지, 현행 제목 보정·출처 표시·meme 게시판. 기존 이미지 검증·중복·retention·발행 검사를 동일 적용 |
| OFF·재설정 | 미완료 AUTO 명령은 설정 버전 불일치 시 NEEDS_ADMIN. 이미 발행한 글은 유지. 다시 ON해도 이전 명령을 재실행하지 않음 |
| Discord | 자동 대상은 신규 검수 전송에서 제외. 기존 전달된 글은 사람 검수 유지. 자동 발행 알림은 이번 범위에 포함하지 않음 |

## API 소유 데이터

API V015가 아래 두 테이블을 추가한다. Collector 소유 `batch_source`에 정책을 추가하지 않으며 Collector에는 조회·변경 권한을 부여하지 않는다.

- `collect.batch_source_publish_policy`: source_key PK, auto_publish_enabled, enabled_since, lock_version, updated_by, updated_at.
- `collect.batch_source_publish_policy_change`: (source_key, lock_version) PK와 정책 FK, 설정값·actor·시각. 변경 트리거가 같은 transaction에서 기록한다.
- `batch_review_control.authority`와 `batch_review_command.origin`에 AUTO 추가. actor는 `system:collector`, action은 APPROVE_PUBLISH, 사람 operator와 reviewer는 비어 있어야 한다.
- command request_body에 sourceKey·policyVersion·boardSlug를 보존한다. 원문 복사본을 새로 보관하지 않는다.
- 두 정책 테이블은 선택 백업 보존 대상이다. 정책·AUTO 명령이 존재하면 V015 down을 차단한다. 데이터가 있는 상태의 복귀는 별도 인계가 필요하다.

## 관리자 API·화면

- GET `/api/v1/admin/collect/source-publish-policies`: 전체 출처의 기본값/저장값과 canManage 반환.
- POST `/api/v1/admin/collect/source-publish-policies/:sourceKey`: `{autoPublishEnabled, lockVersion}` 저장. 최초 버전0, 성공마다+1. 오래된 버전409, 미등록 출처404, EDITOR 변경403.
- 출처별 advisory transaction lock과 낙관적 버전 검사로 동시 수정을 직렬화한다. 정책 행·변경 이력이 함께 commit된다.
- `COLLECT_BATCH_REVIEW_ENABLED`가 필요하다. 유지보수 모드는 조회만 허용한다. 응답은 private, no-store.
- 별도 관리자 메뉴 `수집처 관리`(`/admin/sources`)에서 수집처 목록·저장된 자동 발행 상태를 조회하고 각 행의 수집 여부·자동 발행 여부 select와 저장 버튼으로 해당 출처만 변경한다. `/admin/batch`에는 설정 패널을 두지 않는다. 저장 오류·응답 유실이면 최신 값을 다시 읽어 확인하고, 재조회 실패 중에는 해당 행의 추가 저장을 막는다. 다른 행의 미저장 편집은 유지한다.

## 실행과 중단

1. 기존 API `posts:publish-due` 명령이 예약 게시글 처리 후 자동 발행을 수행한다. 운영의 기존 매분 실행에 연결하며 Collector 프로세스에서 게시글을 쓰지 않는다.
2. `collection:auto-publish` 명령으로 같은 처리만 1회 실행할 수 있다. 명령은 API 실행 환경의 DB·원문 저장소·이미지 저장소 설정을 사용한다.
3. 한 번에 최대5건, session advisory lock으로 중복 실행 방지. 총120초가 지나면 새 글 접수를 멈춘다. 진행 중 글의 준비·발행 timeout은 기존 공통 경로를 따른다.
4. 미완료 AUTO 명령을 먼저 재개하고 남은 한도에서 새 글을 접수한다. `auto:<itemId>:<policyVersion>` 키와 공통 decision epoch·lease로 재시작/경합 중복을 막는다.
5. 공통 `ReviewCommandService`의 APPROVED → DRAFTED → PUBLISHED 경로를 사용한다. 수집 원문·이미지 불일치는 NEEDS_ADMIN, 저장소 일시 장애는 기존 재시도 경로를 따른다. 한 글의 업무 오류는 다음 글을 막지 않는다.
6. 접수·초안·실제 발행 transaction에서 ON·버전·신규 run·유효 원문을 재검사한다. 정책의 FOR SHARE 잠금을 최종 commit까지 유지한다. OFF 저장과 발행 중 먼저 잠금을 획득한 transaction 순서로 결과가 확정된다.
7. Discord 설정/worker가 없어도 AUTO 처리 자체는 실행된다. 사람의 공통 명령 인계·상세 상태 표시는 기존 Discord 검수 설정을 사용하는 관리자 경로를 따른다.
8. 개발 예약 중지는 유지한다. migration·권한 적용·새 API/Web 배포와 OWNER의 특정 출처 ON은 별도 운영 작업이다. 출처 설정만 켜도 미배포 실행 파일에 기능이 생기지는 않는다.

## 회귀 기준

- 기본 OFF, OWNER/EDITOR, 미등록 출처·잘못된 입력·낡은 버전·동시 변경 및 이력.
- 이전 run/다른 출처/기존 사람 검수 제외, 새 run 정상 발행, 동일 실행 중복0.
- 초안 이후 OFF, 이미지 public 승격 중 OFF, 관리자 반려 선점 및 직접 publish 우회 차단.
- 손상 이미지의 업무 중단·다음 글 계속 처리, 일시 장애 재시도, retention 만료.
- Discord 전송과 AUTO 접수 경합, Discord 비활성 상태의 자동 발행.
- V015 migration/down·ORM·최소 권한·선택 백업 복원, 관리자 브라우저 저장/충돌/재조회.

## 수집처 수집 설정·URL — 2026-10-09

- Collector V016의 `batch_source_collection_setting`은 source_key·source_url·configured_enabled·collection_available·blocked_reason·collection_enabled·lock_version·updated_at을 저장한다. source 구성에서 URL/기술 가능 여부/초기값을 동기화하되 관리자 변경 후 수집 여부는 유지한다.
- 표시 URL은 기본 목록 주소, 다른 등록 목록 주소 순으로 선택한다. 목록이 없는 단건 전용 수집처는 구성에 등록된 HTTPS 사이트 루트 주소를 표시한다. 이 표시 주소가 목록 수집 지원을 뜻하지는 않는다.
- `batch_source_collection_setting_change`는 관리자의 수집 설정 변경 actor·시각·버전을 남긴다. 두 테이블은 선택 백업에 보존한다.
- API는 두 테이블 조회와 `set_source_collection_setting(text,boolean,integer,text)` 실행만 허용한다. Collector는 조회와 `sync_source_collection_setting(text,text,boolean,boolean,text)` 실행만 허용한다. 발행 정책 직접 접근 권한을 Collector에 추가하지 않는다.
- 기존 정책 API 응답에 sourceUrl, collectionEnabled, collectionAvailable, collectionBlockedReason, collectionLockVersion을 추가한다. 수집 메타데이터가 없으면 URL/수집 여부는 null로 표시하고 수집 설정 변경은 거부한다.
- 기존 POST에 collectionEnabled·collectionLockVersion을 함께 보낸다. 기존 자동 발행 전용 요청도 허용한다. API transaction 내 두 버전을 확인하고 하나라도 충돌하면 전체 rollback한다. 수집 여부만 수정하면 발행 정책 lockVersion/활성 시작 시각은 유지한다.
- 배치 실행기는 파일의 SOURCE_DISABLED를 기준으로 source를 사전 제외하지 않는다. Java가 DB 수집 여부를 확인해 OFF는 외부 요청 없이 SKIPPED/exit0, ON은 기술 정책 검증 후 수집한다. 매 HTTP 요청 및 quota 대기 종료 후에도 최신 DB 값을 확인한다.
- `sources-sync`는 외부 HTTP/수집/Discord 없이 현재 구성의 수집처 메타데이터만 동기화한다. 적용 순서는 Collector V016 → 역할 권한 → 메타데이터 동기화 → API/Web/Collector 실행 파일이다.

## 수집처 실행 이력 조회 — 2026-10-09

- 기존 정책 응답에 lastCollectedAt(FETCHED 글의 최대 fetched_at), lastRunAt/lastRunState(WRITE_DB 최신 started_at/id 기준), lastFailureCodes(그 실행의 batch_failure.code와 유효한 checkpoint.reason 중복 제거)를 추가한다. 시각/상태는 이력 없으면 null, 오류는 빈 배열.
- 내부 오류 detail이나 object key는 반환하지 않는다. 대문자 영문·숫자·밑줄의 80자 이내 코드만 반환한다. dry-run은 실제 수집 이력에서 제외한다. 최신 정상 실행은 과거 실패를 가져오지 않는다.
- Collector ledger의 기존 API SELECT 권한을 사용하며 migration·쓰기 권한을 추가하지 않는다. Collector 테이블이 미적용이면 기존 조회처럼 이력 null/빈 배열로 반환한다. 필터는 21개 등록 출처 목록을 클라이언트에서 적용한다.
