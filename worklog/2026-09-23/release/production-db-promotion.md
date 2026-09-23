# 개발 데이터 운영 반영 및 즉시 공개 — 2026-09-23

- 사용자 요청: 개발 DB 스키마와 게시글·수집 항목 데이터를 운영에 모두 반영하고 바로 공개.
- 결과: 운영 DB 반영 및 게시글 74건 공개 완료. 2026-09-23 22:54:49 KST 공개 응답 전수 검사 통과.
- 앱 이미지: 앞서 CI를 통과한 `5c581c2ad82a9f1565ac53349fbaae7afed9c9cd`의 GHCR API/Web 이미지를 그대로 사용.
- 현재 release: `/opt/blariyo/application/release-5c581c2-db-v008-20260923`.
- 직전 Core release: `/opt/blariyo/application/release-5c581c2ad82a9f1565ac5334`.
- 서버 증거·백업 경로: `/opt/blariyo/operations/db-promotion-20260923` (root 전용).

## 반영 수량

| 항목 | 결과 |
| --- | --- |
| API 스키마 | V005 → V008, 기존·신규 migration checksum 대조 |
| Collector 스키마 | V001–V006 및 Batch/Quartz 기반 테이블 설치 |
| 업무 데이터 | 17개 테이블, 1,937개 행을 원본과 정확히 대조한 뒤 공개 처리 |
| 게시글 | 74건 모두 PUBLISHED |
| 공개 상태 변경 | 초안 110번 발행, 숨김 80·81번 재발행, 기존 공개 71건 유지 |
| 본문 | 786개 블록, 텍스트·이미지 순서·alt·원본 이미지 식별값 보존 |
| 게시글 이미지 | 308개 모두 PUBLIC |
| 수집 항목 | 108건: FETCHED 104, FAILED 2, BLOCKED 1, SKIPPED_POLICY 1 |
| 수집 첨부 | 382개 media 레코드 |
| 수집 이력 | source 20, run 43, checkpoint/report 각각 16, failure 35, review 8, review request 24, queue/confirmation 각각 1, media correction 12 |
| R2 파일 | 중복 키 제외 1,106개 신규 업로드, 전부 재다운로드하여 SHA-256 확인 |
| 파일 전송 묶음 | 542,904,320 bytes, SHA-256 `1eed581db6586c2010dc564ad61b16fbe0209fb1c7156bcbeb332399e37c0003` |

수집 결과는 별도 게시글로 일괄 변환하지 않고 상태·원문·첨부를 그대로 이전했다. 공개 대상은 개발 DB에
존재하던 게시글 74건이다. 실패·차단·정책 제외 항목의 상태를 성공으로 바꾸지 않았다.

## 데이터 보존과 적용 방법

- 개발 DB `127.0.0.1:5439/blariyo_local`에서 동일한 읽기 전용 snapshot으로 dump와 업무 데이터 묶음을 생성. 개발 DB 변경 없음.
- 운영의 발행된 약관·개인정보처리방침을 포함한 정책 6건 유지. 적용 전후 전체 행 해시 동일.
- 개발 환경의 실행 대기 outbox, 임시 idempotency, 환경 인증정보와 개발 정책은 운영 설정에 덮어쓰지 않음.
- 비어 있는 로컬 전용 `scrape_archive`는 운영 설치 범위에서 제외. 실제 source_capture 데이터는 0건.
- 스키마 소유자는 `blariyo_migrator`. API는 수집 결과 SELECT만 허용하고 검토 테이블만 쓰기 허용. backup 역할의 새 테이블 읽기 권한 확인.
- 이력 데이터 가져오기 동안 대상 테이블의 사용자 전이 trigger만 동일 transaction에서 일시 중지 후 복구. FK·CHECK 제약은 계속 활성화. 완료 후 비활성 trigger 0, 미검증 제약 0.
- ID와 참조 관계를 보존하고 identity sequence를 현재 최대 ID에 맞춤.
- 발행·outbox·cleanup timer를 멈추고 실행 중 작업 종료를 확인한 뒤 API/Web을 짧게 중지. 스키마와 데이터를 하나의 transaction으로 적용하고 API → Web 기동.
- 초안/숨김 3건의 공개 전환은 운영 `PostsService`를 통해 처리. R2 이미지 승격·상태 이력·캐시 처리도 기존 앱 절차를 사용. 실행 actor는 `system:collector`, 사용자 요청은 이 기록에 보존.
- 새 release와 서버·저장소의 부팅 helper를 동기화. timer 5개 active, 발행·outbox의 반영 후 실행 success 확인.

