# 보안·비용 보호 적용 결과

- 세션 전체 작업·실패/정정·파일 트리·배포 준비 중단점: [종합 기록](../../worklog/2026-09-20/security-cost-protection/TASK.md).

- 마지막 운영 확인: **2026-09-23 앱 배포 후 공개 HTML/JSON 404와 Web 직접 JSON 404의 `no-store`를 확인했다.** [배포 기록](../../worklog/2026-09-23/release/production-deployment-5c581c2.md)과 [현재 운영 상태](current-status.md)를 따른다. 9월 24일 이 문서 갱신에서는 운영 서버·콘솔을 재조회하지 않았다.
- 판정: 게이트웨이 오류 캐시 금지와 앱 원본 JSON 오류 보완은 운영 응답까지 확인했다. Cloudflare 새 JS/CSS 규칙, AWS 예산·MFA, 알림 실제 수신, 정상 이용자·공유 IP, 구 탭 자산과 장기 관찰은 미검증이다.
- 아래 §1~§7과 §9~§10의 작업·미실행 서술은 **2026-09-20 당시 기록**이다. 당시 앱 배포 대기·공개 글 0건을 현행 상태로 읽지 않는다. 후속 결과는 각 절에서 날짜와 함께 연결한다.
- 9월 20일 사용자 범위에서는 브라우저·Cloudflare/AWS 관리 API 추가 작업을 진행하지 않았다. 완료·남은 일은 §7, 다음 배포와 별도 관리 설정은 §8을 따른다.
- §1~§5는 같은 날 1차 적용 당시 기록이다. 당시의 “서버 설정 변경 없음”은 후속 적용 이후 상태와 구분한다.

- 일자: 2026-09-20 KST, 약 15시대
- 판정: **정적 JS 일부의 캐시 보강·Cloudflare 알림 설정 적용. 요청 차단·앱 배포·서버 설정 변경 없음.**
- 범위: [적용 계획](../system-design/09-security-cost-protection-plan.md)의 H01·H02 일부 실행, H03 일부 읽기 전용 확인.
- 증거: 실제 Cloudflare/AWS 콘솔, 기존 SSH 경로의 서버 조회, 공개 HTTP 응답·파일 SHA-256, Chrome 공개 화면.
- 확인 시점의 공개 글은 0개다. 이미지·실제 게시글·관리자 쓰기·다수 이용자 시나리오의 안전성을 증명하지 않는다.

## 1. 실제 변경한 항목

| 항목 | 적용값 | 확인 결과 | 남은 검증 |
| --- | --- | --- | --- |
| Cloudflare Cache Rule | `M0 verified Nuxt assets - ignore query`, 대상 JS 9개, 쿼리 문자열 무시 | 규칙 활성 1개. 새 쿼리마다 같은 캐시 재사용, 9개 모두 적용 전후 해시 일치 | 다른 POP·자산·후속 release, 장기 관찰 |
| 조기 비용 경고 | `Blariyo early budget alert USD 1`, 예산 $1 | 알림 목록에서 활성. 기존 $10·자동 생성 알림 유지 | 실제 이메일 수신·비용 초과 발동 |
| HTTP DDoS 경고 | `Blariyo HTTP DDoS alert` | HTTP DDoS 공격 경고 유형, 활성 | 실제 이메일 수신·공격 시 발동 |

두 신규 알림은 기존 $10 비용 알림에 등록된 수신자 두 곳을 그대로 사용했다. 주소 원문·계정 ID·비밀은
이 문서에 복사하지 않는다. 테스트 메일·공격 트래픽은 발송하지 않았다. 알림 설정 저장과 수신 성공을 구분한다.

