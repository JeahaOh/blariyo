# 운영자 인수 테스트

## 범위

- 대상: 운영 `/admin`, 실제 Cloudflare Access/MFA, 운영 DB/API/Web.
- 운영자: OWNER.
- 비밀·토큰·쿠키·JWT 원문은 기록하지 않는다.

## 기준선

- 확인 시각: 2026-10-03 13:25 KST.
- release: `/opt/blariyo/application/release-31be83b-main-nightly-20261003T034353Z`
- main SHA: `31be83ba83bd0f6b251772400e743c2bd31fb378`
- API image: `ghcr.io/jeahaoh/blariyo-api@sha256:a21714bd7a6e06562f529d691059cd18b625938d6e353d849086d5db4ccf5c66`
- Web image: `ghcr.io/jeahaoh/blariyo-web@sha256:b9c1c6f398a5e2e14648ffb7dbc03a8047c3b838c63301ac186113a93766530c`
- DB ledger: API `V010`, Collector `V010`, `ops.is_schema_ready('V010') = true`
- timer: publish/outbox/cleanup/nightly 모두 active
- 공개 smoke: `/health/live` 200, `/meme` 200
- DB 수량: board 1, post total 76, published 75, draft 1, image 309

## 로그인·권한

- OWNER Cloudflare Access 재로그인 후 `/admin` 접속 성공.
- 원인 보정: 운영자 `identity`는 Access JWT `sub`이며 get-identity 응답의 `user_uuid`를 사용한다.
- 운영자 파일은 `role=OWNER`, `active=true`로 보정했다.

## 핵심 5건

| 번호 | 시나리오 | 결과 | 증거/메모 |
| --- | --- | --- | --- |
| 1 | 출처 없는 글 작성 → 저장 → 발행 → 공개 확인 | 통과 | 13:25 KST 이후 post `113`, `114`가 `PUBLISHED`로 저장됨. 둘 다 `source_name/source_url` NULL |
| 2 | 작은 이미지 글 작성 → 이미지 업로드 성공 확인 | 통과 | post `114`에 image `426`, `image/png`, 13,013 bytes, 370x165, `PUBLIC`, public key 있음 |
| 3 | 고해상도 이미지 업로드 실패 문구 확인 | 실패 | 사용자 확인: 고화질 이미지는 여전히 알림 없이 추가되지 않음. 예상 원인: 해상도 40MP 초과. 화면 오류 문구 필요 |
| 4 | 발행 글 숨김 → 공개 목록/상세 비노출 확인 | 통과 | post `114`가 `HIDDEN_REVIEW`, image `426`이 `PRIVATE_REVIEW`; 공개 상세 `/meme/posts/114` 404 |
| 5 | 숨긴 글 재공개 → 공개 목록/상세 노출 확인 | 통과 | post `114`가 `PUBLISHED`, image `426`이 `PUBLIC`; 공개 상세 `/meme/posts/114` 200 |

## 2026-10-03 13:25 KST readback

- DB 수량: post total `77`, published `77`, draft `0`, image `310`
- 최신 글:
  - post `114`, board `meme`, status `PUBLISHED`, title `ㅁㄴㄹㅇ`, 출처 없음, published `2026-10-03 04:25:38 UTC`
  - post `113`, board `meme`, status `PUBLISHED`, title `ㅁㄴㅇㄹ`, 출처 없음, published `2026-10-03 04:25:03 UTC`
- 최신 이미지:
  - image `426`, post `114`, status `PUBLIC`, `image/png`, 13,013 bytes, 370x165, public storage key 있음
- 잔여 결함:
  - 고해상도 이미지 실패 시 사용자에게 실패 사유가 표시되지 않는다.
  - 인수 기준의 “이해 가능한 오류 문구” 미충족. 운영 사용 전 수정 필요.

## 2026-10-03 13:27 KST 숨김 readback

- post `114`: `PUBLISHED` -> `HIDDEN_REVIEW`
- image `426`: `PUBLIC` -> `PRIVATE_REVIEW`, public storage key 없음
- 공개 상세: `https://blariyo.com/meme/posts/114` -> 404
- 공개 목록: `https://blariyo.com/meme` -> 200
- DB 수량: post total `77`, published `76`, draft `0`
- UI 불편사항:
  - 관리자 페이지에서 글 번호가 보이지 않아, 조작 대상과 readback 대상의 연결이 어렵다.
  - 운영 인수 기록과 장애 대응을 위해 관리자 목록/상세에 내부 글 번호 또는 복사 가능한 식별자를 표시하는 개선이 필요하다.

