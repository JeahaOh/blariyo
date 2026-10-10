# 생활·유머 게시물 분류와 별도 자동 발행 배치

- 요청: 검수 없이 자동 발행할 게시물을 분류하는 코드 추가, 자동 발행을 별도 배치로 분리. 사용자 선택: 생활·유머만 좁게 시작.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 09:35 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`(기존 자동 발행 기능의 후속 작업). 직전 상세 진단/편집 패턴 담당 종료 확인. 브랜치 변경·기존 변경 이동 없음.
- 담당 경로: planning/content-collection 및 system-design/11, 관련 개발 Spec/status/roadmap; API 분류기·자동발행 서비스/정책/Discord 경계·migration/최소 권한/선택백업·CLI·관련 검사/ORM/준비 상태·선택복원 검사; deploy/operations 전용 service/timer·실행기·명시적 설치 안내 및 검사; 이 기록 폴더.
- 기존 변경: 상세 진단 기능·관리자 제목 수정·관련 계약/문서와 다른 세션 기록을 보존한다. 공유 파일에는 이번 범위의 추가만 작성한다.
- 방향: 출처 ON은 분류 배치 참여 허용이며 생활·유머 분류 통과 글만 자동 승인. 원문 불충분/외부 링크/불명확 소재/제외 소재/중복은 자동 반려하지 않고 사람 검수로 보낸다. 분류 규칙 버전·사유·원문 digest/정책 버전 기록. 기존 최종 발행 검사·사람 우선권·신규 run 기준 유지.
- 실행: 예약 글 posts:publish-due에서 수집 자동 발행 제거, collection:auto-publish 전용 배치/--dry-run. 개발 예약 수집/발행 자동 재개·운영 migration/배포/출처 ON·실제 콘텐츠 자동 발행·Git 반영은 미요청이라 실행하지 않는다.
- 검증 계획: 분류 단위(선별 소재 사례), 실제 격리 DB 분류/재시작/Discord 인계/경합/최종 정책·분류 버전 재검사·DB 권한/선택복원, 별도 CLI·service/timer 검사, 최종 build/type/lint/unit 및 diff.

## 구현 및 중간 검증

- 분류기: `life-humor-v1`, ELIGIBLE(LIFE/HUMOR) 또는 REVIEW/사유. 제목/본문 단서와 제외 소재·링크/SNS·본문 한도 검사. 원문 내용 판단의 한계는 기술 정본에 명시한다.
- API V016: 최소 분류 메타데이터와 제목 정규화 hash/index. 기존 SQL checksum 불변. 원문 FK 없는 선택 백업 보존, API 전용 역할 권한 및 ORM 매핑33개. 정책/분류 사용 시 down 차단.
- 공통 발행 최종 단계: 규칙/정책/item 버전·digest·정규화 제목 중복 재검사. 사람 우선권과 이미지/retention 검사는 유지한다. 원문 저장소를 연결하지 않았던 기존 CLI 경로는 실제 격리 발행 테스트로 재현하고 명시적 reader 주입으로 수정했다.
- 전용 CLI/dry-run 및 service/timer, 예약 글 발행에서 분리. timer는 매분20초·과거 보충 없음이며 설치/활성화하지 않았다.
- 회귀 fixture 제목을 새 생활·유머 계약에 맞게 유일한 생활 제목으로 변경했다. 이전 주제 무관 제목이 자동 발행을 기대하던 assertion은 그대로 두지 않는다. 최신 migration은 V016이므로 ledger/down/ORM 기대값을 새 스키마에 맞추고 기존 버전 복귀 검사도 유지한다.
- 중간 실패: API unit test의 await 누락(lint), fixture CreatePost boardSlug 누락(type), 선택복원 fixture의 과거 Collector interval10000 제약, V015 ledger 기대값, 빌드 전 ORM32개를 발견하고 수정했다. 실패를 삭제/skip/검사 완화로 처리하지 않았다. 최종 결과는 아래 후속 기록으로 확정한다.

## 최종 검증 및 적용 경계

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| API 전체 격리 DB 회귀 | 37파일·171건 PASS, 실패/skip0 | `api-integration-current.log`, `api-integration-summary.json` |
| API 서비스 단위 | 46건 PASS(새 분류/CLI4건 포함), 실패/skip0 | `api-unit-current.log` |
| 자동 발행 경계 | 전체 회귀 중22건 PASS | 실제 CLI dry-run/발행 분리, 보류 Discord 전달, 손상 이미지 격리, 버전/digest 변조, 다른 출처 제목 중복, 수동 생성 경합, 20건 분류/5건 발행 및 재실행, 역할 권한 누락 검사 |
| 실제 DB 역할 | 역할5개 PASS, API/Collector V016, 89테이블·17sequence dump/restore 일치 | `database-roles-final.log` |
| 선택 백업 추가 검사 | 실제 pg_dump/pg_restore PASS | 분류 metadata/function/index/ledger 보존, 원문 제외. `deploy/backup/test-auto-publish-backup.mjs` |
| 전용 실행기/예약 계약 | Python4건 PASS | `deploy/operations/test_auto_publish.py`; 실제 systemd 활성화 검증 아님 |
| 품질 종합 | 14/14 PASS, 입력 hash 동일·receipt 유효 | `verification/2026-10-10T00-30-01.477Z-quality-21846.json` |
| 문서/변경 | 상대 링크8파일 누락0, diff check PASS | planning/spec/system-design 동기화. 법무 placeholder 미변경 |

- 최종 전체 회귀는 Java25와 전용 loopback55449 PostgreSQL18에서 실행했다. 이전 전체 실행의 Java25 환경 누락, 빌드와 test-build 동시 실행의 dist 제거 경합, CLI 응답의 any 접근(lint)을 보완했다. 최종 입력에서 API 전체·unit·역할·품질 검사를 다시 수행했다. 검사 skip/완화 없음.
- 준비 상태는 새 Core 제목 함수가 필요한 V016과 EXECUTE 권한을 요구한다. 기존 direct 요청/운영 조회의 버전 허용에도 V016을 추가해 최신 DB에서 기존 수집 기능이 COLLECTION_UNAVAILABLE이 되던 회귀를 수정했다.
- 사용한 전용 `blariyo-auto-publish-pg-20261010`과 무작위 fixture DB/역할·임시 파일은 검사 종료 후 정리했다. 기존 로컬 PostgreSQL 컨테이너/실데이터와 개발 예약 중지를 변경하지 않았다.
- 커밋/push/운영 배포·운영 또는 로컬 지속 DB migration·출처 ON·systemd 설치/활성화·실데이터 자동 발행은 미실행이다. 이번 결과는 소스·격리 실행 검증이며 운영 활성화 증거가 아니다.
- 이미지 의미/OCR·풍자 맥락·다른 제목의 동일 소재·개인 취향 학습은 포함하지 않는다. 실제 과거23건의 원문 전체를 대조한 분류 정확도/발행률 평가는 하지 않았다. dry-run은 새 분류 후보만 조회하고 미완료 명령 재개는 포함하지 않는다.
- 다음 운영 반영 시 OFF/기존 publish timer 중지·진행 중 작업 확인 → 백업/복원 검증 → V016/권한 → API 배포/준비 상태 → 예약 발행 재개 → 별도 AUTO timer 설치/선택적 활성화 순서를 따른다. source ON은 신규 run에만 적용한다. 설치 절차는 `deploy/operations/README.md`에 있다.