비용 알림은 계정 종량제 사용량에 대한 경고이며 서비스 자동 중단이나 과금 상한이 아니다.
HTTP DDoS 기본 알림은 Cloudflare가 완화한 초당 100회 초과 HTTP 공격을 대상으로 하므로, 작은 공격·
일반 과다 호출·원본 장애 전체를 감지하는 경보로 간주하지 않는다.
[예산 알림 공식 설명](https://developers.cloudflare.com/billing/manage/budget-alerts/),
[DDoS 알림 공식 설명](https://developers.cloudflare.com/ddos-protection/reference/alerts/).

## 2. 캐시 규칙의 정확한 범위

규칙 ID: `e62290df6f664b6fa07367646fcee8fe`. 기존 캐시 규칙 0개에서 1개로 추가했다.

```text
(http.host eq "blariyo.com" and http.request.uri.path in {"/_nuxt/CJ-VOngK.js" "/_nuxt/1kDDIf_C.js" "/_nuxt/Cygp9wGA.js" "/_nuxt/D4Z7EhCU.js" "/_nuxt/DL3sZ9x4.js" "/_nuxt/Dn49359g.js" "/_nuxt/CVUGWtz7.js" "/_nuxt/mGdJnlQU.js" "/_nuxt/CW6A1p0s.js"})
```

- 캐시 적합성: 캐시에 적합.
- Edge TTL: 원본 Cache-Control이 있으면 따르고, 없으면 캐시 우회.
- Cache Key: 쿼리 문자열 무시.
- 브라우저 TTL·오류 상태 TTL·관리자/HTML/API 캐시·미디어 캐시를 별도로 덮어쓰지 않았다.
- GET만 매칭하는 조건을 추가하지 않았다. 정적 파일에만 정확히 매칭하여 URL purge와 불필요하게 충돌하지 않는다.
- 원본 파일의 `public, max-age=31536000, immutable` 헤더를 유지한다. 이미지의 1년 캐시 결정과는 별개다.

대상은 9월 20일 당시 운영 `/meme` HTML에 실제 참조된 JS 중 정상/쿼리 변형의 응답이 같다고 검증한 9개다.
전체 `/_nuxt/` wildcard를 적용한 것이 아니므로 다른 JS·CSS·신규 배포 파일은 자동 포함되지 않는다.
**다음 앱 배포 시 신규 자산의 내용·헤더를 확인하여 이 목록을 갱신해야 한다.** 갱신하지 않아도 기본 CDN
동작으로 제공되지만, 새 자산에는 이번 쿼리 분산 방지 효과가 적용되지 않는다. 이전 열린 탭이 사용하는
구 버전 자산의 유지 여부는 앱 배포 정책과 함께 판단하고 무조건 제거하지 않는다.

## 3. 적용 전후 확인

공개 GET을 순차적으로 수행했다. 부하 시험·차단 유발 시험은 하지 않았다.
원문 콘텐츠·이용자 IP·쿠키·토큰을 저장하지 않는 [HTTP 검증 증거](security-evidence/2026-09-20-static-cache.json)에
경로, 상태, 캐시 헤더와 응답 SHA-256만 기록했다.

| 확인 | 결과 |
| --- | --- |
| 변경 전 JS 9개 | 원래 URL·추가 쿼리 URL 모두 200, 동일 bytes, `immutable` 헤더 |
| 변경 후 JS 9개 | 첫 쿼리 요청 MISS → 서로 다른 다음 쿼리 요청 HIT, 9개 모두 변경 전 해시와 일치 |
| `/meme` | 200, `no-store`, `DYNAMIC` |
| 공개 목록 API | 200 JSON, `no-store`, `DYNAMIC` |
| `/health/live` | 200 JSON, `no-store`, `DYNAMIC` |
| 존재하지 않는 JS | 404 HTML, `no-store`, `BYPASS` |
| 실제 Chrome 화면 | 제목·빈 목록 안내·푸터 정상 렌더링, 챌린지·차단 화면 없음 |

이 결과는 확인한 경로·클라이언트·시점의 결과다. 관리자 인증/쓰기·모바일 실기기·동일 IP 20명·공유
미리보기·이미지 숨김·모든 POP·단일 URL purge 시험을 수행했다는 뜻이 아니다. 캐시 purge도 실행하지 않았다.

## 4. AWS·서버에서 읽기 전용 확인한 항목

- AWS 콘솔과 SSH의 대상 인스턴스·hostname을 대조했다. Lightsail 서울 2GB 인스턴스는 실행 중이다.
- Lightsail 통합 방화벽 목록에는 TCP 22 한 규칙만 있으며 지정 IPv4 `/32`와 Lightsail 브라우저 SSH를 허용한다.
  공개 80/443·앱·DB 포트나 IPv6 전체 허용 규칙은 목록에 없었다. 규칙을 새로 열거나 수정하지 않았다.
- 호스트 TCP listener는 공인 인터페이스의 SSH 22와 루프백 DNS다. 앱·DB의 host port mapping은 없다.
  컨테이너 목록의 `80/tcp`·`5432/tcp` 표시는 host publish 여부와 구분했다.
- Nginx·Web·Core·PostgreSQL healthy, cloudflared 실행 중. Docker edge network에는 cloudflared·Nginx·Web만 확인했다.
- 운영 Nginx 설정 SHA-256은 현재 저장소 설정과 같았다. `6ef2abf4eceac3f59ad6f77f5ec438ff766a036ad19f2c3f8e64c1047c9a7b12`.
- 호스트 UFW는 inactive였다. 이를 이유로 Docker 네트워크 검증 없이 일괄 활성화하지 않았다. 호스트·private network
  방어의 추가 필요성은 H03 후속 검토다. 공인 listener 조회가 private network 전체의 안전성을 증명하지 않는다.
- AWS 콘솔에 무료 플랜, 잔여 크레딧 $120, 2027-03-15 종료가 표시됐다. 예산 설정·MFA·모든 리전 자원은 별도 확인 대상이다.

서버 접속은 기존 키와 host key 검증을 사용했다. 설정 파일·환경변수·비밀 내용을 출력하거나 새로운 권한을 만들지 않았다.

## 5. 되돌리기와 후속 순서

1. JS 응답·화면에 이번 규칙으로 인한 문제가 재현되면 위 Cache Rule만 비활성화한다. 원본 파일·Access·DDoS 설정은 유지한다.
2. 의도하지 않은 응답이 캐시됐으면 영향 URL·변형을 먼저 특정한 뒤 그 범위만 purge한다. 이번에는 purge하지 않았다.
3. 새 알림의 수정·비활성화는 위 이름의 알림에만 적용한다. 기존 $10·자동 생성 알림은 보존한다.
4. 알림의 실제 수신, AWS 비용 알림·MFA, R2 권한·TLS, DNSSEC와 독립 복구를 다음 확인 항목으로 둔다.
5. 요청 제한은 실제 방문자 IP 처리·대표 정상 흐름·공유 IP·관리자 작업을 시험하고 모의 계산을 관찰한 뒤 활성화한다.
   Nginx dry-run과 Cloudflare 요청 제한은 아직 설정하지 않았다. Bot Fight·Under Attack·Hotlink도 새로 켜지 않았다.
6. 30분·다음 날·7일 관찰은 남아 있다. 이번 즉시 확인을 장기 관찰 완료로 보고하지 않는다.

앱 코드·서버 설정·이미지 배포·DB·DNS·방화벽·결제 플랜은 변경하지 않았다. 기존 사용자 작업 트리 변경과
동시 진행 중인 배포 문서는 보존하며 commit·push는 하지 않았다.

## 6. 후속 적용: 오류 캐시 방지와 새 배포 대응 준비

### 6.1 발견과 실제 수정

2026-09-20 후속 점검에서 운영 이미지의 공개 자산은 JS 19개·CSS 5개·배포 JSON 2개였다.
운영 Nitro 처리기는 경로로 등록된 정적 파일을 조회하며, 없는 정적 경로는 404를 반환했다.
컨테이너 내부에서 JS·CSS 24개의 정상/쿼리/합성 쿠키/합성 Authorization/HEAD 120회 응답을 확인했다.
본문은 이미지 파일 SHA-256과 같았고 정적 캐시 헤더가 유지됐다. 합성 문자열은 실제 인증 정보가 아니다.
[파일 목록](security-evidence/2026-09-20-static-inventory.json),
[원본 검사](security-evidence/2026-09-20-origin-static-before.json).

다만 원본의 JSON 404는 `no-cache`였고, 공개 경로를 `Accept: application/json`으로 요청하자
`Cache-Control: max-age=14400`, `CF-Cache-Status: MISS`가 확인됐다. HTML 404의 `no-store / BYPASS`와
달랐다. `no-cache`는 저장 금지를 뜻하지 않으므로 기존의 “오류는 no-store” 계약을 충족하지 못했다.

- [Nginx 설정](../../deploy/gateway/nginx.conf)에 최종 4xx·5xx의 `Cache-Control: no-store`를 추가했다.
- 정상·redirect 응답은 원본 Cache-Control을 유지한다. 헤더 중복을 피하도록 프록시의 원본 헤더는
  숨기고 정규화한 값 하나를 전달한다. 오류 상태·본문·권한·요청 횟수 제한은 바꾸지 않는다.
- [격리 회귀 검사](../../deploy/gateway/test-gateway.py)에서 401/403/404/500, 게이트웨이 404/413,
  정상 정적/비공개/정책/redirect 응답, 헤더 중복 없음, 기존 인증 전달·로그 비밀 배제·Web 교체를 확인했다.
  테스트 컨테이너·네트워크 정리까지 통과했다.
- [제한된 갱신 도구](../../deploy/gateway/update-cache-policy-server.py)로 기존 해시·호스트·mount를
  확인하고 후보 `nginx -t`, 원본 백업, 같은 inode 갱신, 실제 `nginx -t`, graceful reload를 수행했다.
  컨테이너 재생성·앱 배포 없이 gateway health `UP`과 컨테이너 내부 파일 해시를 확인했다.
- 운영 설정 SHA-256: `9728047ec8f6309794ab0f6fa96dc8c1cbf9f783ea9240dc778ff9b954d64555`.
  이전 사본은 서버의 `/opt/blariyo/gateway/nginx.conf.before-cache-6ef2abf4ecea`에 보존했다.

원본 Nitro의 JSON 오류 헤더 자체는 아직 `no-cache`다. 이번 보호는 실제 공개 경로의 게이트웨이에서
적용된다. Web 직접 공개 금지 계약은 유지한다. 이전에 Cloudflare에 저장된 오류 사본을 지우거나
만료시킨 작업은 하지 않았으므로 기존 캐시까지 즉시 정리됐다고 주장하지 않는다.

### 6.2 공개 검증의 판정

[1차 전체 공개 검사](security-evidence/2026-09-20-public-static-before.json)는 24개 자산을 대상으로
160회 순차 요청한 원자료다. 전체 PASS로 판정하지 않는다. 자산 쿼리 한 요청에서 네트워크 실패가
있었고, 검사 코드가 빈 게시판의 2페이지를 200으로 가정하거나 기존 쿼리에 두 번째 `?`를 붙이고
API의 허용되지 않은 쿼리를 추가한 오류가 있었다. 이 검사 결함은 운영 장애와 구분한다.

[재사용 검사 도구](../../scripts/verify-static-cache.py)는 명시적인 HTML/JSON Accept,
지원되는 API 쿼리, 빈 목록의 페이지 범위를 반영하도록 수정했다. 실제 파일 목록과 SHA-256을 받아
초당 최대 1회 순차 GET/HEAD로 검사한다. 전체 자산 100개·본문 8MiB 상한이 있으며, 읽은 본문·쿠키·
실제 인증값을 증거에 저장하지 않는다. `--expect-query-hit`는 경로 규칙 저장 후에만 사용한다.

적용 후 [공개 GET 30회](security-evidence/2026-09-20-gateway-cache-after.json)에서 JS·CSS 24개 모두
200·동일 SHA-256·기존 1년 immutable·HIT였다. 정상 HTML/API/health는 200·no-store·DYNAMIC,
새 JSON/HTML 404는 no-store·BYPASS였다. 이는 원래 URL의 HIT이며 **24개 전체의 쿼리 무관 캐시가
적용됐다는 뜻은 아니다.** 실패했던 자산과 수정한 HTML/JSON 제어 경로를 포함한
[추가 26회 검사](security-evidence/2026-09-20-static-retry-after.json)는 실패 0건이다.
공개 5xx 유발·부하 시험·브라우저 화면 재검증은 하지 않았다.

이번 헤더 변경으로 문제가 재현되면 갱신 도구에 `rollback: true`, 현재 NEW 해시를
`expected_sha256`, 보존한 OLD 해시 사본을 `config`로 전달한다. 도구는 두 고정 해시를 대조하고
같은 검증·graceful reload를 수행한다. 운영 rollback 자체를 시험하기 위해 적용을 다시 되돌리지는 않았다.

### 6.3 콘솔 연결 후 적용할 캐시 규칙

9월 20일 후속 세션의 브라우저 목록은 비어 있었고 도구 초기화 후에도
`Sky Computer Use native pipe startup failed`가 재현됐다. 따라서 Cloudflare 규칙 수정·AWS 예산
조회/생성·MFA 상태 조회·알림 수신 시험은 **미실행**이다. CLI의 브라우저 설정은 존재하지만 이 오류를
macOS 권한 거부나 AWS 로그인 실패로 단정할 증거는 없다. 기존 설정을 우회할 새 토큰은 만들지 않았다.

기존 9개 규칙을 다시 읽은 뒤 아래 후보로 교체하고 공개 검증을 수행한다. 아직 저장한 표현식이 아니다.

```text
(http.host eq "blariyo.com" and starts_with(http.request.uri.path, "/_nuxt/") and http.request.uri.path.extension in {"js" "css"})
```

- 이름 후보: `M0 Nuxt JS CSS - ignore query`.
- Eligible for cache, 쿼리 문자열 무시, **원본 Cache-Control을 따르고 없으면 우회**를 유지한다.
- 브라우저 TTL·상태별 TTL을 강제로 지정하지 않는다. HTML·API·이미지·배포 JSON은 범위 밖이다.
- Cache Deception Armor는 제공 여부와 MIME 동작을 검증한 뒤 보조 방어로 판단한다. 원본의 캐시 허용
  헤더가 보호를 덮어쓸 수 있어 오류 `no-store` 검사를 대신하지 못한다.
  [공식 설명](https://developers.cloudflare.com/cache/cache-security/cache-deception-armor/).
- 적용 후 전체 JS·CSS에 서로 다른 쿼리의 HIT·동일 해시, HTML/JSON 404의 비캐시, 정상 공개 흐름을
  확인한다. 실패 시 §2의 9개 표현식으로 복귀한다. 배포마다 신규 파일명·헤더를 검사하되 해시 경로의
  파일은 전체 purge하지 않는다. 구 버전 열린 탭의 자산 보존은 배포 정책의 별도 검증 항목이다.

AWS 예산은 [계획 §8.1](../system-design/09-security-cost-protection-plan.md#81-비용과-알림)의
월 $15, 실제 $5/$10/$15·예측 $15 후보를 기존 예산과 대조한 뒤 알림 전용으로 설정한다.
요청 제한·Bot Fight·Under Attack은 추가하지 않았다. 정상 공유 IP·모바일·관리자 흐름·장기 관찰은 남아 있다.

## 7. 이번 작업 마감과 남은 일

### 7.1 수행한 작업

이번 마감 단계에서는 기존 게이트웨이 수정의 상태를 재확인하고 재사용 점검 도구·문서를 보완했다.
이미 정상 적용된 설정을 다시 배포하거나 요청 제한을 추가하지 않았다. 브라우저 연결 재시도,
관리 API 인증 생성, Cloudflare/AWS 계정 설정 변경도 진행하지 않았다.

| 구분 | 한 일 | 최종 증거와 판정 |
| --- | --- | --- |
| 설정 보완 | 게이트웨이 최종 4xx·5xx 오류에 `no-store`, 성공·redirect 캐시 정책 유지 | §6의 격리 검사·운영 적용·공개 응답 확인 완료 |
| 서버 적용 도구 | 고정 전후 해시, 후보/실제 설정 검사, 백업·같은 inode 갱신·graceful reload·실패 시 복귀 | 적용 경로 실행 성공. 운영 rollback 재실행 시험은 미실행 |
| 공개 캐시 검사 도구 | 파일 해시, 쿼리 변형, GET/HEAD, 합성 쿠키/인증 헤더, HTML/JSON 오류 검사 | §6.2의 원자료·실패 원인·수정 후 결과 보존. 전체 차단 안전성 증거로 확대하지 않음 |
| 읽기 전용 SSH 도구 | [현재 서버·정적 파일 목록 수집](../../deploy/gateway/collect-security-state-server.py) 추가 | 실행 성공. 임시 파일에 있던 점검 절차를 저장소에서 다시 실행 가능 |
| 최종 서버 확인 | Nginx 파일 해시, gateway UP, 앱·DB healthy, wildcard TCP listener 22만, 앱/DB host port 미공개 | [최종 서버 증거](security-evidence/2026-09-20-server-final.json), 2026-09-20 15:53 KST |
| 자산 일치 | 운영 JS 19개·CSS 5개·배포 JSON 2개의 경로·크기·SHA-256 대조 | 이전 inventory와 전부 일치. 재배포된 다른 버전을 검사한 것이 아님 |
| 공개 읽기·인증 경계 | 기존 `check-public.py` 실행 | 공개 5개 경로 200, 정책 API 2개, 익명/위조 헤더 관리자 Access 이동, internal 404, HTTPS/www 전환 통과 |
| 문서 | 정본 계획·현재 상태·본 실행 기록 동기화 | 수행/미수행, 검증 한계, 다음 작업의 선행 조건 분리 |

최종 공개 검사는 로그인 이후 관리자 쓰기·이미지 발행·실제 브라우저 렌더링을 검사하지 않는다.
서버 listener 증거는 AWS 방화벽·모든 private interface·다른 리전 자원을 재조회한 증거가 아니다.
운영 설정·컨테이너·파일 목록은 시점별 증거이며 지속 모니터링으로 해석하지 않는다.

### 7.2 다시 점검하는 명령

아래 명령은 조회·로컬 증거 저장용이다. 저장소 루트에서 실행하고 기존 SSH 관리 경로를 사용한다.
출력 파일에는 상태·공개 자산 경로·해시만 저장한다. `.env`, 토큰, 쿠키, 실제 이용자 요청 로그를 읽지 않는다.

```sh
python3 deploy/operations/remote.py deploy/gateway/collect-security-state-server.py > /private/tmp/blariyo-security-state.json
python3 deploy/application/check-public.py
python3 scripts/verify-static-cache.py --inventory /private/tmp/blariyo-security-state.json --output /private/tmp/blariyo-static-check.json
```

마지막 명령은 자산 수에 비례해 여러 분 걸릴 수 있다. 기존 9개 규칙만 적용된 현재 상태에서는
`--expect-query-hit`를 붙이지 않는다. 후속 경로 규칙 저장 후에만 해당 옵션으로 전체 자산의 쿼리 재사용을
검증한다. 검사 실패 시 기록을 유지하고 네트워크 실패·검사 전제·실제 응답 회귀를 구분한다.
`update-cache-policy-server.py`와 설치·발행 명령은 조회 명령이 아니므로 상태 확인 목적으로 실행하지 않는다.

### 7.3 남은 작업과 재개 조건

아래 표는 **9월 20일 작업 종료 당시** 남은 항목이다. 앱 원본 JSON 오류의 운영 배포 항목은
9월 23일 후속 기록으로 해소됐으며, 콘솔 설정과 이용자 영향 항목은 별도 검증이 남아 있다.

| 우선순위 | 남은 일 | 현재 상태·재개 조건 | 완료 증거 |
| --- | --- | --- | --- |
| 1 | Cloudflare JS/CSS 경로 캐시로 전환 | 이번 범위 밖. 콘솔 또는 필요한 권한의 관리 API 연결 후 기존 규칙 재조회 | §6.3 표현식 저장·readback, 전체 자산 쿼리 HIT/해시·오류 비캐시·정상 흐름 |
| 1 | AWS 비용 예산·기존 Cloudflare 알림 수신 확인 | 이번 범위 밖. 기존 예산·수신자·크레딧 집계를 조회한 뒤 알림 전용 적용 | 예산 설정 readback와 실제 수신을 각각 기록. 자동 서비스 중단 없음 |
| 1 | AWS/Cloudflare 계정 MFA·root access key·다른 리전 자원 점검 | 관리 인증 필요. 실제 계정 상태 미검증, 자격 증명 변경은 사용자 직접 참여 | MFA 상태·불필요 키/자원 여부·필요 조치의 근거 |
| 2 | R2 공개 경로·권한·미디어 TLS·DNSSEC | 관리 접근과 실제 공개 이미지·등록기관 DS 처리 필요 | 우회 공개 URL 없음, 이미지 호환성, DNS 서명 검증·복구 절차 |
| 2 | 정상 흐름·공유 IP·실제 방문자 IP 신뢰 검사 | 격리 시험 데이터와 관리자 인증 필요. 아직 제한 임계값 미정 | 최대 게시글·이미지, 같은 IP 1/5/20명, 업로드·숨김, IPv4/IPv6 등 계획 시나리오 |
| 2 | 요청 제한 모의 계산 후 적용 | 위 정상 시험과 대표 관찰이 선행. Nginx dry-run·실제 차단 모두 미적용 | 개인정보 없는 제한 상태 집계·자원 여유·오탐·복귀 검증 |
| 2 | 앱 원본 JSON 오류 보완의 운영 배포 | 소스·로컬 build/HTTP 회귀 검사 완료(§9). 운영 원본 Nitro는 아직 `no-cache`, 게이트웨이 보호 유지 | 다음 배포 후 앱 직접 응답·게이트웨이·공개 응답의 HTML/JSON 오류 검사 |
| 3 | 기존 캐시 사본·구 버전 정적 파일 보존 | 기존 오류 사본 purge 미실행, 새 배포·오래 열린 탭 검증 미실행 | 영향 URL 특정, 필요 시 범위 purge/만료 확인, 구 탭 자산 로딩 |
| 3 | 백업 독립 사본·복원·비상 대응·장기 관찰 | 별도 복구 일정과 경과 시간 필요 | 계획의 대표 관찰·다음 날/7일 기록, 복원·되돌리기 결과 |

9월 23일 SHA `5c581c2` 배포에서 공개 HTML/JSON 404와 Web 직접 JSON 404의 `no-store`를 확인했다.
이는 위 앱 오류 배포 항목의 후속 결과이며 Cloudflare 규칙 확대나 모든 4xx/5xx 조합의 검증은 아니다.

정상 이용 검증이 부족한 상태에서 요청 수 제한값을 임의로 정해 활성화하지 않는다. 현재 비용 알림·
캐시·오류 비캐시는 과금 상한이나 모든 공격 방어를 보장하지 않는다. 향후 작업은 이 표와
[보안·비용 보호 적용 계획](../system-design/09-security-cost-protection-plan.md)을 함께 따른다.

기존 화면·콘텐츠·CI·배포 문서의 동시 작업은 이번 변경 범위에 포함하지 않았다. commit·push는 하지 않았다.

## 8. 현재 설정 유지와 다음 배포의 구분

현재까지 확인된 회귀 근거가 없으므로 적용한 설정을 선제적으로 풀지 않는다. 정상 이용을 위한 완화
기준은 [적용 계획 §10](../system-design/09-security-cost-protection-plan.md)에
문서화했다. 이 문서 갱신은 설정 변경·앱 구현·배포 완료를 뜻하지 않는다.

| 항목 | 지금 상태 | 다음 앱 배포와의 관계 |
| --- | --- | --- |
| JS 9개 쿼리 무관 캐시·Cloudflare 비용/DDoS 알림 | 운영 적용 기록 있음, 유지 | 앱 재배포 불필요. 새 JS 파일명은 기존 9개 규칙에 자동 포함되지 않아 별도 캐시 검토 필요 |
| 게이트웨이 오류 `no-store` | 운영 적용·검증 완료, 유지 | 앱 image 밖의 Nginx 설정. 앱 배포 때 기존 설정을 보존하고 공개 HTML/JSON 오류 헤더를 재검사 |
| 정상 이용 시 제한 완화 기준 | 문서 반영 | 앞으로 제한 규칙을 도입·조정할 때 사용. 다음 배포에 차단 기능을 자동 추가하지 않음 |
| 앱 원본 JSON 오류의 `no-store` | 9/20 소스·로컬 build/회귀 검사 완료. 9/23 SHA `5c581c2` 운영 배포 후 Web 직접 JSON 404와 공개 HTML/JSON 404 `no-store` 확인 | [9/23 배포 기록](../../worklog/2026-09-23/release/production-deployment-5c581c2.md)의 범위. 다음 배포의 오류 응답은 후보별 재검사 |
| JS/CSS 경로 캐시 전환·AWS 예산 등 | 미적용, 별도 관리 접근 필요 | 앱 배포와 독립된 설정 작업. 앱 배포를 기다릴 필요는 없지만 현재 허용 범위 밖이므로 보류 |
| 새 요청 횟수·봇 제한 | 미적용 | 정상 시나리오·모의 계산·대표 관찰 후 별도 적용. 임의 수치로 다음 앱 배포에 포함하지 않음 |

다음 앱 배포에서는 **기존 보호 유지 → 후보 앱·신규 자산 검증 → 배포 후 공개 응답 재확인** 순서를 따른다.
일반 배포마다 전체 정적 파일을 purge하지 않는다. 구 버전 열린 탭의 자산 보존과 필요한 범위의 캐시
변경은 [배포 실행서](deployment-runbook.md#4-이후-재배포-순서)에서 별도 확인한다.

## 9. 앱 원본 JSON 오류 보완 — 로컬 완료, 운영 배포 대기

이 제목과 아래 로컬 결과는 **9월 20일 당시** 상태를 보존한다. 9월 23일 운영 배포 후
[공개 HTML/JSON 404와 Web 직접 JSON 404의 `no-store`를 확인](../../worklog/2026-09-23/release/production-deployment-5c581c2.md#운영-검증)했다.
9월 24일에는 이를 다시 실행하지 않았으며, 다른 오류 조합·오래 열린 탭은 미검증이다.

9월 20일에는 관리 콘솔 없이 진행할 수 있는 소스·검증 작업을 수행했다. 당시 운영 설정·앱 image·DB는 변경하지 않았다.
당시 운영에서는 기존 게이트웨이 오류 캐시 금지가 보호했으며, 원본 앱 변경은 다음 배포 대상이었다.

- [Nuxt 설정](../../apps/web/nuxt.config.ts)의 `nitro:config`에서 기존 Nuxt HTML 오류 처리 뒤에
  [JSON 오류 처리](../../apps/web/server/error-handler.ts)를 연결했다. Nitro 2.13.4의 기본 오류
  처리 결과를 사용하므로 상태·본문·민감 오류 정제·보안 헤더는 유지하고 4xx·5xx Cache-Control만 바꾼다.
- 현재 버전에서 JSON 오류는 일반 `beforeResponse` 훅을 거치지 않고 전송될 수 있어 오류 처리 경로를
  사용했다. HTML 오류 화면은 기존 Nuxt 처리를 먼저 수행한다. 정상 응답과 요청 허용 여부는 변경하지 않는다.
- [실제 HTTP 회귀 검사](../../tests/http/web-cache.test.ts)를 추가했다. 빌드된 Web을 별도 loopback
  포트에서 실행하고 종료한다. 합성 설정만 사용하며 운영 인증·DB·Cloudflare를 사용하지 않는다.
- 수정 전 실제 빌드에서 없는 JS의 JSON 404가 `no-cache`여서 검사가 실패하는 것을 재현했다.
  검사 작성 중 Core 장애의 기대값(503)과 동적 게시판으로 해석되는 시험 경로도 계약에 맞게 바로잡았다.

| 검증 | 결과 |
| --- | --- |
| Nuxt production build | 통과 |
| Web typecheck·변경 Web 파일 ESLint | 통과 |
| tests typecheck·신규 HTTP 검사 ESLint | 통과 |
| 없는 JS/CSS·없는 화면의 HTML/JSON, 원래 URL/쿼리 변형 | 404·no-store, JSON 상태·nosniff 및 HTML 오류 문구 유지 |
| 로컬 빌드 JS 19개·CSS 5개 GET/HEAD·쿼리 | 200, 파일 SHA-256 일치, 기존 1년 immutable, HEAD 본문 없음 |
| health·익명 관리자 API·Core 연결 실패 | 기존 200/401/503·JSON·no-store 유지 |
| 검사 전체 | 상위 1개·하위 3개 테스트 통과, 실패 0 |

재실행은 저장소의 Node 24.18.0 환경에서 `npm run test:web-cache`를 사용한다.
production build를 실행했지만 HTTP 검사는 `NODE_ENV=test`의 격리된 설정으로 수행했다.
실제 배포 환경의 시작 검증·관리자 인증·DB 연동·브라우저 화면·이미지 발행·모든 4xx/5xx 조합을
통과했다는 뜻은 아니다. 로컬 JS/CSS의 파일명은 현재 운영 24개 자산과 다를 수 있다.
다음 배포에서 이 수정이 포함된 image를 확인한 뒤 원본·공개 오류 응답을 재검증한다.

## 10. 배포 요청 후 준비 상태와 기록 보존

사용자의 배포 요청 후 운영 원본 소스 보관본·manifest와 재배포 절차를 확인하고 기존 SSH로 서버를 조회했다.
[16:20 KST 배포 전 증거](security-evidence/2026-09-20-deploy-precheck.json)에서 기존 Web/API 이미지,
Nginx 적용 해시, gateway UP·컨테이너 healthy, 자산 26개를 확인했다. 이후 세션 전체 기록 요청에 따라
임시 조회 결과를 저장소로 보존하고 [전체 기록](../../worklog/2026-09-20/security-cost-protection/TASK.md)에 연결했다.

**새 후보 이미지 빌드·서버 업로드·이번 배포용 백업·컨테이너 교체·부팅 helper 변경·배포 후 시험은 미실행**이다.
운영 원본 소스에 오류 처리만 반영하고 구 자산을 보존하는 방식은 검토한 재개안이며 아직 구현·배포한 결과가 아니다.
§9의 로컬 검증 완료·운영 배포 대기는 **9월 20일 당시 판정**이다. 16:20 조회를 9월 23일 배포 후 또는 문서 갱신 시점의 재조회로 해석하지 않는다.
