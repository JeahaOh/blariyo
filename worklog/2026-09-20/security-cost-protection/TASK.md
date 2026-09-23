# 보안·비용 보호 세션 전체 작업 기록

- 일자: 2026-09-20 KST.
- 요청: Cloudflare·AWS의 DDoS, 반복 호출, 정적 파일 남용과 과금 급증 대비를 점검·계획·적용하고, 정상 이용자를 막지 않는 기준 및 수행/잔여 작업을 기록한다.
- 기록 시점의 최종 판정: **Cloudflare 일부 캐시·알림과 Nginx 오류 캐시 방지는 운영 적용. 앱 JSON 오류 보완은 소스·로컬 검증 완료, 운영 배포 미실행.**
- 마지막 배포 요청 후에는 절차·원본 소스 보관본 확인과 SSH 조회까지 수행했다. 이후 세션 전체 기록 요청에 따라 이 문서를 작성했다. 새 이미지 빌드·업로드·컨테이너 교체 성공으로 해석하지 않는다.
- 이 문서는 해당 보안 세션의 이력이다. 현행 계약은 [보안 계획](../../../docs/system-design/09-security-cost-protection-plan.md), 실행 상태는 [보안 적용 결과](../../../docs/operations/security-protection-status.md)와 [현재 운영 상태](../../../docs/operations/current-status.md)를 따른다.
- 비밀·환경변수 원문·이메일 주소·이용자 IP·쿠키·토큰·응답 본문은 기록하지 않는다. 대화 전체 원문 대신 작업, 결정, 실패, 증거와 인계를 보존한다.

## 1. 요청 흐름과 작업 경계

| 순서 | 사용자 요구·결정 | 실제 수행과 상태 |
| --- | --- | --- |
| 1 | 보안·DDoS·정적 과다 호출·의도적 공격·과금 폭탄 점검 | 현재 방어·캐시·원본 노출·계정·비용·복구 후보를 점검하고 미확인을 분리 |
| 2 | 정상 이용자를 막지 않는 적용 계획 문서 | H00–H10 단계, 정상 시나리오, 선행 조건, 되돌리기와 증거 양식 작성 |
| 3 | 직접 적용 가능 여부 및 진행 요청 | 검증한 JS 9개 캐시 규칙, Cloudflare 조기 비용·HTTP DDoS 알림 적용 |
| 4 | 배포마다 정적 캐시를 갱신해야 하는지 | 해시 파일 전체 purge 불필요. 현재 정확한 파일명 9개 규칙은 새 파일 자동 포함 안 됨. JS/CSS 경로 규칙 후보와 구 탭 자산 보존 필요 기록 |
| 5 | 작업 재개·브라우저 접근 장애 확인 | native pipe 초기화 실패 확인. VSCode/iTerm2 권한 차이가 원인이라고 단정하지 않음 |
| 6 | 코드·설정·테스트·문서, 기존 SSH, 공개 응답 검증만 진행 | 관리 콘솔·관리 API 후속 작업을 보류하고 Nginx 수정·검증·운영 reload 수행 |
| 7 | 정상 이용에 영향이 있으면 적절히 풀 수 있어야 함 | 오탐 재현 시 원인 규칙만 완화·복귀, 인증·비공개 경계 보전, 모의 계산·정상 시험 선행 기준 작성 |
| 8 | 현재 설정도 풀어야 하는지·다음 배포 여부 | 확인된 회귀가 없는 캐시·알림·오류 비캐시 유지. 앱 수정/인프라 설정/미래 제한을 구분 |
| 9 | 혼자 끝낼 수 있는 보완 실행 | 앱 JSON 오류 처리와 로컬 HTTP 회귀 검사 구현·실행 |
| 10 | 배포 한 번 해서 테스트 | 운영 원본 소스 보관본·배포 절차 확인, 16:20 KST 서버 조회 완료. 실제 앱 배포·배포 후 시험은 미실행 |
| 11 | 세션 작업 전부 기록하고 tree 제공 | 본 문서, 파일 지문, 임시 SSH 증거 영구 보관, 작업 목차 연결 |

유료 가입·자원 증설·결제 플랜·DB 데이터·DNS·방화벽을 이번 보안 세션에서 변경하지 않았다.
commit·push는 수행하지 않았다. 선행 인프라 세션의 최초 앱 배포·백업·정책 발행은 본 세션 실적으로 합산하지 않는다.

