# M0 운영 상태와 남은 작업

- 마지막 운영 확인: **2026-09-23 22:54:49 KST** ([앱 배포 기록](../../worklog/2026-09-23/release/production-deployment-5c581c2.md), [DB·콘텐츠 반영 기록](../../worklog/2026-09-23/release/production-db-promotion.md)). 2026-09-24 문서 갱신에서는 서버·DB·CI를 다시 조회하지 않았다.
- 판정: **API/Web 배포와 DB·콘텐츠 공개는 당시 검증 완료. 실제 MFA 관리자 업무 인수·장기 운영·복구 훈련은 남아 있다.**
- 최초 2026-09-20 구성 근거: [TASK-01~20 목록](../../worklog/2026-09-23/directory-reorganization/previous-task-list-index.md), [TASK-19 배포 증거](../../worklog/2026-09-20/infrastructure-setup/TASK-19.md)
- 역할: 현재 실행 결과를 찾아가는 안내. 제품·법무·인프라 정본을 대신하지 않는다.

## 현재 구성

| 항목 | 배포 결과 |
| --- | --- |
| 공개 웹 | `https://blariyo.com/` → `/meme`, `www` → 대표 도메인 308 |
| 공개 이미지 | `https://media.blariyo.com/`, public R2 버킷만 연결 |
| 서버 | AWS Lightsail 서울 x86_64·2GB, swap 2GB, 고정 IP 미사용 |
| 연결 | Cloudflare → Tunnel → Nginx → Nuxt Web/BFF → Nest Core → PostgreSQL 18 |
| 포트 | DB·Core·Web·Nginx host port 미공개. SSH 관리 경계와 별도 |
| 방식 | 단일 VM Docker Compose 교체. 블루그린·무중단 배포 아님 |
| 운영 이미지 | Git SHA `5c581c2ad82a9f1565ac53349fbaae7afed9c9cd`의 GHCR API/Web digest를 검증해 배포. 서버 build 없음 |
| 마지막 확인 release | `/opt/blariyo/application/release-5c581c2-db-v008-20260923`; 부팅 helper의 로컬 source도 이 경로를 참조. 현재 서버 값은 재조회 필요 |
| 기능 | M0 Core 공개. 회원·광고·GA4·카카오는 비활성. 관리자 batch 검수는 활성, URL·Discord 접수와 자동 수집 실행은 비활성 |
| 연락처 | 기존 비공개 입력 재사용. Cloudflare Email Routing → 일반 Gmail |

## 확인된 결과와 한계

