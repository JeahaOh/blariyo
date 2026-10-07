# 운영 스키마·Web·API 동시 배포

- 요청: 운영 스키마 배포와 함께 Web/API도 배포.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 후보: `1c255a9ba261903c6a64804edb29ef0fa0b70da1`
- 상태: 종료 — 운영 스키마·Web/API 배포 및 읽기 검증 완료 / 갱신: 2026-10-07 20:15 KST
- 변경 경로: 이 기록 폴더, `deploy/operations/start-application.py`, `docs/operations/deployment-policy.md`, `docs/operations/deployment-runbook.md`.
- 범위: 검증된 release→main GUI 병합과 Web/API 이미지, API V011~V013 migration, 백업·권한·공개/관리자 조회 smoke.
- 기존 변경 보존: 지난 운영 시험 planning/system-design 수정과 worklog, 다른 세션의 discord-admin-review를 덮어쓰거나 배포 후보에 임의 포함하지 않는다.
- 깨끗한 후보 검증과 release 브랜치 통합은 임시 독립 clone에서 수행한다. 공유 폴더의 브랜치·index·진행 중 로컬 서버를 바꾸지 않기 위한 배포용 checkout이며 Git worktree는 만들지 않는다. 정확한 경로와 검증 SHA를 후속 기록한다.
- 운영 기준선: Web/API main `3e3e1d0b79cd71d4ff3b6969fa6282b14da7fcf4`, API V010, Collector V015. 수집113·게시글83건 보존.
- 운영 구 API의 REVIEWING 전이를 V011이 바꾸므로 앱/스키마를 함께 전환한다. V013 down은 COMMON_CODES_ROLLBACK_REQUIRES_HANDOFF로 중단되며 구 API는 V013에서 readiness 호환이 아니다. 단순 구 이미지 복귀를 복구 수단으로 보장하지 않는다. 사전 백업과 새 앱 검증을 선행하고, 적용 후 장애는 원인에 따른 전진 수정 또는 별도 범위의 DB 복구 인계로 처리한다. 공개 데이터 자동 삭제·전체 DB 복원은 하지 않는다.

- 배포 checkout: `/private/tmp/blariyo-production-release-c6u3n5ne`, 담당 Codex, `feature/deploy-20261007` → `release`; 앱 source 변경 없이 후보 검증·통합만 수행.

