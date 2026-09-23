# TASK-03 운영·법무·보안·CI/CD·출시 gate 감사

- 감사 기준: `main` `c69aa53c0112bcff8f50405c3a81b80969bef05a`, 2026-09-22 UTC
- 범위: 운영 정본, `deploy/`, GitHub workflow, 법무 문서, 분석·수집·보안·복구·비용 gate
- 제외: 운영 계정·비밀·SSH·설정 변경, 실제 관리자 로그인, 배포·발행, 법률 적합성 판단
- 판정: **M0 Core는 공개 배포 상태이나 운영 수용은 진행 중이다. 관리자 쓰기·운영 콘텐츠·외부 알림·복구 훈련·장기 관찰이 끝나기 전 운영 준비 완료로 보고할 수 없다.**

## 최신 공개 읽기

2026-09-22 UTC에 계정 없이 안전한 GET만 실행했다. 원문 응답은 저장하지 않았고 상세 상태·목록 수는 [public-readback.json](public-readback.json)에 남겼다.

| 경로 | 결과 | 의미와 한계 |
| --- | --- | --- |
| `/meme`, `/terms`, `/privacy`, `/cookie-settings`, `/health/live` | 200 | 공개 경로와 liveness의 현재 응답만 확인. 피드 데이터·브라우저 UX·장기 가용성은 증명하지 않음 |
| `/admin` | Cloudflare Access 302 | 인증 진입 경계 확인. TOTP 완료·운영자 매핑·쓰기 권한은 미검증 |
| `/internal/health/ready` | 404 | 내부 readiness의 외부 비노출 확인 |

첫 `/cookie-settings` 요청은 15초 timeout이었고, 45초 재시도는 200이었다. 이 단발 지연만으로 장애를 단정하지 않지만 외부 관측·알림이 필요한 근거다.

## 주요 발견

### High — OPS-03: 공개 피드 콘텐츠 공급이 수용되지 않았다

- 근거: `artifacts/public-readback.json` — 2026-09-22T14:30:51.534Z 공개 목록 API 200에서 pinned/일반 항목 각 0건, `docs/implementation/operations/current-status.md:30`, `worklog/task-list/09/20/infrastructure-setup/TASK-19.md:61-66`, `scripts/content/README.md:141-167`
- 영향: 현시점 공개 목록은 0건이다. 공개 피드의 배포 성공과 실제 서비스 제공은 다르다. 로컬·개발 DB의 25건은 운영 발행 증거가 아니며, 운영자는 게시·숨김 흐름도 아직 수용하지 않았다.
- 최소 보완: 출처·권리·사실관계 검토를 마친 콘텐츠를 실제 운영자 흐름으로 발행하고 목록·상세·이미지·권리 연락처를 확인한다.
- 수용 조건: OPS-02의 비밀 비노출 E2E 기록과 운영 공개 글의 실제 브라우저 확인.

### High — OPS-02: 관리자 실제 쓰기 수용이 남아 있다

- 근거: `docs/implementation/operations/current-status.md:31,44`, `docs/system-design/05-security-operations.md:51-66`, `TASK-19.md:51-66`
- 영향: Access 302과 설정 파일 검사는 관리자 기능 정상의 대체물이 아니다. 운영 중 숨김·권리 대응도 신뢰할 수 없다.
- 최소 보완: 운영자가 직접 MFA를 완료해 identity 매핑, 이미지 업로드, 초안, 발행, 숨김·재공개와 공개 404/purge를 검증한다.
- 수용 조건: 인증정보를 남기지 않은 결과·시각·테스트 게시물 ID와 public 확인 기록.

### High — OPS-04: 최신 main과 운영 release의 readback 매핑이 이번 감사에서 확인되지 않는다

- 근거: `docs/implementation/operations/current-status.md:17-20,55-64`, `docs/implementation/operations/deployment-policy.md:47-61`, `git log 2da659f..c69aa53`
- 영향: TASK-13/15에는 source hash·archive hash·image 검증·stage 기록이 있다. 다만 배포 후 수집·보안 변경이 main에 추가됐고, 현재 release가 최신 main의 어떤 SHA·image digest·설정 묶음과 대응하는지 readback으로 다시 확인하지 않았다. 따라서 최신 변경의 운영 반영 여부는 판정할 수 없다.
- 최소 보완: 기존 manifest/stage record를 보존한 채, 배포마다 Git SHA, API/Web digest, config bundle ID, migration, smoke, rollback 대상을 한 release record에 연결한다.
- 수용 조건: 운영에 적용하지 않은 main 변경은 운영 기능으로 주장하지 않고, 적용한 변경은 immutable artifact로 재현 가능해야 한다.

### High — OPS-05/06/07: 복구·관측·장기 관찰은 설계 또는 단발 확인 단계다

- 근거: `docs/system-design/05-security-operations.md:17-28,332-347,481-489`, `docs/implementation/operations/current-status.md:33-37,44-49`, `docs/system-design/09-security-cost-protection-plan.md:351-408`
- 영향: DB dump의 격리 복원은 확인됐지만 새 VM 복구·RTO 측정·외부 장애 알림·수신 시험·7일 보관 및 정상 이용 관찰은 남아 있다. RPO/RTO 목표와 보안 보호를 운영 수용 완료로 표시할 수 없다.
- 최소 보완: 외부 monitor와 담당자 수신을 확인하고, 월간 DB 복원 및 별도 일정의 새 VM 복구를 실행한다. 정상 이용 회귀·30분·다음 날·7일 관찰을 규칙별로 기록한다.
- 수용 조건: 실제 시간과 결과가 남은 복구 훈련, 알림 수신, timer/backup age, rollback 결과.

