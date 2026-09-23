# Core 배포 후보 준비 — 2026-09-23

[잔여 과정 F](remaining-process.md#f-p0-05-배포-준비와-승인-후-운영-검증)의 로컬 준비 결과다.
**상태: 로컬 이미지·설정 사본·DB 호환 검증 준비 완료 / 최종 release·운영 배포 미승인·미실행.**
이 문서는 기존 운영 상태를 갱신하거나 최종 배포 성공을 선언하지 않는다.

후속 로컬 커밋 상태는 [현재 진행 상황](current-progress.md)과 연결된 커밋 기록을 따른다. 아래 HEAD와
미커밋 표시는 이미지 생성 시점의 식별 정보다. 로컬 커밋을 최종 release 승인·원격 CI 증거로 대체하지 않는다.

## 1. 배포 후보 범위와 핵심 제약

- 기존 정본의 **Core 먼저 운영, 수집 OFF** 범위다. 관리자·공개 화면/이미지·예약·outbox 보완을 포함한다.
- 후보 API는 V005 및 V008 DB에서 Core 업무를 처리했다. 기존 9월 20일 API 이미지도 후보가 V005에 쓴
  게시글·이미지를 다시 읽고 숨김·편집·재공개했다.
- **V008 DB에서는 이전 API readiness가 503이다.** SQL이 추가형이어도 이전 앱의 정확한 최신 버전 검사를
  통과하지 못하므로, V006~V008 적용 후 기존 이미지로 단순 복귀할 수 있다고 가정하지 않는다.
- 이번 Core 후보의 권고 경로는 **운영 ledger V005 확인 → DB 변경 없음 → API/Web만 교체**다.
  실제 ledger가 다르면 중단하고 호환 검증을 다시 설계한다. 문서상 V005를 운영 DB 실조회 결과로 대신하지 않는다.
- 수집 기능 활성화와 V006~V008·Collector schema 적용은 별도 release다. V008을 지원하는 복귀 이미지,
  신규 쓰기의 이전 앱 호환성, 백업/복원과 최소 권한을 먼저 검증한다. readiness 우회나 ledger 수정으로 해결하지 않는다.

## 2. 로컬 산출물 식별

| 항목 | 고정한 값 / 상태 |
| --- | --- |
| Git HEAD | `8cda23e3e3681c9c8fcc777e189496b337c09e17` + 미커밋 변경. 이 SHA만으로 후보 내용을 식별하지 않음 |
| 후보 source SHA-256 | `00630e561cb9ad1b9a1edc4c6cafad1626c6ef9ab1be91f3f78aab36936cdfa5` |
| image 묶음 | `.local-data/release-preparation/blariyo-app-images-20260923T124646Z-ij42qk3e/` |
| archive | `images.tar`, **162,917,888 bytes** |
| archive SHA-256 | `6c7853f0d3ec9649c85f439794686f2990cb5204db29a25b73f7d9f840ddb61f` |
| runtime 설정 사본 | `~/.config/blariyo/application-config-ZzkcSI/`; 기존 입력을 보존한 새 사본, 폴더 700·파일 600 |
| 최종 release SHA·원격 CI run | `(미정)` — 별도 commit/push 후 최종 SHA 검증 필요 |
| GHCR API/Web digest | `(미정)` — 아래 값은 로컬 archive의 이미지 식별자이며 registry 게시 증거 아님 |
| 서버 release 경로·최근 백업 | `(미정)` — 실제 서버/백업 조회와 승인된 stage 이후 기록 |

| 이미지 | local image ID | config digest |
| --- | --- | --- |
| API | `sha256:0f545f6f6729796d1e0b56479ec4ad1dff6b4be9ae9212fd8a6532c68df37b43` | `sha256:2664d59f6114a6d1495e830f7ac965aedf9690ad6d5844d66b4fcdeb04bf2c87` |
| Web | `sha256:71bbda4a3348425e7b3070aecd1f07cbd3f41b21c73d2fd00fe6d0647d9207f7` | `sha256:b784ecdbb6033b9886d9c1516ecf552ad72fa13e0a372dc7645d4b9547b303da` |

두 이미지의 플랫폼은 linux/amd64, Node 24.18.0, 사용자 UID 1000이다. 현재 Docker image ID는 OCI index ID이며
config digest와 구분한다. `manifest.json`·`source-manifest.json`·archive 내부 hash 연결까지 확인했다.
소스가 바뀌면 같은 후보라고 부르지 않고 새 snapshot/image로 검증한다.

이전 묶음 `~/task_list/blariyo-app-images-20260920T005324Z-rhn14v8g/`도 로컬 archive 검증을 다시 통과했다.
이전 API ID는 `sha256:d87ffce2b97effad59ee60b8c90a0b7462b8f3f2ddeaf15977f0eab4c45a913f`다.
이는 [기존 운영 기록](../operations/current-status.md)에 연결된 로컬 사본이며 현재 서버 image를 재조회한 결과는 아니다.

## 3. 실제 검증

| 검증 | 결과와 범위 |
| --- | --- |
| 후보 build·archive | API/Web amd64 build, 비루트 실행, Sharp PNG, source 불변·archive/hash 연결 통과 |
| 동일 image 격리 Docker | production Core/Web, 합성 서명 Access JWT·가짜 R2/캐시, 정책·발행/숨김·운영 명령 통과 |
| dump/restore | 격리 custom dump 복원 뒤 게시글/상태 이력 대조 통과. 실제 운영 백업이나 전체 데이터 복구 훈련을 대신하지 않음 |
| API 종료/maintenance | readiness·쓰기 거부·SIGTERM·DB 연결 반환 통과 |
| V005→V008 호환 행렬 | 아래 5단계 통과. 실제 이미지·격리 PostgreSQL·공유 시험용 private/public object 사용 |
| 기존 비공개 입력 | 로컬 파일 권한·형식·키 분리·앱 DB/R2/연락처/운영자 파서 통과. 비밀 원문 비출력, 외부 호출 없음 |
| 새 runtime 설정 | manual URL·Discord·batch review의 API/Web flag 모두 명시적 false. 합성 Compose raw 값·mount/network·자원 제한 검사 통과 |
| 정리 | 각 시험의 임시 DB container/network/volume 제거. 후보와 이전 image/archive는 검토·복귀 자료로 보존 |

| 단계 | 실제 앱 / DB | 결과 |
| --- | --- | --- |
| 1 | 이전 API / V005 | readiness 200, 이미지 업로드·preview·발행·예약 취소·worker |
| 2 | 후보 API / V005 | 200, 이전 콘텐츠/이미지 읽기·숨김·편집·재공개 + 새 이미지 글·예약 취소·worker |
| 3 | 이전 API / V005, 후보가 기록한 데이터 | 200, 후보 콘텐츠/이미지 읽기·숨김·편집·재공개 + 새 이미지 글·예약 취소·worker |
| 4 | 후보 API / V008 | 200, 같은 Core 업무·worker |
| 5 | 이전 API / V008 | **503 확인**, 쓰기 실행 0·게시글/상태 이력 수량 불변 |

호환 행렬의 API는 이미지 내 실제 Nest HTTP 경로와 제한 app DB role을 사용한다. 읽기 전용 root filesystem,
256MiB memory/384MiB memory+swap, pids 128, cap drop, no-new-privileges를 적용했다. 운영과 같은 **API 자원 옵션 일부**를
사용했지만 실제 production Compose 전체·Web 메모리·실제 Access/R2·동시 부하·장시간 OOM 검증은 아니다.
이 행렬은 합성 local storage를 주입한 앱 검사이고, production config의 검사는 위 Docker 묶음과 구분한다.

## 4. Migration과 복귀 검토

| 파일 | 변화 | 이번 Core 후보 적용 |
| --- | --- | --- |
| V001~V005 | 기존 schema·불변 checksum | 기존 ledger/hash 확인만. 재초기화하지 않음 |
| `V006__collection_content.sql` | legacy 후보 본문 열/제약 추가 | 적용하지 않는 권고안 |
| `V007__collection_discovery.sql` | discovery policy·LIST 상태/요청·source key 확장 | 적용하지 않는 권고안 |
| `V008__batch_review.sql` | API 검수·요청 receipt와 상태 trigger | 적용하지 않는 권고안 |
| Collector V001~V006 | 별도 batch/queue/framework ledger | Core 배포에 포함하지 않음 |

`node .../commands/migrate.js up`은 보류 파일까지 적용하므로 Core V005 유지 배포에서 실행하지 않는다.
초기 `deploy/postgresql/migrate-from-mac.py`는 V001~V005 신규 설치 전용이며 후속 migration 도구로 쓰지 않는다.
현재 V007 down은 거부 계약이 있으므로 V008→V007→V005 자동 역 migration 경로를 계획하지 않는다.

복귀는 V005가 유지되고 이번 검증과 같은 Core 쓰기 범위일 때 이전 API/Web image와 호환 설정·부팅 helper로
전환하는 후보 절차다. 실제 서버의 데이터·현재 digest·설정·timer를 확인하기 전에는 운영 rollback 검증 완료가 아니다.
수집의 긴 본문·새 이미지 경로·신규 상태 등까지 이전 이미지 호환이라고 확대하지 않는다.

## 5. 배포 전 남은 입력과 순서

1. 기능별 diff·최종 source 범위 검토, 운영자 수동 인수. [수동 인수 기록](operator-acceptance.md)은 미실행이다.
2. 별도 승인된 commit/push 후 **최종 SHA**의 verify·collector·API/Web images 성공과 run/digest 기록.
3. 서버 identity·현재 release/image·DB ledger/checksum·현재 비밀 파일 mount/권한·feature flag 읽기 대조.
   새 설정 사본의 `NUXT_TRUSTED_CLIENT_IP_HEADER`는 준비 기본값이므로 현재 신뢰 헤더 설정과 비교하고 확정한다.
   신규 설정이 기존 서버 운영값을 모두 보존한다고 추정하지 않는다.
4. 최근 18시간 이내 성공 백업과 다운로드/격리 복원 근거, 이전 image·설정·부팅 helper 보관 확인.
5. 별도 승인 범위에서 stage·API→Web 순차 교체. DB V005 유지 조건이 성립하면 migration을 실행하지 않는다.
6. 실제 Access 허용/거부, 업로드·발행·예약/취소·숨김/회수·재공개, timer 단일 실행·알림·백업 확인.
7. 새 release의 부팅 helper·timer 참조, 새 정적 자산 캐시 조건을 반영하고 복귀 절차를 확인한다.

실제 명령은 [배포 실행서](../operations/deployment-runbook.md)를 따른다. 이 문서는 서버 전송·DB 변경·배포·
콘텐츠 공개 권한을 추가하지 않는다. GHCR 게시와 서버 배포는 별도 단계다.

## 6. 재현과 실행 이력

```sh
python3 deploy/application/prepare-images.py --build --output-parent .local-data/release-preparation
python3 deploy/application/test-release-compatibility.py --previous-image sha256:검증된이전ID --candidate-image sha256:검증된후보ID
node deploy/application/test-runtime-config.cjs
node deploy/application/prepare-runtime-config.cjs
# 새 비공개 설정 사본이 필요한 경우에만:
node deploy/application/prepare-runtime-config.cjs --create
```

image 인수는 실제 64자리 hex ID여야 하며 테스트는 임의 tag·원격 호스트·기존 DB 인수를 받지 않는다.
새 [호환 검사](../../../deploy/application/test-release-compatibility.py)와
[실제 API 시나리오](../../../deploy/application/fixtures/release-compatibility.mjs)를 함께 보관한다.

Git 제외 증거는 `test-results/release-preparation/`와 후보 image 폴더의 build·smoke 로그에 있다.
첫 호환 시험은 PostgreSQL 초기 임시 서버를 준비 완료로 판단해 실패했다. TCP 최종 서버 확인으로 수정했다.
두 번째는 공개 글을 바로 편집하는 잘못된 시험 순서로 409를 받았다. 제품 규칙에 맞춰 숨김→편집→재공개로
고친 세 번째 실행에서 5단계가 통과했다. 세 실행 모두 소유 임시 자원을 정리했고 제품 상태 전이 규칙은 변경하지 않았다.