## 검증 결과

- 운영 DB 사본에 전체 절차 적용: 17개 테이블 1,937개 행 정확 일치.
- transaction 마지막에 강제 오류를 주입한 격리 검사: DB V005·게시글 0건으로 전체 취소 확인, 같은 묶음 재적용 성공.
- 운영 적용 SQL SHA-256: `49a9d0366f00e9ab02eb31252921e2ebfb2746cd5639b52805298e6e69515eff`.
- 운영 DB readback: API V008, Collector V006, 공개 게시글 74, 공개 이미지 308, 수집 항목 108.
- 공개 목록 4페이지에서 ID 74개 전부 확인. 상세 API 74개와 본문 786개 블록·이미지 경로·alt 대조 통과.
- `media.blariyo.com` 이미지 308개 전부 다운로드: 크기·SHA-256 원본 일치.
- 대표 상세 HTML 7개 정상. Chrome에서 목록 및 새로 공개한 110번의 긴 본문·이미지 렌더링 확인.
- 관리자 배치 검토 service의 목록 108개 조회 및 16개 출처 이미지 미리보기 통과.
- API·Web·DB·Nginx healthy, OOM 없음, host port 없음. API 약 65 MiB/256 MiB, Web 약 42 MiB/384 MiB 표본.

## 백업과 복구 기준

| 시점 | 암호화 백업 | SHA-256 |
| --- | --- | --- |
| 적용 전 22:46:03 KST | 90,332 bytes | `2ad036964c2f870fcef4cd54fccfe757cef618d02daeab12b288099f16b352fa` |
| 적용 후 22:53:32 KST | 370,815 bytes | `5a7cdd6ad31b92138aaffe0034322b5ae987cf68672ee527f1880c3e0241409d` |

- 전후 모두 R2 실파일 다운로드·SHA-256·age 복호화·격리 PostgreSQL 18 복원 및 운영 ledger·정책 해시·게시글 수 대조 통과.
- 적용 전 백업은 서버 증거 폴더의 `before-db.dump.age`로도 보존하여 daily spool 정리와 분리.
- DB V008에서 9월 20일 구버전 API로 단순 복귀하면 readiness가 실패한다. 앱만 복귀할 때는 V008과 호환되는 직전 `5c581c2` Core release를 기준으로 한다.
- DB 전체 복구는 별도 검토가 필요하며 자동 역 migration·volume 삭제·운영 DB 덮어쓰기를 실행하지 않음.

## 활성화 범위와 미검증

- API `COLLECT_BATCH_REVIEW_ENABLED=true`, Web `NUXT_COLLECT_BATCH_REVIEW_ENABLED=true`.
- 수집 첨부 읽기는 운영 private R2에 연결. 수집 원문·raw·report는 private bucket에 보관.
- 관리자 Access 보호 유지. 실제 사용자 MFA 세션은 없어 관리자 브라우저 최종 조작은 미검증. 내부 service 조회·미리보기와 별도 증거로 구분.
- 자동 수집 실행, URL 수집 접수, Discord 접수는 이번 작업에서 활성화하지 않음.
- 기존 Cloudflare 정적 자산 규칙의 새 파일명 반영, 실운영 VM 재부팅은 별도 잔여 항목.
- commit/push 없음. 부모 대화에서 진행 중인 문서·디렉토리 정리 변경은 보존.
