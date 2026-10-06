# 작업 단위 커밋·로컬 DB 초기화·신규 배치

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 시작 HEAD `12df6ae`
- 상태: 진행 / 갱신: 2026-10-06 KST
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
- 7개 커밋 후 별도 `ai-quality-adoption` 진행/CI·package 변경 발견. Git 작업 중단 후 사용자에게 순서를 확인했고, 사용자가 **품질 도입 세션을 멈추고 이 작업 먼저**로 지정했다. 품질 도입 변경·기록은 이번 커밋에서 제외한다. 이번 담당의 커밋/초기화 종료 전 다른 세션 Git·빌드 변경은 보류.
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
