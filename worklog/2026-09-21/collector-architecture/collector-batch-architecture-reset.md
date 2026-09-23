# Collector·Batch 아키텍처 전환 작업 지시서

- 상태: 실행 전 작업 명세
- 작성일: 2026-09-21
- 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 목적: API 중계 중심으로 확장된 수집 설계를 재검토하고, 별도 batch와 API가 공유 DB·S3/R2에 직접 접근하는 구조로 정본·구현을 정렬한다.

## 1. 최종 방향

API와 batch는 별도 프로세스·별도 실행 컴퓨터에서 동작한다. batch는 외부 사이트 목록·상세 수집, parser, 중복 제거, Discord 입력, DB 저장, S3/R2 업로드와 실행 보고를 소유한다. API는 수집 실행이나 외부 fetch를 소유하지 않고, 수집 결과 조회·운영자 검수·게시글 초안 승격·공개 서비스를 소유한다.

```text
Batch 컴퓨터
  목록/상세 fetch → 사이트별 parser → collect DB 직접 저장
                                      └→ S3/R2 직접 업로드

API 서버
  collect 조회·검수 → 승인 결과를 content 게시글 초안으로 승격 → 공개
```

batch가 글마다 API 후보 접수 endpoint를 호출하는 구조를 새 기준으로 만들지 않는다. API와 batch가 공유 DB·S3를 사용하되, schema·table·상태·S3 prefix·DB role의 소유권을 분리한다.

## 2. 저장·권한 경계

### batch 소유

- `collect`의 source registry, batch run, discovered item, fetch result, media metadata, failure, report
- 수집 실행 상태: `DISCOVERED`, `FETCHING`, `FETCHED`, `FAILED`, `BLOCKED`, `SKIPPED_DUPLICATE`
- S3/R2 `collect/raw/*`, `collect/media/*`, `collect/report/*`
- canonical URL hash, source post key, retry, checkpoint, site-level stop/skip

### API 소유

- 운영자 검수 상태: `REVIEWING`, `REJECTED`, `APPROVED`
- `content` 게시글·블록·공개 상태
- 승인된 수집 결과의 게시글 초안 승격
- S3/R2 `content/private/*`, `content/published/*`

batch는 게시글 공개 상태를 직접 변경하지 않는다. API는 외부 사이트를 fetch하지 않는다. 같은 행을 두 프로세스가 무제한으로 수정하지 않으며, 상태 전이와 optimistic lock을 DB 제약·repository·test로 고정한다.

## 3. 반드시 확인할 기존 파일

1. `AGENTS.md`
2. `docs/ai/README.md`
3. `docs/planning/content-collection/README.md`
4. `docs/system-design/07-spring-collector-design.md`
5. `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md`
6. `apps/collector/ops/reference-sites.sources.example.json`
7. 현재 `apps/collector` source/parser/Discord/batch 코드
8. 현재 `apps/api` collection entity/repository/service/controller/migration 코드
9. `docs/ai/tasks/2026-09-21-collector-batch-acceptance.md`

## 4. 기존 변경 보호와 재분류

작업 시작과 종료에 `git status --short --branch`를 실행한다. 현재 worktree에는 이전 수집 확장 작업이 섞여 있으므로 기존 변경을 삭제하거나 자동으로 되돌리지 않는다. 파일별로 다음을 기록한다.

- 새 구조에도 유지
- batch DB/S3 계층으로 이동
- API 조회·검수 계층으로 이동
- 새 구조와 충돌하여 폐기 검토
- 검증 전 보류

분류 전에 `git diff`와 untracked inventory를 남긴다. commit·push·배포는 하지 않는다.

## 5. 구현 범위

### Batch

- batch 전용 PostgreSQL datasource와 repository
- collect schema migration: source, run, item, media, failure, report, source post key, checkpoint
- S3/R2 adapter: raw/media/report 업로드와 hash·mime·size·object key 기록
- 목록 parser와 상세 parser 분리
- 21개 source별 adapter/fixture/blocked 상태
- canonical URL·source post key deduplication
- `skip` 기본 재수집 정책과 명시적 update 계약
- max pages/items/since/interval, retry/backoff, site-level stop/skip
- `--dry-run`, `--write-db`, JSON/JSONL report
- macOS·Windows PowerShell·Docker Linux 공통 설정·CLI
- Discord `/collect url <url>` 확인 후 batch queue 등록

### API

- collect 결과 조회
- 운영자 검수 상태 변경
- 승인 결과를 content 게시글 초안으로 승격
- private media preview/reference 조회
- 수집 실행을 위한 글별 proxy endpoint를 새로 만들지 않음

### 미디어·SNS

- 본문 순서 보존
- 본문 이미지·첨부 file metadata와 S3 object를 분리 기록
- X, Instagram, YouTube, TikTok 등의 URL은 원문 링크로 저장
- SNS API 호출·로그인·binary 복제는 하지 않음
- 공식 임베드 가능 URL만 화면 임베드 allowlist로 처리

## 6. 금지 사항

- API를 반드시 거쳐야 한다는 가정으로 batch를 재설계하지 않는다.
- host와 이름만 설정하고 구현 완료라고 표시하지 않는다.
- generic OG metadata parser로 21개 사이트를 성공 처리하지 않는다.
- fixture만으로 실제 공개 URL 검증 완료라고 표시하지 않는다.
- robots, CAPTCHA, 로그인, 접근 차단을 우회하지 않는다.
- API와 batch가 같은 상태를 서로 임의로 덮어쓰게 하지 않는다.
- DB binary 저장, raw credential·cookie·token·개인정보 로그 기록을 하지 않는다.

## 7. 완료 판정

완료는 다음 증거가 모두 있는 경우에만 표시한다.

- 문서 정본과 실제 source가 새 데이터 경계와 일치
- migration 적용 및 DB readback
- batch direct DB/S3 저장 및 object/readback
- API 조회·검수·초안 승격 검증
- 목록→상세→본문/이미지/첨부/SNS→DB/S3 전체 흐름
- 21개 사이트별 실제 fixture와 검증 URL 또는 명시적 `blocked` 사유
- Discord Gateway 실제 연결 여부를 별도로 표시
- dry-run 무쓰기, 중복, 재시작, 실패 중단, retry/backoff 검증
- `git diff --check`와 의도한 변경 파일 확인

구현·격리 검증·실제 공개 URL·개발 DB readback·실제 Discord·운영 승인은 서로 대체하지 않는다.