| 범위 | 확인한 증거 | 완료로 확대하지 않는 범위 |
| --- | --- | --- |
| DB | 9/23 API V005→V008, Collector V001–V006 적용·ledger/checksum 및 업무 데이터 17테이블 1,937행 readback. 적용 전후 암호화 백업의 R2 실다운로드·해시·격리 PostgreSQL 18 복원 통과 | 현재 ledger/권한·최신 백업·새 VM/media 복구 |
| CI·앱 | 해당 SHA의 원격 CI `verify`·`collector`·API/Web `images` 성공, GHCR digest 확인 후 운영 교체. DB·Core·Web·Nginx healthy | 현재 로컬 HEAD의 CI 성공이나 자동 CD, 2GB 최대 수용량·무중단 보장 |
| 정책 | TERMS/PRIVACY v0.1, 2026-09-20 시행, SQL 본문 해시·공개 API·화면 확인 | 후속 기능 법무 gate·개별 사건 면책 |
| 공개 경로 | 9/23 게시글 74건 공개, 목록 4페이지·상세 API 74건·본문 786블록·이미지 308개 전수 대조, 대표 상세 HTML 7건·Chrome 표본 확인. 정책·health HTTPS와 redirect 확인 | 현재 실시간 수량·후속 변경·전체 브라우저 기기 |
| 관리자 | 이메일 Allow, MFA 6시간, 익명·위조 JWT의 관리자 경로 Access 302, 내부 경로 외부 404 | 실제 TOTP 완료 후 앱 운영자 매핑·작성·업로드·발행·숨김 |
| R2/CDN | 세 버킷별 키 검사, 앱 어댑터 private→public 복사, 9/23 공개 이미지 308개 다운로드·크기/SHA-256 대조 | CDN HIT·전체 전파·브라우저 CORS·교차 객체 읽기/쓰기 차단 전체 검사 |
| 작업 | 예약 발행·outbox·cleanup timer 설치, 수동 단발 실행 | 실제 예약 게시글 장기 처리·외부 실패 알림 |
| 로그 | 전용 rsyslog, root 접근 제한, 최대 7일 보관 timer, 실제 수신·합성 만료 파일 삭제 | 제공자 감사 기록·호스트 로그·DB 운영 이력은 같은 TTL 대상 아님 |
| DB 백업 | 하루 두 번 age 암호화→R2. 9/23 배포 전·DB 반영 전후 백업의 실제 다운로드 SHA-256·격리 PostgreSQL 18 복원·정책/ledger/수량 대조 | 다음 배포 전 최신 백업, 새 VM 전체 복구·RTO, media 전체 복제, 7일 지난 실제 object 삭제 관찰 |
| 부팅 | 서비스·timer enabled/active | 실제 VM 재부팅 시험 |
| 보안 보강 | JS 9개 쿼리 무관 캐시·Cloudflare $1 비용/DDoS 알림. 게이트웨이 오류 `no-store`에 더해 9/23 배포 후 공개 HTML/JSON 404·Web 직접 JSON 404 `no-store` 확인 | 새 자산의 쿼리 무관 캐시 규칙·구 탭 자산 보존·다른 4xx/5xx·장기 관찰 미검증. [과거/후속 기록](security-protection-status.md) |

위 공개·DB 수량은 **9월 23일 관측값**이며, 새 발행·수정에 따라 달라질 수 있다. 수집 항목은 당시 108건(FETCHED 104·FAILED 2·BLOCKED 1·SKIPPED_POLICY 1)이다. 관리자 batch 검수 API/Web flag는 당시 `true`였고, 내부 service의 108건 조회·16개 출처 이미지 미리보기를 확인했다. 실제 MFA 세션의 관리자 조작은 별도 인수 대상이다. URL 접수·Discord 접수·자동 수집은 활성화하지 않았다. direct raw/media/report/queue 보존·고지 계약(QD-04)은 미정이며, batch 검수 활성화만으로 계약이나 운영 인수가 완료된 것은 아니다.

9월 23일 DB 반영 뒤 **9월 20일 구 API는 V008에서 readiness 503**이다. 앱만 되돌릴 때는 V008 호환성이 확인된 직전 `5c581c2` Core release를 기준으로 한다. 실제 rollback은 시험하지 않았으며 DB 전체 복구는 별도 결정이다. 다음 배포 전 [배포 실행서](deployment-runbook.md)에서 ledger·설정·이미지·백업·호환성을 다시 대조한다.

과거 TASK의 “배포 대기”는 당시 단계의 결과다. 현재 상태를 이유로 과거 기록을 소급 변경하지 않는다.
정책 v0.1 본문을 덮어쓰지 않으며 변경이 필요하면 새 버전으로 검토·발행한다.

## 다음 작업

