# TASK-03 — 운영과 출시 준비

- 담당: GPT-5.6 Terra / high
- 상태: 감사 완료 — `artifacts/03-operations.md`, `artifacts/03-operation-items.json` 작성. 공개 배포 증거는 확인했으나 운영 수용은 진행 중이며 관리자 실제 쓰기·운영 콘텐츠·외부 알림·복구 훈련·장기 관찰이 남아 있다.
- 범위: 운영 정본, deploy, CI/CD, 법무·정책, 보안·비용, 복구·관측·수집 출처 gate.
- 요구 결과: 배포와 운영 수용 구분, 최신 증거로 확인한 운영 상태, 미검증/차단 및 우선 보완 목록, 문서 간 상충.
- 산출물: `artifacts/03-operations.md`, `artifacts/03-operation-items.json`.
- 검수: 주요 운영 주장과 공개 읽기 결과를 주 에이전트가 대조한다. 외부 설정·발행·메시지·계정 변경 금지.

## 수행 범위와 확인 방법

- `main` `c69aa53c0112bcff8f50405c3a81b80969bef05a`를 기준으로 운영·법무·보안 정본, deploy source, CI workflow와 9월 20일 배포 기록을 대조했다.
- 안전한 익명 GET으로 `/meme`, 정책 경로, liveness, `/admin`, 내부 readiness의 현재 HTTP 경계를 확인했다. 로그인·게시·설정 변경·외부 메시지는 수행하지 않았다.
- GitHub CLI가 이 환경에 없어 원격 Actions 실행 결과는 최신으로 재조회하지 못했다. 로컬 workflow와 작업 기록의 상충을 발견으로 분리했다.
