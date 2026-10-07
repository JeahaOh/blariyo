# Discord 검수 운영 반영 — 2026-10-08

- 담당: Codex, 상태: 종료, 갱신: 2026-10-08 00:11 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`.
- 범위: 검증된 main 이미지의 운영 반영, V014 migration, Discord worker 실행 예약, 실제 수집→Discord 확인 및 운영 문서 갱신. 변경 경로는 이 작업 기록과 `docs/status.md`, `docs/roadmap.md`, `docs/operations/{current-status,deployment-policy,private-files-and-recovery}.md`다.
- 이전 기록: [10월 7일 구현·검증](../../2026-10-07/discord-review-implementation/README.md).
- 기존 범위 밖 `worklog/2026-10-06/discord-admin-review/`는 보존한다. 커밋 후 변경은 작업 기록만 있었으며 구현 입력은 그대로다.

## Git·검증 기준

- 구현/release: `7df63deef5a48b836841dc96d4afb69aadee4a60`.
- [PR #18](https://github.com/JeahaOh/blariyo/pull/18): 전체 CI #59 성공 후 GitHub 웹 GUI 병합 확인.
- 배포 후보 main: `f8067abd757d404599d6f00e00239a7ab3afff43`, tree `d89f0768fd060ab91b4c105b8536ce69e6e54099`는 검증한 release와 동일.
- [main CI #60](https://github.com/JeahaOh/blariyo/actions/runs/37641160387): 전체 성공, 3분3초. 동일 tree·성공 PR run #37640074377의 integration/browser/collector 증거를 재사용했고 main에서 quality·verify·API/Web 이미지 생성을 실행했다.
- 로컬 최종 검증: 품질 14검사, API 149건, Docker 브라우저 88건 통과. Collector 304건·DB readback 20건 통과. 실제 로컬 Discord 전송·관리자 반려·삭제만 재시도 후 DONE 확인.

## 운영 반영

- 00:02:33 stage, 00:02:41 API V014 migration 완료, 00:02:53 API/Web healthy, 00:03:04 검수 worker 예약 활성화. 기존 수집04:30·15:30 예약 유지.
- release: `/opt/blariyo/application/release-f8067ab-discord-v014-20261007T150233Z`.
- API: `ghcr.io/jeahaoh/blariyo-api@sha256:f1f6acc002acf787cf0bb4e3be73c209e7d9b42533c1dc06d1ceaded1f80879f`.
- Web: `ghcr.io/jeahaoh/blariyo-web@sha256:dce4fea35e21395b9ba61c432966d97b9e6f9c585fec43f58edb41213ef0ebca`.
- 원격 CI와 서버 pull/runtime digest 일치. API/Web의 Discord flag true, API secrets read-only mount, 전용 worker check 성공.
- DB 반영 전후 게시글83건·수집118건과 게시글/수집/검수 내용 해시 동일. API V014·Collector V015, API 새 검수표 쓰기 허용·BATCH 쓰기 금지 확인.
- 사전 백업: 2026-10-07T14:25:51Z, 552,761bytes, SHA-256 `aefcd65c789457c8582061f9fa836fdd3dc889c9fe93f15a03311841c0f04a48`.
- 사후 백업: 2026-10-08 00:05:26 KST, 582,233bytes, SHA-256 `bc5baab752bae0204a67c6cef24657893051b359327cb9f40d2664540c65685b`. 기존 암호화→R2 service Result=success/exit0. 이번 두 백업의 별도 다운로드·복원은 미실행이며 이전 배포의 복원·로컬 schema 복원 결과와 구분한다.
- 공개 점검 `python3 deploy/application/check-public.py`: 공개 페이지·정책API·익명/위조 관리자 Access·내부 경로 차단·HTTPS/www 이동 모두 통과.
- 교체 연속 조회21회 중502 7회(00:02:38.909~00:02:47.402), 400 14회. probe의 지원하지 않는 `deployprobe` query가 입력검증에서400이 된 것이므로 정상복구 시각/가용성 비율 측정에는 사용할 수 없다. 별도 유효 경로 smoke와 전체 공개 점검의 성공으로 복구를 확인했다. 무중단으로 보고하지 않는다.
- 원본 실행 증거: [deployment-evidence.json](deployment-evidence.json), [final-runtime.json](final-runtime.json).

## 실제 운영 수집과 Discord

- 기존 수집기로 `theqoo`, 최대1건/1페이지 실행. run `5d092cd0-2e4b-4ee2-9d16-67770a4c4afe`, 00:03:10~00:03:51 KST, COMPLETED/exit0, 발견1·수집1·중복0·실패0, OOM 없음·최소 호스트 가용 메모리995.4MiB.
- 수집 item `e7d008b6-cd94-4bae-aa57-e4f08264dc03`, FETCHED. 수집 총119건, 게시글83건 유지.
- [운영 검수 #1](https://discord.com/channels/1553235765532827748/1553236861068247172/1557408249014128641): 헤드1개, 스레드에 링크1·문장2·이미지1. 이미지16,704bytes WEBP/1124×1905. Chrome에서도 헤드·본문·반응을 확인했다.
- delivery `2510fbc3-05c0-4424-afd4-36ade154f106`: READY 2026-10-08 00:04:33.756 KST, expires 2026-10-10 00:04:33.756 KST. 정확히48시간, 전체part SENT/seeded, 오류 없음.
- Discord REST로 메시지5개 재조회: 모두 봇 작성·👍1/❌1·me=true. 검수자의 반응은 없으며 업무 명령0건·발행0건. 실제 글은 승인하지 않은 상태로 보존했다.
- [production-readback.json](production-readback.json)에 본문·token 없이 상태/전송/반응/이미지 메타데이터만 기록했다. 화면은 Git 제외된 `.local-data/discord-review/production-ready.jpg`.

## 예약과 복구

| 환경 | 수집 | 반응 판정 | 전송·명령·삭제 복구 | 확인 |
| --- | --- | --- | --- | --- |
| 운영 | 04:30 / 15:30 KST | 07:30 / 17:00 KST | 유지보수 종료60초 후 | 세 timer enabled/active, 다음 수집10/8 04:30·검수07:30 |
| 로컬 | 04:30 / 15:30 KST | 07:30 / 17:00 KST | 60초 간격 | LaunchAgent 등록, API READY, 유지보수 exit0 |

- [local-runtime.json](local-runtime.json)에 로컬 예약을 확인했다. 개발 API/Web 지속 실행과 AC 전원 절전 방지 agent가 running이다. 로컬 실행은 컴퓨터·네트워크가 켜져 있어야 하며 운영은 이 컴퓨터와 독립적이다.
- 운영 검수 worker jar hash 확인, 기존 수집과 별도 lock/컨테이너, 제한256MiB/0.5CPU. 서버 관측 가용1151MiB·swap사용37MiB.
- 관리자 우선·TX 밖 after-commit 삭제·삭제만 재시도는 로컬 실제 관리자 반려/삭제 복구와 회귀에서 확인했다. 운영 실제 승인·발행/반려로 기존 콘텐츠를 변경하지 않았다.
- 비공개 파일7개는 운영 `/opt/blariyo/discord-review/secrets/`, 로컬은 `~/.config/blariyo/discord/local/`와 기존 actor-secret 참조. Gitignore 및 [복구 목록](../../../docs/operations/private-files-and-recovery.md) 유지.

## 남은 관찰과 한계

- 10/8 04:30 정기 수집·07:30 검수는 아직 미래다. 수동으로 실제 수집→Discord 전송을 확인한 결과와 구분한다.
- 사람의 실제 승인/발행, 벽시계48시간 경과 후 자동반려, 장기 장애·2회 삭제 실패의 운영 관찰은 아직 없다. 해당 조건은 로컬 회귀로 검증했다.
- 비공개 파일의 별도 장치/계정 암호화 백업과 포맷 후 복원 시험은 미완료다. 위치 통일·목록·Gitignore는 완료했지만 백업 완료로 보고하지 않는다.
- 제목/문장 수정 기능은 후속 개발이며 수정하려는 글은 무승인 유지 정책을 따른다.

## 기록 검증·Git

- 변경 문서의 상대 링크183개/누락0, 증거JSON parse 성공, `git diff --check` 및 계약 검사·hook 설치 상태 통과. 구현 소스는 배포한 입력 이후 변경하지 않았고 문서 변경 때문에 API/브라우저 전체 검사를 다시 실행하지 않았다.
- 로컬 annotated tag `prod/2026-10-08-0003-KST-f8067ab`를 배포된 main SHA에 생성했다. tag push는 하지 않았다.
- 배포 후 문서·실행 증거는 `feature/discord-review`에 별도 기록한다. 해당 문서 커밋이 운영 코드 SHA를 바꾸지는 않는다. 범위 밖 작업 기록은 stage하지 않는다.
- 후속 문서 commit `09806a3` 작성 후 feature push를 00:09~00:10 KST 세 번 시도했으나 GitHub가 `Internal Server Error`로 거부했다. remote feature는 `7df63de`인 것을 재조회했다. 구현/release/main/이미지/운영 적용은 이미 완료됐으며 이 실패는 후속 문서 원격 보관만 해당한다. 로컬 커밋과 작업 파일은 보존했고 복구 후 `git push origin feature/discord-review`로 이어갈 수 있다. tag는 별도 push하지 않는다.
