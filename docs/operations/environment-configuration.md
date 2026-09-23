# 환경별 설정과 이미지 URL 계약

- 기준일: 2026-09-23 KST
- 범위: local/dev/stage/prod `.env` 예시, public 이미지 URL 조립 규칙, collect media preview 경계
- 상태: 설정 문서와 예시 파일 정리. 신규 endpoint 구현이나 운영 배포는 포함하지 않는다.

## 1. 환경 구분

| 환경 | 목적 | 실행 위치 | DB | object storage | 공개 접근 |
| --- | --- | --- | --- | --- | --- |
| `local` | 개인 PC 개발과 빠른 화면 확인 | 개발자 PC | 로컬 PostgreSQL `5439`, API/batch 제한 role 분리 | 로컬 디렉터리 `.local-data/media`, `.local-data/collector-objects` | loopback 중심 |
| `dev` | 팀 개발 통합 확인 | 개발 서버 또는 개발자 공유 장비 | dev 전용 DB | dev 전용 R2/S3 bucket | 내부/제한 공개 |
| `stage` | production과 같은 방식의 리허설 | stage 서버 | stage 전용 DB | stage 전용 R2/S3 bucket | 관리자·검수자 제한 |
| `prod` | 실제 서비스 | 운영 서버와 별도 collector PC | 같은 production DB, API/batch role과 테이블 소유권 분리 | production R2 bucket 분리 | 승인된 public만 공개 |

`NODE_ENV=production`은 local/dev가 아니라 stage/prod에서만 사용한다. production 모드의 API는 `DATABASE_URL`과
평문 DB 비밀번호 환경 변수를 거부하고 `DB_HOST`, `DB_NAME`, `APP_DB_USER`, `APP_DB_PASSWORD_FILE` 형식을 요구한다.

## 2. 예시 파일

실제 `.env` 파일은 커밋하지 않는다. 아래 파일을 복사해서 각 환경의 비공개 위치에서 채운다.

| 파일 | 용도 |
| --- | --- |
| `.env.example` | 공통 규칙 안내 |
| `.env.local.example` | 개인 PC 개발 |
| `.env.dev.example` | 공유 개발 환경 |
| `.env.stage.example` | production 방식 리허설 |
| `.env.prod.example` | production 입력 목록 |

예시 파일에는 실제 token, R2 secret, Discord token, Cloudflare Access 값, 개인정보를 넣지 않는다.
`<...>` placeholder는 각 환경의 secret manager, 0600 env 파일, Docker secret, Keychain 또는 운영자 전용 파일에서 주입한다.

## 3. 이미지 URL은 host/base와 path를 분리한다

Blariyo의 public image URL은 다음 계약을 따른다.

```text
browser URL = IMAGE_ORIGIN + '/' + publicStorageKey
```

- `IMAGE_ORIGIN`: 환경별 host와 선택적 base path다. 예: `http://localhost:3000/media`, `https://media.blariyo.com`.
- `publicStorageKey`: DB와 object store에 저장되는 상대 path다. 공개 게시글 이미지는 `content/published/posts/{postId}/{imageId}-{sha256}.{ext}`를 사용한다.
- DB에는 `https://...` 전체 URL을 정본으로 저장하지 않는다. 환경을 바꾸면 host만 바꿔 같은 key를 다시 표시할 수 있어야 한다.
- Web 공개 runtime에는 같은 값을 `NUXT_PUBLIC_IMAGE_ORIGIN`으로 주입한다.
- API command와 outbox cache purge는 `IMAGE_ORIGIN`으로 public URL을 계산한다.

local에서는 `IMAGE_ORIGIN=http://localhost:3000/media`를 사용한다. Web의 `/media/...` route가 Core의
`/internal/local-media/...`를 proxy하므로 브라우저가 localhost에서 public 이미지 path를 확인할 수 있다.

prod에서는 `IMAGE_ORIGIN=https://media.blariyo.com`만 공개 이미지 host로 사용한다. `collect/media/*`,
`collect/raw/*`, `content/private/*`는 이 origin 아래에 직접 노출하지 않는다.

## 4. 저장 prefix와 공개 범위

| prefix | 소유자 | 공개 여부 | 화면에서 보는 방법 |
| --- | --- | --- | --- |
| `collect/raw/*` | batch | 비공개 | 일반 화면 노출 없음 |
| `collect/media/*` | batch | 비공개 | 개발·관리자 preview proxy 필요 |
| `collect/report/*` | batch | 비공개 | 운영 report/readback |
| `content/private/*` | API | 비공개 | 관리자 preview endpoint |
| `content/published/posts/*` | API | 공개 가능 | `IMAGE_ORIGIN + '/' + key` |