## 2. 설계·정책 정리

[보안·비용 보호 계획](../../../docs/system-design/09-security-cost-protection-plan.md)에 다음을 반영했다.

- 관측 → 알림·캐시 → 원본/IP 신뢰 확인 → 제한 모의 계산 → 단계적 제한 → 운영 관찰 순서.
- 공개 HTML/API, 정적 JS/CSS, 미디어, 관리자, 수집, health를 다른 특성으로 취급.
- 공유 IP 1/5/20명, 첫 방문·다중 탭·모바일 재연결, 이미지·업로드·숨김, 검색·공유 미리보기 등 정상 시험.
- 요청 수·burst·동시 처리 상한은 실측 전 `(미정)`. 임의 숫자로 차단하지 않음.
- 신규 제한에 의한 정상 이용 오탐 1건이 재현되면 해당 제한을 모의 계산으로 복귀하거나 비활성화.
- Access·앱 권한, 원본 비공개, 이미지 MIME/크기 검사 등 기본 경계는 일괄 해제하지 않음.
- 공격과 정상 성장을 구분하고, 비용 알림을 과금 상한이나 자동 정지로 표현하지 않음.
- Bot Fight·Under Attack·Hotlink·국가/ASN/VPN 일괄 차단은 즉시 도입하지 않음.
- 현행 설정 유지, 다음 앱 배포 대상, 별도 관리 설정, 장기 관찰을 분리.

인프라·보안 운영 정본, 설계 목차, 현재 운영 상태와 배포 실행서도 관련 범위에서 동기화했다.
법무 placeholder·출시 조건을 해제하지 않았다.

## 3. 운영에 실제 적용한 것

### 3.1 Cloudflare 1차 적용

- Cache Rule: `M0 verified Nuxt assets - ignore query`, 규칙 ID `e62290df6f664b6fa07367646fcee8fe`.
- 검증한 JS 9개에만 쿼리 문자열 무시. 원본 Cache-Control 존중, 헤더가 없으면 캐시 우회.
- 대상 경로 전체와 되돌리기는 [적용 결과 §2·§5](../../../docs/operations/security-protection-status.md)에 보관.
- `Blariyo early budget alert USD 1`, `Blariyo HTTP DDoS alert` 활성화. 기존 $10·자동 생성 알림 보존.
- 기존 수신자 2곳 사용. 테스트 이메일 발송·실제 수신·공격 시 발동은 미검증.
- 전후 JS 9개 본문 해시 동일, 다른 쿼리 요청의 HIT 확인. `/meme`·API·health·없는 JS의 경계 확인.
- 1차 당시 Chrome 공개 화면 확인. 후속 Nginx/앱 수정 이후 브라우저 화면 재검증과는 별개.
- JS/CSS 전체 경로 규칙은 제안만 작성했고 저장하지 않았다. 전체 purge도 수행하지 않았다.

### 3.2 Nginx 오류 캐시 방지

원본 Nitro JSON 404가 `no-cache`였고 공개 JSON 404에서 `max-age=14400 / MISS`가 관측됐다.
`no-cache`는 저장 금지를 뜻하지 않으므로 최종 4xx·5xx를 `no-store`로 전달하도록 수정했다.
정상·리다이렉트 응답의 원래 정책, 오류 상태·본문·권한·요청 허용 여부는 유지한다.

- [nginx.conf](../../../deploy/gateway/nginx.conf): 상태별 Cache-Control map, 원본 헤더 숨김 및 단일 헤더 전달.
- [갱신 도구](../../../deploy/gateway/update-cache-policy-server.py): 고정 전후 해시·호스트·mount 확인, 후보 검사, 백업, inode 보존 갱신, 실제 `nginx -t`, graceful reload, 실패 시 복귀.
- 운영 적용 후 gateway `UP`, 컨테이너 내부 설정 해시 일치. 앱 컨테이너 재배포는 하지 않음.
- 운영 설정 SHA-256: `9728047ec8f6309794ab0f6fa96dc8c1cbf9f783ea9240dc778ff9b954d64555`.
- 서버 백업: `/opt/blariyo/gateway/nginx.conf.before-cache-6ef2abf4ecea`.
- 되돌리는 도구 경로는 준비됐으나 정상 운영 설정을 실제로 rollback하는 시험은 하지 않음.
- 이전 Cloudflare 오류 캐시 사본의 purge·만료 확인은 하지 않음.

