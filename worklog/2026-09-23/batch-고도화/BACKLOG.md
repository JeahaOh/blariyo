Blariyo 수집 시스템을 아래 목표와 완료 기준에 도달할 때까지 구현·수정·검증하라.
계획 제시나 중간 문제 보고에서 작업을 끝내지 말고, 해결 가능한 문제를 직접 해결하라.

작업 저장소:
/Volumes/MicroVault/iCloudDrive/git/private/blariyo

최종 목표:
외부 사이트 수집 결과가 batch의 DB/object store에 저장되고,
API의 운영자 검수와 초안 승격, 별도 발행 과정을 거쳐
http://localhost:3000/meme 에서 원문 본문·이미지·외부 링크를
정상적으로 확인할 수 있는 재현 가능한 전체 흐름을 완성한다.

우선순위는 다음과 같다.
1. 현재 로컬 데이터와 공개 화면의 오류 해결
2. 정식 batch 결과 조회·검수·초안 승격·발행 연결
3. 환경별 설정과 실행 절차 정렬
4. 21개 사이트별 실제 수집·저장 검증

앞 단계의 기반 문제를 해결한 뒤 다음 단계로 진행한다.
각 단계가 끝났다고 사용자에게 다음 단계 진행 여부를 다시 묻지 않는다.

작업 시작:
- AGENTS.md와 docs/ai/README.md를 먼저 읽는다.
- 관련 planning, system-design, development-spec, 환경 설정 문서를 읽는다.
- git status --short --branch와 git diff --stat를 확인한다.
- 기존 변경과 untracked 파일을 보존한다.
- 아래에 적힌 이전 검토 결과를 현재 코드·DB·실행 서버에서 재확인한다.
- 현재 상태와 완료 기준의 차이를 짧은 체크리스트로 만들고 실제 작업을 시작한다.

이전 검토에서 발견한 사항:
- 공개 목록에는 15개 사이트의 게시글 66개가 있다.
- 상세 API는 61개 정상, 5개 HTTP 500이었다.
- 네이트판 57번 글은 본문 57블록과 공개 API 최대 40블록 제한이 충돌했다.
- 이토랜드 78~81번 글은 한글 출처 URL이 URI 검증에서 거부됐다.
- 공개 이미지 134개는 정상 응답하고 DB 해시·크기와 일치했다.
- DB private_storage_key에 대응하는 API private 파일 134개가 없었다.
- batch 조회 controller와 OpenAPI/Web 중계 계약이 연결되지 않았다.
- 기존 승격 서비스는 collect.candidate를 처리하며,
direct batch 결과의 정식 검수·승격 연결은 미완성이다.
- 환경 예시의 Core 주소, API/collector DB 연결 관계,
API SERVICE_TOKEN 설정에 정정이 필요했다.
- Web lint는 SiteFooter.vue의 타입 단언 1건으로 실패했다.

구현 원칙:
- batch는 외부 목록·상세 fetch, parser, 수집 queue,
collect DB 저장, collect object 업로드와 report를 소유한다.
- API는 collect 조회·검수, content 초안 승격과 공개 상태를 소유한다.
- batch는 글마다 API를 호출하지 않으며 content 공개 상태를 변경하지 않는다.
- API는 외부 원문 사이트를 직접 fetch하지 않는다.
- API와 batch가 같은 상태를 임의로 덮어쓰지 않도록
상태 전이, unique constraint, optimistic lock, 멱등성을 보장한다.
- 본문을 잘라내거나 이미지·링크를 버려서 검증을 통과시키지 않는다.
- 검증기를 끄거나 테스트 기대값만 낮춰서 오류를 숨기지 않는다.
- 정식 흐름이 없는 부분을 일회성 SQL이나 파일 복사로만 해결하고
구현 완료라고 보고하지 않는다.
- 기존 로컬 데이터를 복구하는 일회성 작업이 필요하면
대상·사전 확인·재실행 안전성·복구 방법을 갖춘 스크립트로 만든다.