수집 이미지는 게시 승인 전까지 공개 이미지가 아니다. 개발 중 확인이 필요하면 public bucket에 임시 복사하지 말고,
인증된 `GET /api/v1/admin/collect/batch-items/{itemId}/media/{position}/preview`가 collect object를 읽고
DB hash/size와 이미지 검증을 통과한 사본만 반환한다. 이 경로는 구현되어 있으며 API/Web의 batch 검수
기능 flag와 관리자 인증이 필요하다. production에서 익명 공개로 열면 안 된다. 수집 이미지 제한은
[direct batch 검수 계약](../system-design/07-spring-collector-design.md#2026-09-23-direct-batch-검수승격-구현-계약)을 따른다.

## 5. 환경별 권장 origin

| 환경 | `SITE_ORIGIN` | `IMAGE_ORIGIN` | `NUXT_PUBLIC_SITE_ORIGIN` | `NUXT_PUBLIC_IMAGE_ORIGIN` |
| --- | --- | --- | --- | --- |
| local | `http://localhost:3000` | `http://localhost:3000/media` | `http://localhost:3000` | `http://localhost:3000/media` |
| dev | `https://dev.blariyo.com` | `https://dev-media.blariyo.com` | 같음 | 같음 |
| stage | `https://stage.blariyo.com` | `https://stage-media.blariyo.com` | 같음 | 같음 |
| prod | `https://blariyo.com` | `https://media.blariyo.com` | 같음 | 같음 |

stage/prod의 `SITE_ORIGIN`과 `IMAGE_ORIGIN`은 HTTPS여야 한다. API startup은 production 모드에서 이를 검사한다.

## 6. collector와 API의 object store 분리

API public/private image storage와 batch collect storage는 같은 R2 계정 안에 있더라도 bucket 또는 prefix 권한을 분리한다.

- API: `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BUCKET`
- batch collector: `COLLECTOR_OBJECT_STORE_S3_BUCKET` 또는 local `COLLECTOR_OBJECT_STORE_DIRECTORY`

batch는 `collect/raw`, `collect/media`, `collect/report` prefix만 쓴다. API는 승인된 이미지를 `content/private` 또는 수집 검수 결과에서
`content/published/posts/{postId}/{imageId}-{sha256}.{ext}` public key로 승격하고, public 화면은 이 key와 `IMAGE_ORIGIN`만 사용한다.

## 7. 운영 체크

- `.env.local`, `.env.dev`, `.env.stage`, `.env.prod`는 `.gitignore` 대상이다.
- 예시 파일만 커밋한다.
- production에서 `STORAGE_MODE=local` 또는 local storage root를 사용하지 않는다.
- production에서 `DATABASE_URL`, `PGPASSWORD`, `APP_DB_PASSWORD` 같은 평문 DB secret을 쓰지 않는다.
- `IMAGE_ORIGIN`에 `collect/media`나 private bucket host를 넣지 않는다.
- public URL을 DB에 backfill하지 않는다. URL은 항상 origin + key로 계산한다.


## 8. 수집 결과 승격 규칙

batch 수집 결과는 바로 공개 게시글이 아니다. 운영 또는 로컬 확인에서 `/meme`에 노출하려면 별도 승격 단계가 필요하다.

1. batch가 `collect.batch_item`, `collect.batch_media`, `collect.batch_report`와 `collect/raw/*`, `collect/media/*`, `collect/report/*` object에 저장한다.
2. API가 검수 상태를 APPROVED로 바꾼 뒤 별도 초안 승격 요청을 처리한다. collect object 해시·크기를 확인하고 이미지를 검증해 private 사본과 DRAFT 게시글을 만든다.
3. 별도 발행 요청에서 private 사본을 public object `content/published/posts/{postId}/{imageId}-{sha256}.{ext}`로 복사한다. 초안 승격만으로 공개 object를 만들지 않는다.
4. `content.board_post_image.public_storage_key`에는 위 public object key만 저장한다.
5. 화면 URL은 항상 `{IMAGE_ORIGIN}/{publicStorageKey}`로 계산한다.

따라서 `collect/media/{runId}/{itemId}/{position}`을 `public_storage_key`에 직접 넣으면 local `/media` 프록시와 운영 CDN/R2 모두에서 공개 이미지 계약을 만족하지 못한다.


## 9. Core 연결과 direct batch 검수의 실행 경계

- Web의 `NUXT_CORE_ORIGIN`은 API 내부 주소다. Docker 예시는 `http://api:3100`, 같은 컴퓨터의 직접 실행은 `http://127.0.0.1:3100`이다. Web 공개 주소로 설정하면 자기 자신을 호출하므로 사용하지 않는다.
- dev/stage/prod 예시는 Docker 서비스 간 연결을 전제로 API `HOST=0.0.0.0`을 사용한다. 컨테이너 안의 `127.0.0.1`은 다른 Web 컨테이너에서 접근할 수 없다. API 포트를 공개 host에 publish하지 않고 내부 네트워크로 연결한다. 같은 컴퓨터에서 직접 실행할 때는 `HOST=127.0.0.1`과 `NUXT_CORE_ORIGIN=http://127.0.0.1:3100`을 함께 사용한다. 이는 예시 설정이며 운영 Compose 적용 증거가 아니다.
- API `SERVICE_TOKEN`과 Web `NUXT_SERVICE_TOKEN`에는 같은 비밀을 주입한다. 예시 값 자체로 실행하지 않는다.
- API는 자기 PostgreSQL 연결에서 `collect.batch_*`를 조회한다. API와 batch 프로세스는 분리하지만 **현재 구현은 같은 PostgreSQL database**를 사용한다. 원격 batch의 DB host는 VPN/사설망을 통해 같은 DB에 도달하는 주소여야 한다. DB를 공개 인터넷에 열라는 의미가 아니다.
- API role: batch 소유 7개 테이블은 SELECT만, `collect.batch_review`/`collect.batch_review_request`와 `content.*`는 API 소유다. batch role에는 API 검수·content 테이블 쓰기 권한을 주지 않는다.
- API의 `COLLECT_READER_S3_*`는 batch bucket의 `collect/media/*` GET 전용 자격증명이다. API public/private 저장 자격증명 및 batch writer와 구분한다. local에서는 `COLLECT_READER_DIRECTORY`가 batch object root를 가리킨다.
- API V008, Collector V006 migration, DB role과 object 접근권한 검증 후 `COLLECT_BATCH_REVIEW_ENABLED`와 `NUXT_COLLECT_BATCH_REVIEW_ENABLED`를 함께 true로 설정한다. 기본 예시는 false다. 시작만으로 검수·승격·발행하지 않는다.
- 현재 isolated DB 통합 테스트에서 조회 → REVIEWING → APPROVED → DRAFT → 별도 발행 → 숨김 → 재발행을 검증했다. 공유 dev/stage/prod 적용과 실제 R2 권한 검증은 별도다.

Collector V003은 source session 잠금과 같은 DB 연결에서 쓰기를 실행한다. batch DB endpoint에는
transaction pooling을 사용하지 않는다. migration은 batch 실행을 멈추고 백업한 뒤 적용한다.
로컬 `prepare-batch-review --apply`는 Collector V006/API V008과 제한 role을 함께 준비한다.

## Discord direct queue 설정

V005의 `collect.batch_queue`·`collect.batch_confirmation`은 batch 전용이다. API role은 이 두 테이블에 읽기/쓰기 권한이 없고 기존 수집 결과 7개 테이블만 조회한다. `discord --write-db`는 독립 batch 프로세스에서 Gateway와 worker를 실행하며 API/Quartz를 기동하지 않는다. 환경별 allowlist와 소유자 전용 secrets 디렉터리를 별도로 주입한다. 명령과 macOS/Windows/Docker 예시는 [Collector 운영 문서](../../apps/collector/ops/README.md#direct-discord-queue-v005)를 따른다. 실제 Gateway와 원격 환경 검증 결과는 독립적으로 기록한다.

## PostgreSQL 배포 권한 계약 (2026-09-23)

- `blariyo_migrator`만 schema/DDL을 소유한다. API와 batch runtime에는 DDL/역할전환 권한이 없다.
- `blariyo_app`은 content/legal과 명시한 API-owned collect 테이블을 쓰며 batch 결과 7개 테이블은 SELECT만 가능하다. queue/confirmation은 조회도 금지한다.
- `blariyo_batch`는 batch 결과 7개와 queue/confirmation 2개 테이블만 SELECT/INSERT/UPDATE하며 media에만 DELETE를 허용한다. content/legal/ops와 API 검수 테이블은 금지한다. 소유권 trigger의 assert helper 함수만 명시적으로 실행할 수 있다.
- `blariyo_backup`은 API와 Collector migration ledger를 포함한 모든 애플리케이션 schema를 읽지만 쓸 수 없다.
- 미래 collect 테이블/sequence는 API/batch에 자동 권한을 부여하지 않는다. migration 이후 소유권 허용 목록과 권한 SQL을 함께 갱신한다.
- 기존 3개 운영 역할을 덮어쓰지 않고, batch 활성화 시 `create-roles.py --batch-only`로 별도 비밀번호의 batch 역할만 추가한다. 이미 존재하면 초기화·비밀번호 변경 없이 거부한다.
- source 파일 변경과 격리 테스트는 운영 반영 증거가 아니다. 운영 SQL 적용·HBA reload·VPN/사설 경로 접속은 별도 작업이다.


Collector V006의 `collect.batch_media_correction`은 소유자 전용 유지보수 감사 테이블이다.
API/batch runtime에는 이 테이블 조회·쓰기나 `correct_batch_media_mime` 실행 권한을 주지 않는다.
완료 이미지 MIME 정정은 파일 검사·백업·고정 대상 manifest를 갖춘 별도 로컬 복구 명령으로 실행한다.
[로컬 실행 문서](../../scripts/local/README.md#과거-수집-이미지-mime-정정-v006)를 따른다.
