# 키워드 관리 독립 메뉴

- 요청: 키워드 관리를 독립 관리자 메뉴로 구현.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 09:57 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`.
- 기존 담당: 자동 발행 분류 및 후속 설명/검토 종료 확인. 기존 상세 진단·관리자 제목 변경·분류 구현과 기타 기록을 보존한다.
- 담당 경로: 키워드 DB/API/관리 화면·분류 배치 및 최종 승인/Discord 경계·migration/권한/백업/ORM/준비 상태·계약/정본·관련 검사, 이 기록 폴더.
- 범위: `/admin/keywords` 독립 메뉴, 검색/분류/사용 필터, 키워드 추가 및 행별 편집/저장·사용 중지. OWNER 변경/EDITOR 조회. 공통 규칙 DB 저장, 변경마다 불변 snapshot/actor/time/version, 배치 실행마다 고정 규칙 읽기, 최종 발행 전 현재 버전 확인. 기존 보류 글 소급 자동 발행 금지.
- 관리 단위: 키워드·생활/유머/반응/제외 그룹·제목/본문/둘 다·부분/단어 일치·사용 여부. 관리자 임의 정규식은 도입하지 않는다. 삭제 대신 사용 중지.
- 제외: AI/이미지 의미 분류, 별도 실제 글 미리보기, 운영 DB/배포/예약 활성화, Git commit/push.
- 검증 계획: 단위 분류·API OWNER/EDITOR/입력/충돌·DB snapshot/규칙 변경 시 AUTO 중단·기존 REVIEW 인계·권한/선택백업·브라우저 행 저장/필터/오류·build/type/lint/계약 및 최종 변경 확인.

## 구현과 중간 검증

- 독립 메뉴 `/admin/keywords`, 키워드 추가·행별 저장, 검색/분류/사용 필터와25건 페이지. 기존 선택 컴포넌트 사용, OWNER 변경/EDITOR 조회, 저장 충돌/응답 유실 재조회·미확인 저장 차단·다른 행 편집 보존. 로그인 복귀 허용 경로에도 새 메뉴를 명시 등록했다.
- API V017: 초기125개(생활20·유머10·반응17·제외78), 최대500개. 불변 snapshot와 현재 head, 변경 actor/time/version 기록. NFKC/trim/제어문자/중복 검사, 임의 정규식 미지원. API에는 revision SELECT/INSERT, head SELECT/UPDATE만 부여하고 변경 이력 UPDATE/DELETE 트리거도 차단한다.
- 배치는 실행 시작에 DB 규칙을 읽고 동일 버전으로 분류한다. 공통 AUTO 접수/준비/발행 transaction에서 head FOR SHARE와 규칙 버전을 확인한다. 기존 REVIEW는 규칙 변경으로 재자동접수하지 않으며 Discord 인계를 유지한다.
- 브라우저2건 PASS: 추가/행 저장/필터/다른 편집 보존/외부 변경 충돌/재조회/OWNER·EDITOR. 1280·1024·900·390·320px 가로 넘침0. `desktop.png`, `mobile.png` 직접 화면 확인, 제목 중복0과 선택 메뉴 표시 확인. 운영 브라우저/기존 지속 DB 화면 증거는 아니다.
- 실제5개 역할·전체91테이블/17sequence dump/restore PASS(`database-roles.log`). 별도 선택 백업 pg_dump/pg_restore에서 분류 메타데이터·키워드 snapshot/head·함수/인덱스/ledger 보존과 수집 원문 제외를 확인했다.
- 중간 발견: 동시 저장 시 head와 revision을 한 JOIN으로 잠그면 대기 후 이전 revision이 남아500이 발생했다. head를 먼저 잠그고 새 statement로 snapshot을 읽어409로 수정했다. 테스트의 전체 Discord 후보 조회는20건 제한에 걸려 해당 fixture fetched_at 이후로 범위를 정했다. 초기 브라우저 로그인 복귀에 새 메뉴 누락을 수정했다.
- 전체 회귀 첫 실행의 schema restore는 테스트 container에 postgres 역할이 없어 환경 오류로 중단됐다. 테스트용 container만 기본 postgres 역할로 다시 생성하고 전체 목록을 재실행한다. 사용자 DB/운영 환경 변경 없음. 신규 FK와 V017 down 순서를 회귀 기대값에 반영했다.
- 품질 첫 실행은 테스트의 Date 강제 형변환 lint1건 실패(나머지13건 PASS)였다. instanceof 검증으로 수정했고 최종 입력으로 재검증한다. assertion 삭제/skip/규칙 완화 없음.

## 최종 결과와 적용 경계

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| 전체 API 격리 회귀 | 37파일·174건 PASS, 실패/skip0 | `api-integration-final.log`, `api-integration-summary.json` |
| 최종 자동 발행/키워드 파일 | 25건 PASS, 실패/skip0 | `auto-publish-final.log`; Date 타입 확인 보완 후 최종 test-build로 재실행 |
| API 단위 | 47건 PASS, 실패/skip0 | `api-unit.log` |
| 관리자 브라우저 | 2건 PASS, 실패/skip0 | `browser.log`, `desktop.png`, `mobile.png` |
| 최소 DB 역할·전체 백업 복원 | 역할5개,91테이블/17sequence 일치 | `database-roles.log` |
| 선택 백업 복원 | 변경 전/후 규칙2개 snapshot와 현재 head 보존, 원문 제외 PASS | `selective-backup.log` |
| 품질 종합 | 14/14 PASS, 입력 변경 없음 | `verification/2026-10-10T00-55-29.387Z-quality-63845.json` |
| 문서·변경 | 상대 링크6파일 누락0, diff check PASS | 정본/Spec/생성 계약 동기화, 기존 migration checksum 보존 |

- 최종 전체 회귀는 task 전용 loopback55449 PostgreSQL18 기본 postgres 역할과 Java25를 사용했다. 완료 후 task container와 runner의 무작위 fixture DB를 정리했다. 기존 로컬 PostgreSQL은 그대로 남았다. 실제 선택 복원 검사는 기존 로컬 서버에 새 무작위 DB만 만들고 검사 종료 후 그 DB만 정리했다.
- 규칙 초기125개, 추가/수정/사용 중지·행별 저장과 배치 DB 읽기를 구현했다. 규칙·출처 ON/OFF와 원문/이미지/중복·사람 우선권 검사는 각각 유지한다. 관리자가 검사 범위를 바꿀 수 있으며 초기 생활/유머 단어의 기본 범위는 제목이다.
- 이번 결과는 소스와 격리 실행/브라우저 증거다. 기존 로컬 지속 DB V016/V017 적용·운영 DB/배포·실제 수집 글 자동 발행·예약 작업 활성화·Git commit/push는 실행하지 않았다. 개발 예약 중지는 유지한다.
- 실제 글 미리보기·키워드 적중 내역 UI·변경 이력 조회 UI·AI/이미지 의미 판별은 포함하지 않는다. 변경 이력은 DB에 보존한다. 기존 보류 글을 규칙 변경으로 소급 자동 발행하지 않는다.
