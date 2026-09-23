# TASK-20 — 배포 작업 기록 정리와 운영 문서 현행화

- 수행일: 2026-09-20 KST
- 요청: 여기까지 작업을 task 단위로 기록하고 문서를 현행화한 뒤 커밋.
- 범위: 누적 M0 배포 구현·검증 도구·정책·운영 문서. push와 추가 운영 설정 변경은 포함하지 않는다.

## 기록과 정본 정리

- [TASK-19](TASK-19.md)의 정책 발행·공개 배포·백업 복원 증거와 미검증 범위를 유지했다.
- [현재 운영 상태](../../../docs/operations/current-status.md)를 추가해 실제 배포 구성, 확인한 결과, 관리자 로그인·장기 관찰·복구키 보관·알림 등 남은 작업을 한곳에서 찾게 했다.
- 루트 README의 로컬 완료/운영 미배포 표현을 공개 배포 상태로 변경하고 로컬 검사와 운영 증거를 분리했다.
- planning의 공급자 선택을 Lightsail 서울 2GB·고정 IP 미사용·단일 VM 교체 배포로 반영했다. 인프라·보안 정본의 상태도 맞췄다.
- 운영자 안내·실값 체크리스트의 배포 전 상태와 실제 코드에 없는 환경변수 이름을 고쳤다. 담당자 적정성·후속 법무 gate·GA4/카카오 활성 조건은 완료로 바꾸지 않았다.
- 앱 배포 README에서 도구의 단계별 동작 설명과 이미 기동한 서버 상태를 구분했다.
- 2026-09-10 독립 검토 요청서는 당시 자료라는 안내와 현행 링크를 추가하고 과거 비교 내용은 보존했다.
- TASK-01 파일명에 맞춰 목록과 TASK-02의 링크를 수정했다. 과거 TASK의 당시 미완료 판정은 소급 변경하지 않았다.
- 공개한 정책 v0.1 HTML 본문·DB·운영 container는 이번 기록 작업에서 변경하지 않았다.

## 커밋 범위

- Core R2 버킷별 키·DB 역할별 비밀번호 파일, Web 활성 운영자 매핑과 관련 테스트.
- PostgreSQL·application·gateway 설치, 정책 seed/발행, 로그·정기 작업·암호화 backup/restore 도구.
- M0 정책 편집 본문·고정된 draft.2, 관련 정본과 TASK-01~20.
- `worklog/codex-session-01a0b49c-e153-7330-ac46-b42b508a5071.md` 원시 대화 로그는 기존 로컬 파일로 보존하고 커밋에서 제외한다.
- 운영 `.env`, 비밀번호·토큰·SSH/age 개인키, image archive·dump·로그 파일은 포함하지 않는다.

## 이번 작업에서 다시 실행한 검증

- 루트 `npm test`: 15개 통과.
- API test build 후 DB 설정·R2 어댑터 테스트: 11개 통과. 첫 실행은 출력 경로를 잘못 지정해 파일을 찾지 못했으며 실제 `dist-test/` 경로로 수정해 재실행했다.
- 정책 검토본 생성·이스케이프·파일 권한·링크·실제 앱 파서 검사 통과.
- 로그 TTL과 R2 backup 보관 경계·무관 파일/현재 사본 보호 검사 통과.
- image 입력 8개, stage 입력 8개, Docker fingerprint 4개 회귀 검사 통과.
- 공개 읽기 smoke: HTTPS 목록·정책·health, 정책 v0.1/시행일, 익명·위조 header 관리자 Access 302, 내부 경로 차단, HTTP/대표 도메인 이동 통과.
- API source/test·운영 TypeScript script·루트 test 타입 검사 통과.
- Python 구문, 로컬 Markdown 파일 링크, 비밀 키 형식 표식과 커밋 대상 124개 파일 검사 통과. `git diff --check` 통과.

이 재검증은 관리자 TOTP 이후 실제 작업, VM 재부팅, 신규 VM 복구, CDN 전체 전파·부하·7일 관찰을 포함하지 않는다.
이전 배포 중 수행한 실제 DB/R2 복원은 TASK-19의 당시 증거로 유지하며 이번 턴 재실행으로 표시하지 않는다.

## Git 실행 결과

검토한 경로만 지정한 `git add`는 `.git/index.lock: Operation not permitted`로 실패했다.
이 세션의 `.git` 쓰기 제한으로 staging·commit을 완료하지 못했으며 push도 수행하지 않았다.
검토한 파일 목록·SHA-256·현재 HEAD를 고정한 로컬 마무리 도구
`/Users/zeaha/task_list/commit-blariyo-deployment.py`를 준비한다. 도구는 파일 변경·HEAD 변경·다른 staged 변경이 있으면 중단하고, 검토 목록만 등록·커밋한다. 원시 대화 로그는 제외한다.