## 4. 소스·점검 도구 구현

| 파일 | 세션에서 수행한 내용 | 실행 경계 |
| --- | --- | --- |
| [error-handler.ts](../../../apps/web/server/error-handler.ts) | Nitro 기본 JSON 오류 결과의 4xx·5xx Cache-Control만 `no-store`로 변경 | 로컬 완료, 운영 미배포 |
| [nuxt.config.ts](../../../apps/web/nuxt.config.ts) | `nitro:config`에서 Nuxt HTML 처리 뒤에 JSON 오류 처리 연결 | 기존/동시 CSS 변경은 본 수정과 별개 |
| [web-cache.test.ts](../../../tests/http/web-cache.test.ts) | 실제 빌드 Web의 오류·정적 파일·인증 경계 HTTP 검사 | 합성 환경, loopback, 운영 DB/인증 미사용 |
| [package.json](../../../package.json) | `test:web-cache` 명령 추가 | build 후 위 HTTP 검사 실행 |
| [test-gateway.py](../../../deploy/gateway/test-gateway.py) | 401/403/404/500·gateway 404/413, 성공·redirect 헤더와 중복 회귀 검사 보완 | 격리 컨테이너에서 실행 |
| [verify-static-cache.py](../../../scripts/verify-static-cache.py) | inventory 해시·GET/HEAD·쿼리·합성 인증/쿠키·HTML/JSON 제어 경로 확인 | 초당 최대 1회 순차, 자산 100개·본문 8MiB 상한 |
| [collect-security-state-server.py](../../../deploy/gateway/collect-security-state-server.py) | 서버 상태·공개 listener 포트·정적 파일 경로/크기/해시 수집 | 기존 SSH의 읽기 전용 조회 |

Nitro 2.13.4에서 JSON 오류가 일반 `beforeResponse` 훅을 거치지 않는 경로를 확인하고 오류 처리 확장을 사용했다.
기본 오류 정제·상태·본문·보안 헤더를 유지했다. 현재 작업 트리의 UI 변경까지 운영 반영한 것은 아니다.

## 5. 검증 결과와 실패·정정

이 표는 세션 중 수행한 검사 기록이다. 이번 기록 작성 단계에서 전체 테스트를 다시 돌린 것으로 표시하지 않는다.

| 검사 | 결과와 한계 |
| --- | --- |
| 운영 원본 자산 | JS 19·CSS 5, 정상/쿼리/합성 쿠키/합성 Authorization/HEAD 120회 정상. JSON 오류는 기존 `no-cache` 결함 확인 |
| 첫 전체 공개 검사 | 160회 원자료 보존. 네트워크 실패 1건과 시험 기대값/쿼리 조립 결함이 있어 전체 PASS 아님 |
| 검사 코드 정정 | 빈 게시판 2페이지의 상태, 기존 쿼리 구분자, API 허용 쿼리, 명시적 HTML/JSON Accept 반영 |
| Nginx 격리 검사 | 오류·정상·redirect·인증 전달·로그 경계·Web 교체·자원 정리 통과 |
| Nginx 적용 후 공개 GET 30회 | 자산 24개 200·SHA-256 동일·1년 immutable·HIT. 정상 HTML/API/health no-store, 새 HTML/JSON 404 no-store·BYPASS |
| 추가 26회 공개 검사 | 실패 0. 기존 24개 전부의 쿼리 무관 HIT를 증명한 것은 아님 |
| 공개 읽기·인증 경계 | 공개 5경로·정책 API 2개, 익명/위조 헤더 관리자 Access 이동, internal 404, HTTPS/www 전환 통과 |
| 앱 수정 전 재현 | 없는 JS의 JSON 404 `no-cache`로 로컬 회귀 검사 실패 확인 |
| 앱 시험 정정 | Core 연결 실패는 503, 동적 게시판으로 해석되지 않는 없는 화면 경로로 보정 |
| 앱 수정 후 로컬 | Nuxt production build, Web/tests 타입 검사, 변경 파일 ESLint 통과 |
| 앱 HTTP 회귀 | 상위 1개·하위 3개 통과. 없는 JS/CSS/화면 HTML·JSON 404 no-store, 자산 24개 GET/HEAD/쿼리 해시·캐시 보존, health/인증 실패/Core 실패 200/401/503 유지 |
| 기록 작성 검사 | 관련 링크 존재·JSON 파싱·보존한 증거 해시·git diff --check 확인. 전체 앱 재검증과 별개 |