이미지 계약:
- 수집 원본은 collect/raw/*, collect/media/*, collect/report/*에 저장한다.
- API가 승격 과정에서 필요한 private 사본을 실제로 준비한다.
- 공개 이미지는 다음 규칙으로 저장한다.
content/published/posts/{postId}/{imageId}-{sha256}.{ext}
- DB에는 host 없는 object key를 저장한다.
- 최종 URL은 IMAGE_ORIGIN + '/' + public_storage_key로 만든다.
- local/dev/stage/prod에서 같은 key 규칙을 사용한다.
- private 원본 보존과 공개 사본의 생성·회수·재생성을 검증한다.
- collect/private 경로를 익명 공개하도록 프록시를 확대하지 않는다.

로컬 완료 기준:
- 현재 게시글 전체가 목록에 누락·중복 없이 표시된다.
- 현재 게시글 전체의 상세 API와 상세 화면이 정상 동작한다.
- 긴 본문도 원문 내용과 순서를 유지한다.
- 공개 이미지 전체의 HTTP 응답, 디코딩, 해시, 크기,
MIME, dimensions를 DB와 대조한다.
- private/public object와 DB 참조가 일치한다.
- SNS·외부 링크가 보존되고 허용된 공식 URL만 임베드 대상이 된다.
- batch 결과 조회 → 검수 → 초안 승격 → 별도 발행을
실제 서비스/API 경로로 실행하고 DB/object readback으로 확인한다.
- 승격 재시도·중복 요청·실패 복구를 검증한다.
- 숨김과 재발행은 격리된 테스트 게시글로 검증한다.
- 브라우저에서 목록, 상세, 다중 이미지, 긴 본문, SNS 링크,
페이지 이동을 확인한다.
- 최종 확인 주소는 반드시 http://localhost:3000/meme 이다.
다른 포트 검증만으로 대체하지 않는다.

21개 사이트 검증:
arcalive, bobaedream, clien, dcinside, dmitory, dogdrip,
etoland, fmkorea, goodgag, humoruniv, instiz, inven,
mlbpark, natepann, pgr21, ppomppu, ruliweb, theqoo,
todayhumor, yuldo, youtube-community

- 사이트별로 hot/top 목록 지원, 일반 목록 지원,
상세 URL만 지원, 접근 차단을 구분한다.
- hot 목록이 없는 사이트에 존재하지 않는 hot adapter를 만들지 않는다.
- 공지·광고·카테고리 링크를 일반 상세 글로 오인하지 않는다.
- 지원 가능한 목록에서 최대 5개의 서로 다른 공개 상세 글을 검증한다.
- 상세 전용 사이트는 실제 공개 상세 URL로 검증하고
목록 자동 수집 완료로 표시하지 않는다.
- 목록/상세 parser, 실제 fixture, 본문·이미지·첨부·SNS 추출,
canonical/source post key 중복 제거, DB/object readback을 확인한다.
- fixture 통과, 실제 fetch, DB 저장, object readback 상태를 분리한다.
- 로그인·CAPTCHA·접근 차단을 우회하지 않는다.
- 외부 사유로 진행할 수 없는 사이트는 blocked로 남기고
관측한 응답·차단 원인·재개 조건을 기록한다.
- 차단된 사이트 때문에 다른 사이트 작업을 중단하지 않는다.
- 이번 검증만으로 Discord Gateway 실연동을 완료 처리하지 않는다.

환경과 재현성:
- local/dev/stage/prod .env.example과 실행 문서를 실제 구현과 맞춘다.
- Core 주소는 Web 자신을 다시 호출하지 않도록 설정한다.
- API와 batch의 DB 연결 및 role 분리가 실제 조회 구조와 일치해야 한다.
- 서비스 간 인증 설정과 object store 권한을 빠뜨리지 않는다.
- 현재 터미널의 우연한 환경변수나 수동 파일 복사 없이도
문서의 명령으로 같은 로컬 상태를 재현할 수 있어야 한다.
- 애플리케이션 실행만으로 수집물이 자동 공개되면 안 된다.

작업 권한:
- 범위 안의 source, migration, test, 설정 예시, 문서를 수정해도 된다.
- 확인된 로컬 개발 DB와 로컬 object store의 정합성 복구 및
검증 데이터 생성은 허용한다.
- 기존 데이터 수정 전 대상과 복구 수단을 확보한다.
- 기존 수집 데이터·게시글을 일괄 삭제하거나 초기화하지 않는다.
- 현재 저장소의 로컬 개발 서버는 확인 후 재시작해도 된다.
- 다른 프로젝트의 서버와 사용자의 무관한 프로세스는 건드리지 않는다.
- 운영 DB·운영 bucket·운영 서비스는 변경하지 않는다.
- commit, push, 배포는 하지 않는다.
- credentials, token, 실제 쿠키, 개인정보를 출력하거나 커밋하지 않는다.

진행 방식:
- 수정 후 관련 테스트와 실제 실행 검증을 한다.
- 실패하면 원인을 분석하고 수정한 뒤 다시 검증한다.
- 합리적인 구현 선택은 기존 설계와 위 목표에 따라 직접 결정한다.
- 중간에 새 문제를 발견하면 범위 안의 문제는 작업 목록에 추가해 해결한다.
- 테스트 실패나 수정 가능한 구현 누락을 외부 blocker로 분류하지 않는다.
- 사용자만 제공할 수 있는 자격증명·외부 권한·중대한 제품 결정이
필요한 경우에만 질문한다.
- 질문이 필요한 동안에도 독립적으로 진행 가능한 작업은 계속한다.
- 외부 차단은 제한된 재시도 후 기록하고 다른 작업을 진행한다.
- 컨텍스트가 부족해지면 완료 내용, 남은 작업, 실행 명령,
검증 증거와 다음 행동을 저장소의 작업 기록에 남긴다.

최종 검증:
- 관련 Java/Node compile, lint, unit/integration test
- parser fixture 및 batch runner test
- 변경한 migration의 적용·제약 검증
- dry-run 무쓰기 검증
- DB/object readback
- 정식 검수·승격·발행 흐름 검증
- localhost:3000 실제 브라우저 검증
- git diff --check
- git status --short --branch

종료 조건:
내부에서 해결 가능한 구현·데이터·설정·테스트 문제가 남아 있으면
작업을 완료로 보고하지 않는다.
필수 조건이 모두 충족되거나, 남은 항목이 구체적인 외부 차단으로만
구성됐을 때 최종 보고한다.
외부 차단이 남으면 전체 완료와 부분 완료를 명확히 구분한다.

최종 보고:
1. 전체 판정과 바로 확인할 로컬 URL
2. 해결한 문제와 변경 파일
3. 게시글·이미지·링크·DB/object 검증 수치
4. 정식 검수·승격·발행 검증 결과
5. 21개 사이트별 구현·fixture·live·readback 상태
6. 실행한 명령과 테스트 결과
7. 남은 blocker와 재개에 필요한 입력
8. Git 상태 및 commit/push/배포 여부