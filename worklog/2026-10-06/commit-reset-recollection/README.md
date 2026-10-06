# 작업 단위 커밋·로컬 DB 초기화·신규 배치

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 시작 HEAD `12df6ae`
- 상태: 커밋·로컬 초기화 완료 / 신규 배치·결과 검증 진행 / 갱신: 2026-10-06 20:25 KST
- 작업 차단: **해제**. 커밋·DB 초기화를 위한 공유 작업 폴더 우선 사용이 끝났으며, 사용자 요청에 따라 `ai-quality-adoption` 세션은 작업을 재개할 수 있다.
- 요청: 기존 변경을 작업 단위로 커밋한 다음 로컬 DB를 비우고 신규 배치 실행.
- 담당 확인: 기존 수집 정책·관리 UI·검토 기록 종료 확인. 기존 변경은 보존하며 사용자 요청으로 Git 반영 담당을 이어받음.
- 변경 범위: 기존 미커밋 구현/계약/검증/운영 문서와 작업 기록, 이 기록. 원격 push·운영 변경 제외.
- 커밋 구분: 제목 공통 유틸, DB/API 계약, Collector 처리, API 업무 처리, Web 공통 로딩, 관리자 화면, 로컬/운영 도구, 정본 문서, 작업/검토 기록. 같은 파일의 누적 변경은 의존성을 유지하여 묶음.
- 초기화 대상: 고정 로컬 `127.0.0.1:5439/blariyo_local`. DB 전체(게시글/검수/수집/중복 이력 포함)를 새로 구성. 설정·인증 비밀은 유지.
- 초기화 전 DB dump 복원 검사 및 로컬 object/media 보관. 이후 API V013·Collector V015 migration, 공통코드/게시판 기본값·정책 seed, 제한 역할 확인.
- 신규 수집: 기존 로컬 설정의 등록 21개 출처, 출처별 최대 10건/2페이지/최근 24시간, 기본 요청 간격 5초. 미검증 chart·실제 HTTP 차단은 유지. 배치가 수집하고 Codex는 실행·결과를 검증. 자동 승인/발행 없음.
- 검증: staged diff/계약 hook, build·타입/단위 검사, 로컬 초기화 전후 DB readback, 배치별 결과와 객체 크기/해시, 로컬 API 목록/상세.

## 실행 결과

- 시작 시 Git hook 설치 일치·`git diff --check` 통과. 로컬 PostgreSQL 컨테이너와 5439 포트 확인.
- 7개 커밋 후 별도 `ai-quality-adoption` 진행/CI·package 변경 발견. Git 작업 중단 후 사용자에게 순서를 확인했고, 사용자가 **품질 도입 세션을 멈추고 이 작업 먼저**로 지정했다. 품질 도입 변경·기록은 이번 커밋에서 제외했다. 당시 커밋/초기화를 위해 두었던 다른 세션 작업 보류는 아래와 같이 해제했다.
- 현재 build·Web 타입 검사 통과. 최초 단위 검사는 API 빌드 중 dist 재생성 경쟁으로 sitemap import 실패1건; build 종료 후 재실행하여 52건 모두 통과(실패/skip0).

## 초기화 전 커밋

- `1440a74` fix(contracts): remove known source labels from draft titles
- `6e30c92` fix(collector): preserve decoded Korean text from Humoruniv
- `d348866` feat(db): define common codes and direct collection review contracts
- `d8a7317` feat(collector): coordinate retention, image retries and configurable request pacing
- `113d414` feat(api): manage common codes and direct batch review actions
- `193d495` feat(web): add shared top loading indicator
- `d77db70` feat(admin): streamline collection review and common code management
- `368bc93` feat(ops): support collection cleanup and updated database privileges
- `1a31805` docs: align collection policy and administrator workflows
- `a5cbb0d` docs(worklog): record collection and administrator validation results
- `d8cadef` docs: record AI quality tooling review and adoption plan

- 초기화 전 백업: `.local-data/backups/reset-20261006/`. 별도 임시 DB 복원 후 78개 테이블 전체 행 수·내용 해시 일치. 수집85/게시글117/검수68 확인. 객체1,731개·821,620,812 bytes 사본 SHA-256 일치. 로컬 서버 정상 종료 후 재대조.
- 다른 세션 소유의 CI/package/admin.vue lint 수정·scripts/quality·ai-quality-adoption 기록은 보존·커밋 제외.

## 로컬 초기화·배치 실행

- 20:09 KST: 기존 개발 서버 정상 종료·활성 배치0·DB 연결0 확인 후 고정 로컬 DB를 DROP/CREATE. 기존 collector/media 폴더는 백업 디렉터리의 `original-*`로 이동 보존하고 빈 경로 생성. 비공개 설정/계정/복구 사본 유지.
- 새 빈 DB에서 `prepare-batch-review`의 EMPTY_BACKUP 검사에 걸려 변경 없이 종료. 검사 완화 없이 문서의 신규 환경 순서인 API `db:migrate`를 먼저 실행한 뒤 준비 도구 재실행 성공.
- API V001~V013 / Collector V001~V015·API/배치 제한 역할 확인. 게시글0/수집0/검수0, 공통코드21/게시판1·정책2개 seed. 이전 DB의 임시 복원 검증 DB는 검증 후 제거.
- Web3000/API3100 재시작(workers=false). `/meme`, 인증 `/admin/batch`, 검수 목록 API HTTP200.
- 20:10:31 KST: 기존 source 설정을 비공개 실행 디렉터리에 고정 복사하고 등록21개 source 배치 시작. 출처3개까지 병행하며 같은 출처 요청은 기본5초 간격 유지. 설정 hash와 출처별 로그는 `.local-data/recollection/reset-20261006/` 보관.

## 작업 차단 해제·담당 경계

- 2026-10-06 20:25 KST 사용자 요청으로 차단 해제를 명시한다. 기존 변경의 단위별 커밋과 로컬 DB 초기화·기본값 복원·서버 재시작은 완료했다.
- 다음 담당: `ai-quality-adoption` 세션. 해당 세션 소유 파일의 구현·검증을 재개할 수 있다. 해당 변경은 이 세션의 커밋에 포함하지 않는다.
- 이 세션 잔여: 이미 실행한21개 출처 배치 감시, 로컬 DB/object/API 결과 대조, 이 기록의 최종 결과 갱신. 배치 완료를 기다리는 것은 다른 세션의 작업 차단 사유가 아니다.
- 실행 중 배치는 고정 source 설정과 실행별 JAR 사본을 사용하고 Web 서버도 별도 빌드 사본을 사용한다. 이 세션은 추가 공유 빌드·브랜치 전환·다른 세션 파일 수정을 하지 않는다. 이 문서만 차단 해제 커밋에 반영한다.