앱 HTTP 검사는 production build를 `NODE_ENV=test` 합성 설정으로 실행했다. 실제 운영 시작·관리자 MFA·
작성/업로드/발행/숨김·실제 이미지·공유 IP·부하 시험·모든 오류 조합·24시간/7일 관찰은 완료하지 않았다.
운영 공개 5xx를 의도적으로 유발하지 않았다. 즉시 정상 응답을 모든 공격 방어 또는 오탐 없음으로 확대하지 않는다.

## 6. 브라우저 장애와 대체 작업

- 도구 조회가 `apps: []`, `browsers: []`, `Native apps: Error: Sky Computer Use native pipe startup failed`를 반환했고 초기화 후에도 재현됐다.
- 사용자 설정이 활성이라는 확인과 별개로 도구 연결은 실패했다. 이를 VSCode/iTerm2 권한 차이·macOS 접근 거부·AWS 로그인 실패로 확정하지 않았다.
- 기존 SSH 서버 점검, 로컬 코드·설정·검사, 공개 HTTP 검증은 수행 가능했다.
- 후속 Cloudflare/AWS 관리 설정을 위해 새 토큰·새 권한·별도 우회 인증을 만들지 않았다.
- 현재 캐시 경로 확대·AWS 예산/MFA 등의 잔여 상태는 도구 연결 문제와 사용자 범위 제한을 함께 반영한다.

## 7. 마지막 배포 요청의 정확한 중단점

[배포 전 SSH 증거](../../../docs/operations/security-evidence/2026-09-20-deploy-precheck.json)는
2026-09-20 **16:20:03 KST**의 실제 조회 결과다. 기록 정리 중 SSH 프로세스 exit 0과 JSON 완성을 확인했다.
문서 작성 시점에 다시 서버를 조회한 증거는 아니다.

- Web `e65f7efa907f`, API `d87ffce2b97e`, Nginx·DB healthy, gateway `UP`.
- Nginx 해시는 적용 후 값 유지, wildcard TCP listener는 22만, 앱·DB host port는 미공개.
- 자산 26개(JS 19·CSS 5·배포 JSON 2). Docker의 `80/tcp`, `5432/tcp` 표시는 host 포트 공개와 구분.
- 이 스냅샷은 AWS 전체 방화벽·리전·private interface·미래 상태를 증명하지 않음.
- 운영 release 기준: `/opt/blariyo/application/release-56351a45eea650c0f02e5043`.
- 기존 빌드 묶음 `/Users/zeaha/task_list/blariyo-app-images-20260920T005324Z-rhn14v8g`에 원본 `source/`와 manifest가 남아 있음을 확인.
- 기존 API/Web manifest 이미지 ID의 접두부가 운영 조회와 일치함을 확인. 원본 소스 전체를 다시 해시 검증하거나 후보를 빌드한 단계는 아님.
- 동시 UI·콘텐츠·CI 작업을 섞지 않도록 운영 원본 소스에 이번 오류 처리만 반영하는 별도 후보 구성을 검토.
- 구 버전 JS/CSS 보존, 새 산출물과 같은 경로의 해시 충돌 검사, Web만 교체, 부팅 helper 갱신·복귀를 계획.

**미실행:** 격리 후보 소스 작성, 새 amd64 이미지 빌드/통합 검사, 서버 업로드·stage, 이번 배포용 백업,
timer 중지/복구, Compose 교체, 부팅 helper 수정, 실제 rollback, 배포 후 원본·공개 테스트.
현재 로컬 build 성공을 이 배포의 성공으로 보고하지 않는다. 배포 권한을 받았으나 실제 완료되지 않은 상태다.

## 8. 증거와 파일 구조