### High — OPS-08: 수집 source gate는 열린 출처가 없다

- 근거: `docs/planning/content-collection/README.md:62-75`, `docs/system-design/05-security-operations.md:189-208`, `deploy/application/prepare-runtime-config.cjs:103-106,115`
- 영향: 수집 코드는 있어도 다수 출처가 robots·약관·허가 미확인, 보류 또는 차단이다. live Discord·운영 PC도 검증되지 않았다. 수집 flag 기본 false는 올바른 보호 상태다.
- 최소 보완: 출처별 허용 근거, robots, host, 요청 상한, 연락 수단, parser fixture를 확정하고 한 출처씩 후보만 생성하는 단계로 수용한다.
- 수용 조건: 자동 발행 없이 차단·실패 알림·운영자 승격을 실제 출처에서 확인.

### High — OPS-11: `design-readiness`가 현행 공개 상태와 충돌한다

- 근거: `docs/system-design/design-readiness.md:19,37,50-52` vs `docs/implementation/operations/current-status.md:1-37`, `docs/legal/m0-core/README.md:1-4`, `TASK-19.md:1-17`
- 영향: M0 Core가 법무 실값·계정 미완료로 “production 공개 승인 차단”이라고 남아 있지만, 운영·법무 정본은 정책 발행과 공개 배포를 기록한다. 이후 감사가 공개 배포 자체를 미배포로 오독할 수 있다. 이 문서 이중화가 실제 배포 동작에 영향을 줬다는 증거는 이번 감사 범위에 없다.
- 최소 보완: M0를 “공개 배포 완료·운영 수용 진행”으로 정정하고, M1/수집/GA4 등 기능별 gate와 OPS-02~07을 별도 잔여로 둔다.
- 수용 조건: 설계 문서가 배포 사실을 인정하면서도 실제 운영 수용 완료를 주장하지 않는다.

### Medium — OPS-12: CI 원격 실행 기록이 상충하고 최신 SHA의 상태가 없다

- 근거: `README.md:11`, `docs/implementation/operations/deployment-policy.md:43-45`, `worklog/task-list/09/20/local-ui-cicd/TODO-CICD-DEPLOY.md:7-13`, `.github/workflows/ci.yml:1-90`
- 영향: README·deployment-policy는 remote 실행이 별도라고 하나 TODO는 `f38758a`에서 verify/images 성공을 기록한다. 어떤 범위의 run인지와 현재 `c69aa53`의 결과를 추적할 수 없다. CI image 게시와 Lightsail 배포는 정의상 별개다.
- 최소 보완: run URL·SHA·결과·필수 검사/보호 규칙을 current status에 기록한다. GitHub CLI가 이 감사 환경에 없어 원격 재조회하지 못했다.
- 수용 조건: CI success, GHCR publish, 수동 운영 배포가 각각 독립 상태로 기록된다.

### Medium — OPS-10: M0 공개 정책은 발행 증거가 있으나 운영 처리의 반복 증거는 없다

- 근거: `docs/legal/m0-core/README.md:1-4,58-60`, `docs/legal/README.md:72-91`, `TASK-19.md:8-17`
- 영향: TERMS/PRIVACY v0.1의 발행과 공개 페이지는 확인됐지만 권리 요청 메일의 실제 접수·처리·파기와 사건별 법정 보존 예외는 이후 운영에서 입증해야 한다.
- 최소 보완: 법률 결론이 아니라 문의 수신·담당·처리·파기의 운영 기록과 policy versioning을 유지한다.
- 수용 조건: 비밀·개인정보 원문 없이 요청 처리 상태와 적용 version을 추적할 수 있다.

## 정상적으로 닫힌 gate

- GA4·카카오: `docs/planning/04-analytics-ad-plan.md:190-210`, `docs/system-design/05-security-operations.md:438-445`, `deploy/application/prepare-runtime-config.cjs:121-124`에 따라 값과 동의·CSP 조건 전까지 false/빈값이다. 기능 미활성은 M0 Core 공개 전체를 막지 않으며, 활성화 완료 증거는 아직 없다.
- 공개 노출/관리자 경계: 위 공개 GET에서 HTTPS 200, Access 302, 내부 readiness 404를 확인했다. 이는 OPS-02의 로그인 검증과 다르다.

## 상태 요약

| 구분 | 판정 |
| --- | --- |
| 공개 배포 | 완료 증거 있음. 현재 공개 GET도 일치 |
| 정책 v0.1 발행 | 완료 증거 있음 |
| 관리자 운영 수용 | 미검증 |
| 콘텐츠 공급·운영 발행 | 미완료 — 2026-09-22 공개 목록 0건 |
| GA4·카카오·수집 활성화 | 의도적으로 비활성 |
| 백업 DB 복원 | 부분 완료 |
| 새 VM 복구·RTO | 미검증 |
| 외부 감시·실제 알림 수신 | 미검증 |
| 보안/비용 장기 관찰 | 진행 |
| 최신 main CI·운영 반영 추적 | 미검증/문서 상충 |

법률 적합성은 판정하지 않았다. 여기서 확인한 것은 문서상 gate, 공개 응답, source/스크립트와 과거 실행 기록의 관계다.