## 2026-10-03 13:28 KST 재공개 readback

- post `114`: `HIDDEN_REVIEW` -> `PUBLISHED`
- image `426`: `PRIVATE_REVIEW` -> `PUBLIC`, public storage key 있음
- 공개 상세: `https://blariyo.com/meme/posts/114` -> 200
- 공개 목록: `https://blariyo.com/meme` -> 200
- DB 수량: post total `77`, published `77`, hidden review `0`, draft `0`

## 핵심 5건 판정

- 통과: 출처 없는 글 작성·발행, 작은 이미지 업로드·발행, 숨김 비노출, 재공개 노출
- 실패: 고해상도 이미지 실패 시 화면 오류 문구 없음
- 개선 필요: 관리자 화면에 글 번호 또는 복사 가능한 식별자 표시

## 예약 발행

- 사용자 입력: 35분 예약.
- DB 예약 readback:
  - post `115`, board `meme`, title `예약 - 1`
  - 최초 상태 `SCHEDULED`
  - scheduled_at `2026-10-03 04:34:00 UTC` = `2026-10-03 13:34 KST`
- 폴링 결과:
  - `2026-10-03 04:33:54 UTC`: `SCHEDULED`
  - `2026-10-03 04:34:25 UTC`: `PUBLISHED`
  - published_at `2026-10-03 04:34:02 UTC`
- 공개 확인:
  - `https://blariyo.com/meme/posts/115` -> 200
  - `https://blariyo.com/meme` -> 200
- 판정: 통과. 예약 시각 직후 1회 공개됨.
- 참고: 확인 시점 DB 수량은 post total `79`, published `78`, scheduled `0`, draft `1`. 예약 테스트 중 별도 초안 1건이 존재한다.
- UI 개선:
  - 운영자가 예약 날짜/시간을 직접 key-in하지 않아도 되도록 `+5분`, `+10분`, `+30분` 버튼을 추가했다.
  - 예약 시각 입력 클릭/포커스 시 브라우저 기본 date/time picker를 열도록 `showPicker()`를 연결했다.
  - 검증: `npm run typecheck:web` 통과.

## 예약 취소

- 사용자 입력: `예약 - 2` 예약 후 예약 취소.
- DB readback:
  - post `116`, board `meme`, title `예약 - 2`
  - 상태 `DRAFT`
  - `scheduled_at` NULL
  - `published_at` NULL
- 공개 확인:
  - `https://blariyo.com/meme/posts/116` -> 404
  - `https://blariyo.com/meme` -> 200
- DB 수량: post total `79`, published `78`, scheduled `0`, draft `1`
- 판정: 통과. 예약 취소 후 공개되지 않음.

## 2026-10-03 13:43 KST 로컬 보완

- 범위: PR 진행 중 운영 배포 없이 local/source에서 가능한 인수 결함 보완.
- 브랜치: `feature/admin-acceptance-local-fixes`
- 변경:
  - 고해상도 이미지 업로드 실패 사유에 `40MP 이하` 안내를 추가했다.
  - 업로드 실패 목록에 `aria-live="assertive"`를 부여해 화면 알림성을 높였다.
  - 관리자 검색 목록과 편집 상태 영역에 글 번호를 표시했다.
  - 편집 화면에 `글 번호 복사` 버튼을 추가했다.
- 로컬 검증:
  - `/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node --test tests/upload-errors.test.ts tests/admin-render.test.ts` 통과.
  - `npm run typecheck:web` 통과.
  - `npm run typecheck:tests` 통과.
  - `git diff --check` 통과.
- 미검증:
  - 운영 반영 전이므로 `/admin` 실제 고해상도 업로드 실패 문구는 아직 운영에서 재확인하지 않았다.

## 다음

- 사용자 조작 후 글 제목 또는 공개 URL, 화면 결과, 실패 문구 여부를 기록한다.
- 각 조작 뒤 운영 DB/API를 읽기 전용으로 재조회해 저장 상태와 공개 상태를 확인한다.