- 정식 경로 진행: 후보 hook·migration-contracts·test:ci 통과 후 release를 `1c255a9`로 fast-forward/push. [PR #17](https://github.com/JeahaOh/blariyo/pull/17), [PR CI](https://github.com/JeahaOh/blariyo/actions/runs/37610919403) 실행 중. main 병합·운영 앱 교체는 아직 하지 않았다.

- 20:02 KST 새 백업: `db/daily/20261007T110251Z-534a0de98ec4.dump.age`, SHA-256 `4ee57ccf258e9068651e42256c146783dd698dd0d7994b637134654444db19ae`, 542,791bytes. R2 다운로드·해시·age 복호화·격리 PostgreSQL18 복원 통과. 복원 DB에서 API V011~V013 SQL 실행, source 공통코드21, 게시글·수집·검수 전체 행 해시 보존 확인. 복구키는 서버 파일로 저장하지 않았고 격리 DB를 정리했다.
- PR CI #57: quality 1m33s, integration 4m24s, browser 6m6s, collector 4m53s 및 verify 성공. PR images skip은 정상 조건이다.
- GitHub 웹 Create a merge commit으로 PR #17 병합 확인. main `b57724dbb6309fc07f76c49e4a9e69d5708215cd`; 부모는 기존 main `3e3e1d0`와 release `1c255a9`, 후보와 Git tree 동일.
- [main CI #58](https://github.com/JeahaOh/blariyo/actions/runs/37611741318) 및 GHCR 이미지 게시 대기.

## 운영 반영 결과

- [main CI #58](https://github.com/JeahaOh/blariyo/actions/runs/37611741318) quality·verify·API/Web images 성공. integration/browser/collector는 성공한 PR #57의 동일 merge tree 증거를 재사용했으며 main 재실행 성공으로 표기하지 않는다.
- 운영 SHA: `b57724dbb6309fc07f76c49e4a9e69d5708215cd`.
- API: `ghcr.io/jeahaoh/blariyo-api@sha256:5d6cabb846c2c859373606959ec45404ff7fa532f00e87d65eaffdc2052e3204`.
- Web: `ghcr.io/jeahaoh/blariyo-web@sha256:c5a5fc8dc2a333786fb9def2957d4e46b90d36e6b80c248c45946f5b55468a02`.
- CI digest = 서버 pull = 실행 image 일치. release: `/opt/blariyo/application/release-b57724d-schema-v013-20261007T111102Z`.
- 20:11:44 작업 타이머 중지 → 20:11:45 앱 중지 → 20:11:47 V011~V013 적용·정본 권한 재적용 → 20:11:59 Web/API healthy 및 타이머 재개.
- API V013 / Collector V015. 게시글83·수집113건과 게시글·수집물·검수 전체 행 해시 보존. source 그룹 공통코드21, 실패 삭제 함수 EXECUTE와 backup SELECT 확인.
- API/Web/DB/Nginx healthy, OOM 없음·host port 없음. API READY, 가용 메모리1140MiB. 기존 환경·Compose·logging·비밀 파일 내용 해시 유지.
- 서버 부팅 helper·nightly state·저장소 부팅 helper를 새 release로 갱신. publish/outbox/cleanup/backup/nightly 타이머 active/enabled.
- 관리자 Core 내부 읽기 검사: 공통코드21, goodgag 목록13건, 오늘 수집물 상세·fetchedAt, 비공개 이미지 preview200 확인. 관리자 쓰기/발행은 실행하지 않았다.
- 공개 HTTPS·정책·상세117·HTTP/www 이동·익명/위조 관리자 Access 경계 통과. 공개 HTML/JSON404 no-store, JS/CSS4개 원래 URL/쿼리 변형 hash·immutable 일치. 공개 목록은 실제 브라우저 렌더링도 확인했다.
- 근거: [서버 검증](evidence.json), [공개 검사](public-verification.txt).

## 중단 시간·미검증

- 앱 중지 완료부터 두 앱 healthy까지 **14.03초**. 이는 실행 단계 시간이며 정확한 사용자 중단 시간을 뜻하지 않는다.
- 연속 요청에서 502 및 timeout을 관찰했다. 측정용 `deployprobe` query를 API가 허용하지 않아 앱 복구 뒤400이 반환됐다. 따라서 해당 연속 측정으로 HTTP200 복구 시각·정확한 중단 구간을 확정하지 않는다. 정상 URL로 별도 공개 목록/상세200을 확인했다. 실행 스크립트에는 당시 probe를 보존한다.
- 관리자 브라우저는 Cloudflare 재로그인 단계여서 MFA 이후 화면·승인/발행 쓰기 인수는 미실행. 내부 API 읽기/preview 통과와 구분한다.
- V013은 자동 down 불가. 실제 DB rollback·VM 재부팅·장기 관찰은 미실행.
- 운영 정기 Collector timer는 이번 배포에서 활성화하지 않았다. 로컬04:30/16:30 일정은 유지한다.
- 다른 세션의 신규 `discord-review-plan` 기록은 담당·종료 상태를 확인하고 보존했다.

## 최종 점검·Git 기록

- Web 직접 JSON404 no-store 확인. 임시 migration/restore 컨테이너와 배포 잠금 없음. API81.67MiB·Web49.11MiB 사용.
- publish/outbox 최근 실행 성공. cleanup 타이머는 active/enabled이나 service의 마지막 실행은 **이번 배포 전 2026-10-07 12:15 KST 실패**(`JOB_CLEANUP_FAILED`, exit1)다. 배포 후 성공으로 덮어 쓰지 않는다. 삭제 동작인 cleanup을 검증 목적으로 강제 실행하지 않았다. 별도 원인 확인·복구가 남는다.
- 로컬 배포 tag: `prod/2026-10-07-2011-KST-b57724d`, annotated tag 대상은 실제 운영 main SHA. 이번 요청은 태그 원격 게시를 명시하지 않아 tag push는 하지 않는다.
- 배포 기록·실행 증거·부팅 helper·운영 안내의 이번 변경만 feature에서 커밋한다. 다른 세션 기록과 이전 수집 시험 dirty 변경은 포함하지 않는다. 이 후속 기록 커밋은 운영 앱 SHA가 아니다.