1. 운영자가 Access MFA를 직접 완료한 뒤 관리자 권한과 업로드·발행·숨김 흐름을 검증한다. 인증 코드·쿠키를 채팅에 보내지 않는다.
2. 맥에 보관된 DB 복구키를 별도 안전한 장소에도 보관한다. 서버에는 암호화 public recipient만 지속 보관한다.
3. 최신 백업 시각·timer 실패·자원을 관찰하고 외부 가용성/실패 알림을 구성한다.
4. 7일 보관 관찰, 월간 DB 복원, 별도 일정의 VM 재부팅·새 VM 복구를 수행한다.
5. AWS 비용 알림을 확인한다. 9월 20일 1차 보강 조회에서는 무료 플랜·잔여 크레딧 $120·2027-03-15 종료 표시를 확인했다. 이는 현재 잔액 조회가 아니다. 결제/요금제는 변경하지 않았다.
6. [보안·비용 보호 적용 계획](../system-design/09-security-cost-protection-plan.md)의 정적 JS 9개 캐시·Cloudflare 비용/DDoS 알림과 게이트웨이 오류 `no-store`를 유지한다. 9월 23일 앱 배포 후 공개·Web 직접 JSON 404도 `no-store`였다. 새 JS/CSS 파일명의 쿼리 무관 캐시는 기존 9개 규칙에 자동 포함되지 않으므로 별도 관리 작업이다. 정상 이용·공유 IP·관리자 흐름 검증 후 요청 제한을 판단한다.
7. 다음 후보의 SHA별 원격 CI·GHCR digest와 운영 배포를 다시 대조한다. `5c581c2`의 CI 성공·수동 서버 배포는 9월 23일 기록으로 확인했고, 현재 workflow의 자동 CD는 미구현이다. 2026-09-26 [03:00 KST 설계](../system-design/10-nightly-deployment.md)와 [DPL task](../implementation-tasks/nightly-deployment.md)를 추가했으나 운영 활성화는 하지 않았다. [CI/CD 후속 기록](../../worklog/2026-09-20/local-ui-cicd/TODO-CICD-DEPLOY.md)은 당시 TODO로 보존한다.

9월 20일 보안 후속 작업은 당시 요청의 코드·설정·문서, SSH 서버 점검, 공개 HTTP 검증 범위에서 마감했다.
당시 남긴 관리 콘솔/API 설정과 재개 조건은 [보안 작업 기록](security-protection-status.md#7-이번-작업-마감과-남은-일)을 따른다.
이번 9월 24일 문서 검토에서 해당 작업을 새로 실행한 것은 아니다.

## 과거 로컬 후속 작업 — 9월 20일 기록

당시 앱 JSON 오류의 `no-store` 보완을 구현하고 production build·로컬 HTTP 회귀 검사·타입/정적 검사를
통과했다. 9월 23일 운영 배포 후 Web 직접 JSON 404의 `no-store`를 확인했다. 당시의 로컬 완료/운영 대기
기록을 현재 미배포 상태로 읽지 않는다.
[검증 범위와 배포 대기 항목](security-protection-status.md#9-앱-원본-json-오류-보완--로컬-완료-운영-배포-대기)을 따른다.

2026-09-20 로컬에서 M0 공개 화면을 시각 기준에 맞춰 수정하고 GitHub CI workflow를 작성했다.
실제 HOT 25건은 당시 로컬 DB의 DRAFT로 저장했다. 그 작업 자체에서는 운영 앱 배포·운영 콘텐츠 발행을 하지 않았다.
9월 23일 별도 DB 반영·발행의 수량은 위 최신 운영 기록을 따른다.
[화면 검증](../testing/ui-wireframe-review-20260920.md), [콘텐츠 저장](../../scripts/content/README.md),
[배포 실행서](deployment-runbook.md), [배포 정책](deployment-policy.md)을 따른다.

## 환경 설정 기준

local/dev/stage/prod `.env` 예시와 이미지 URL 조립 규칙은 [환경별 설정과 이미지 URL 계약](environment-configuration.md)을 따른다.
공개 이미지는 `IMAGE_ORIGIN + '/' + publicStorageKey`로 계산한다. 공개 게시글 이미지는 `content/published/posts/{postId}/{imageId}-{sha256}.{ext}` key를 사용하고, 수집용 `collect/media/*`는 public origin에 직접 노출하지 않는다.

## 운영 진입점

- [서비스·정기 작업 확인과 되돌리기](../../deploy/operations/README.md)
- [백업 실행·복원 시험·복구키 보관](../../deploy/backup/README.md)
- [앱 설정·image·서버 보관 도구](../../deploy/application/README.md)
- [PostgreSQL 설치·migration·정책 seed](../../deploy/postgresql/README.md)
- [현재 공개 정책](../legal/m0-core/README.md)
- 공개 읽기 점검: `python3 deploy/application/check-public.py`

설치·발행 명령은 조회 명령이 아니다. 공개 점검을 위해 설치·정책 발행을 반복 실행하지 않는다.
