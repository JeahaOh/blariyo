# 수집처 관리 운영 배포

- 요청: 현재 변경을 주제별 커밋하고 운영 앱·Collector·DB에 반영.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 23:38 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`.
- 담당 경로: 기존 source-auto-publish·source-collection-settings·source-management-history 변경 전체, 이 기록, 필요한 운영 상태 문서. 다른 진행 담당 없음 확인. 기존 변경 보존.
- 기준: feature `abf21ea`, release `7df63de`, 원격 main `f8067ab`. 배포 대상은 웹 GUI PR 병합 후 검증된 main SHA.
- 구성: API V015, Collector V016, 수집처별 수집/자동발행 설정, 별도 관리 메뉴, 행별 저장, 사용자 정의 선택 UI, 검색/상태 필터 및 수집 이력.
- 기본 정책: 자동발행 기본 OFF, 관리자가 저장한 수집 여부 보존, URL은 조회만 제공. 개발 예약 수집은 중지 상태 유지.
- 검증·Git·백업·DB·실행 증거는 완료 후 아래에 기록한다. 운영 실행·백업 복원·배포 결과는 아래 증거를 따른다.


## 배포 후보 검증

- 최종 입력 품질14검사 통과(problems 없음), 아키텍처4검사 통과. API14건·브라우저6건 최신 검증은 [수집 이력 기록](../source-management-history/README.md), Collector313건과 권한·복원 검증은 [수집 설정 기록](../source-collection-settings/README.md). 원격 CI는 별도로 확인한다.
- 기능 커밋 `7c635d7`: API·Collector·DB·권한·계약. 화면 커밋 `38b812e`: 수집처 관리·선택 UI·필터·이력.

## 원격 준비

- 기능·화면·기록3커밋 작성, 후보 `ec913b7`. feature→release FF 및 두 브랜치 push 완료. [PR #19](https://github.com/JeahaOh/blariyo/pull/19), [PR CI #61](https://github.com/JeahaOh/blariyo/actions/runs/37943085194) 전체 검증 성공(6개 성공·이미지 게시1개 정책상 생략).
- 사전 운영 DB API V014·Collector V015, 모든 관리 스키마 소유자 blariyo_migrator·기존 ledger 체크섬을 읽어 대조했다. 운영 API/Web healthy 및 기존 timer9개 확인.
- 사전 백업2026-10-09 23:15:33 KST, 암호화1,274,224bytes, SHA-256 `b5047e3338d72fa1153aa84accb1faee24d9ffceee019e08995a07ea4f02a106`. R2 다운로드/hash·age 복호화·격리 PostgreSQL18 실제 복원·운영 ledger/정책/게시판/게시글 readback 대조 통과. 복구키는 서버 파일로 저장하지 않았다.
- PR 본문에 로컬/운영 검증 시점의 혼동 가능성으로 자동 승인 검토가 첫 제출을 거부했다. 완료한 로컬 검사와 대기 중인 원격/운영 절차를 명시한 본문으로 수정한 뒤 제출 성공.


## 운영 반영 완료

- [PR #19](https://github.com/JeahaOh/blariyo/pull/19)를 GitHub 웹의 merge commit으로 병합했다. main `77a425d98327dc7933c8871194cc31f3608089a1`. main·후보 `ec913b7`·PR 검사 입력 `ae1350947962a78eed4666a7ce6603d0b0bf714d`의 Git tree가 모두 `c1f792f0358e995546fc86fea226306c36bffbad`로 일치했다. [병합 화면](pr-merged.png).
- [main CI #62](https://github.com/JeahaOh/blariyo/actions/runs/37944479479) 성공, 동일 merge tree의 PR 전체 검증을 엄격한 재사용 판정으로 확인했고 quality·verify 및 API/Web 이미지 게시가 성공했다. PR에서 이미지 job이 생략된 것을 운영 이미지 생성 완료로 간주하지 않았다.
- Collector CI ZIP SHA-256 `bc754a523b838a36f5b67559c4f09831cfbb19a9eecd0021d125b489d605ec96`, JAR SHA-256 `a67f9dae519896558b7e6aa9417b306de630be7fa8f0e17f006e8a1f1eacd5df`. CI에서 다운로드한 ZIP 해시 및 JAR에 포함된16개 SQL의 소스 일치를 확인했다. 서버에서 빌드하지 않았다.
- API `ghcr.io/jeahaoh/blariyo-api@sha256:7242443ffb3b8453c85547c66467878a363b7594b69e90f046b1408ebf114cf3`, Web `ghcr.io/jeahaoh/blariyo-web@sha256:8ea07e34c27d75dde87c0e7e1cabd0fc5c001868c8827acc29e84796147b5adb`. CI 기록→서버 SHA tag pull의 RepoDigest→실행 컨테이너 이미지가 모두 일치했다.
- 운영 release `/opt/blariyo/application/release-77a425d-sources-v015-20261009T143304Z`. 부팅 helper도 같은 경로로 갱신했다. 기존 release·Collector 실행 파일/manifest/run.py는 운영에 보존했다.
- 23:33:05 KST API 쓰기 중지, API V014→V015·Collector V015→V016을 각 공식 migration entrypoint와 migrator 파일 인증으로 적용했다. 기존/신규 ledger SHA 및 제한 역할 권한을 직접 대조했다. 과거 migration을 변경하지 않았다.
- 23:33:24 KST API/Web healthy, 23:33:26 예약 작업 재개. 쓰기 중지→두 앱 healthy 구간19.55초. HTTP 오류 지속 시간을 연속 측정한 수치는 아니며 무중단 배포를 주장하지 않는다. 최종 timer9개 enabled/active, 수집04:30/15:30·검수07:30/17:00 KST 유지. [receipt](deployment-receipt.json), [출력](deploy-output.txt), [timer](timers.json).
- Collector `sources-sync`는 운영 source 파일의 URL/설정 metadata만 동기화했다. HTTP 수집·object 쓰기·Discord 메시지·발행·새 batch run은 실행하지 않았다. API 앱 역할로 실제 저장소 코드를 실행해21개 source/URL, 수집ON13·임시OFF6·수집불가2, 자동발행ON0을 확인했다. 임시OFF는 arcalive/bobaedream/dcinside/inven/mlbpark/pgr21, 수집불가는 fmkorea/ppomppu다.
- 기존 게시글106·수집 항목445건의 건수와 전체 행 SHA-256이 쓰기 중지 이후 migration/metadata 동기화와 앱 재시작 전후 모두 일치했다. 데이터 보존 근거는 receipt의 before/after를 따른다.
- PostgreSQL/API/Web healthy, Collector READY, Discord worker production/check COMPLETED(메시지 실행 없음). [실행 검증](runtime-verification.txt). 공개 HTTPS·정책 API·익명/위조 관리자 헤더의 Access 인증·Core internal404·대표 URL 검증 통과. [공개 검증](public-verification.txt).
- 배포 후 새 백업23:34:14 KST, 암호화1,288,822bytes, SHA-256 `5d3b35a527b0896ee4816b1cba252e30210090976c534abd0f7890bcabe1c9fc`. R2 실파일 다운로드/hash·age 복호화·격리 PostgreSQL18 실제 복원을 수행해 API/Collector ledger, 정책 본문, 게시판/게시글 수,21개 수집처 설정·URL·자동발행 정책 전체 행 해시까지 운영과 일치했다. [백업](backup-after.json), [복원](backup-restore-after.txt). 임시 시험 DB/container만 정리했고 복구키 원문은 기록하지 않았다.
- 개발 배치4개 LaunchAgent disabled/unloaded 재확인. [중지 유지](development-paused.txt). 다른 세션의 `code-structure-audit/` 기록은 수정·stage하지 않는다.

## 남은 관찰 및 기록 검증

- 운영 `/admin/sources` 브라우저 접근은 Cloudflare 로그인 화면까지 확인했다. 저장된 인증이 없어 사용자 로그인을 요청하고 탭을 유지했다. 운영 관리자 로그인 후 화면 표시·실제 설정 저장은 미검증이다. 배포한 UI의 로컬 브라우저6건/다중 폭 검사와 구분한다.
- 다음 정기 수집은2026-10-10 04:30 KST. 이 배포의 새 이미지 정책/DB switch를 적용한 실제 수집·자동발행·Discord 왕복은 별도 관찰이며 테스트를 위해 운영 게시글을 발행하지 않았다. 자동발행은 현재 모두OFF다.
- API/Data 읽기·백업 복원은 현재 운영 증거다. 실제 VM 재부팅·운영 image/DB 복귀·OWNER/EDITOR 업무 인수·장기 운영 전체 완료를 뜻하지 않는다.
- 현재 source 후보 검증은 위 SHA/tree의 결과다. 배포 후 상태 문서와 이 기록은 링크/JSON/Python syntax 및 diff/hook으로 확인하며, 과거 품질 receipt를 문서 변경 후 새 입력의 전체 검증 결과로 주장하지 않는다.

- 최종 기록 검사: 문서4개 상대 링크184개/누락0, 증거JSON 및 Python5개 syntax 통과, receipt 데이터 보존 대조 통과, 실제 복구 identity/private key 문자열 없음, `git diff --check`·`hooks:check` 통과. 다른 세션의 구조 검토 기록은 범위에서 제외했다.