```text
blariyo/
├── docs/system-design/
│   ├── 09-security-cost-protection-plan.md   # 계획·정상 이용·완화 기준
│   ├── 04-infrastructure-design.md          # 관련 계약 동기화
│   └── 05-security-operations.md            # 관련 계약 동기화
├── docs/implementation/operations/
│   ├── security-protection-status.md       # 적용/검증/잔여 상세
│   ├── current-status.md                   # 운영 상태 연결
│   ├── deployment-runbook.md               # 다음 배포의 캐시 검증
│   └── security-evidence/
│       ├── 2026-09-20-static-cache.json
│       ├── 2026-09-20-static-inventory.json
│       ├── 2026-09-20-origin-static-before.json
│       ├── 2026-09-20-public-static-before.json
│       ├── 2026-09-20-gateway-cache-after.json
│       ├── 2026-09-20-static-retry-after.json
│       ├── 2026-09-20-server-final.json
│       └── 2026-09-20-deploy-precheck.json    # 이번 기록 때 임시 파일에서 보존
├── apps/web/
│   ├── nuxt.config.ts                      # 오류 처리 연결 부분
│   └── server/error-handler.ts             # 앱 JSON 오류 no-store
├── deploy/gateway/
│   ├── nginx.conf                          # 운영 적용된 오류 캐시 방지
│   ├── test-gateway.py
│   ├── update-cache-policy-server.py
│   ├── collect-security-state-server.py
│   └── README.md
├── scripts/verify-static-cache.py
├── tests/http/web-cache.test.ts
├── package.json                            # test:web-cache 추가 부분
└── worklog/task-list/09/20/security-cost-protection/
    ├── TASK.md                             # 이 세션 종합 기록
    └── artifacts/file-inventory.json        # 관련 파일 25개의 시점별 지문
```

[파일 지문](artifacts/file-inventory.json)은 문서 기록 추가 직전 관련 파일의 크기·SHA-256·Git HEAD를 보존한다.
공유 문서·Nuxt 설정 등의 전체 해시는 동시 변경을 포함할 수 있어 배타적 작성자 증거나 배포 이미지 동일성 증거가 아니다.
후속 기록 append로 해당 문서 해시가 바뀌는 것은 정상이다. 환경변수·키·응답 본문은 포함하지 않았다.

다른 세션의 UI·CI·콘텐츠·개발 DB·Compose 변경은 보존했고 본 세션 성과로 합산하지 않는다.
해당 기록은 [로컬 UI·CI·콘텐츠 세션](../local-ui-cicd/SESSION-RECORD.md)에서 별도로 확인한다.
과거 infrastructure-setup TASK도 소급 수정하지 않았다.

## 9. 남은 일과 다음 시작점

1. **앱 배포:** 최신 운영 상태와 동시 변경부터 재확인 → 운영 원본 소스 지문 검증 → 오류 처리만 반영한 후보 → 구 자산 보존/충돌 검사 → amd64 build·격리 통합 → 백업·복귀 준비 → Web 교체 → 부팅 경로·timer 확인 → 원본·게이트웨이·공개 응답 검증. 이번 세션에서는 준비 조사까지만 수행.
2. **캐시 관리 설정:** 기존 9개 규칙 재조회 후 검증된 JS/CSS 경로 규칙으로 전환. 쿼리 HIT/해시·HTML/JSON 오류 비캐시 확인. 전체 purge를 배포 기본 절차로 넣지 않음.
3. **계정·비용:** AWS 예산·MFA·root key·다른 리전 자원 확인, 기존 Cloudflare 알림 실제 수신 확인. 알림만으로 비용 상한 보장 불가.
4. **미디어·DNS:** R2 권한·공개 우회 경로, 미디어 TLS, DNSSEC를 각각 검증·적용. 실제 이미지 흐름 필요.
5. **요청 제한:** 방문자 IP 신뢰·공유 IP·대표 정상 흐름 → 모의 계산·관측 → 한 계층씩 제한. 현재 새 제한·dry-run 모두 미적용.
6. **운영 완결성:** 기존 오류 캐시 사본 처리 필요 판단, 독립 백업·복원, 관리자 쓰기·이미지 발행/숨김, 비상 복귀, 다음 날/7일 관찰.

기존 캐시·알림·Nginx 오류 비캐시는 유지한다. 정상 이용 회귀가 확인되면 원인 변경만 복귀한다.
운영 재개 시 이 이력의 시점별 값을 그대로 신뢰하지 않고 [현재 상태](../../../docs/operations/current-status.md)와 실제 환경을 대조한다.
