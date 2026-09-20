# TASK-03 — Access 설정 검사 결과와 내부 인증키 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [Access 설정·운영자 매핑 계약 정합화](TASK-02.md)
- 사용자 증거: `check-blariyo-access.cjs --check-keys` 실행 결과
- 상태: **Access 로컬 설정 검사 통과. 내부 인증키 생성 도구 검증 완료, 실제 키 생성·서버 주입은 대기**

## 1. INFRA-14 후속 확인

사용자가 Node 24로 실행한 검사 결과를 제공했다. 아래는 사용자 제공 실행 증거이며,
이번 단계에서 같은 외부 요청을 다시 실행하지 않았다.

| 검사 | 결과 | 판정 범위 |
| --- | --- | --- |
| Access 파일 권한·인증 모드·issuer·AUD 형식 | PASS | 로컬 설정 형식 |
| 운영자 JSON | 실제 앱 파서 통과, 활성 1명 | 식별값은 기록하지 않음 |
| issuer 공개키 | 조회 성공 | 실제 로그인 JWT의 서명 검증은 아님 |

이전 기록에서 없었던 운영자 JSON이 준비되어 전체 설정 검사를 통과했다. 로컬 기본 경로
`~/.config/blariyo/admin-operators.json`을 검사했으며, 배포 시에는 BFF 전용 읽기 전용 mount와
`NUXT_ADMIN_OPERATORS_FILE`의 container 내부 경로가 필요하다.

실제 사용자 소유권, AUD가 해당 관리자 앱에 속하는지, 사용자 JWT의 서명·sub·AUD,
Cloudflare 정책 허용·거부, 서버 배포는 여전히 미검증이다.

## 2. INFRA-15 내부 인증 설정 준비

실행 코드를 확인해 인증키 이름과 주입 범위를 확정했다.

| 변수 | 사용 위치 | 관계 |
| --- | --- | --- |
| `SERVICE_TOKEN` | Nest Core API | Web의 서비스 토큰과 동일 |
| `NUXT_SERVICE_TOKEN` | Nuxt Web/BFF | Core에 내부 인증 header로 전달 |
| `NUXT_ACTOR_SECRET` | Nuxt Web/BFF만 | 서비스 토큰과 다른 난수, 내부 운영자 ID를 HMAC으로 가명화 |

- [Core 실행 코드](../../../../../apps/api/src/main.ts)는 `SERVICE_TOKEN`을 읽는다.
- [Core 인증 guard](../../../../../apps/api/src/http/auth.guard.ts)는 서비스 토큰을 최소 32바이트로
  검사하고 동일 길이의 입력과 `timingSafeEqual`로 비교한다.
- [BFF identity 코드](../../../../../apps/web/server/utils/identity.ts)는 actor secret을 최소
  32바이트로 검사한 후 내부 운영자 ID에 HMAC-SHA256을 적용한다.
- [인프라 설계](../../../../../docs/system-design/04-infrastructure-design.md)의
  `CORE_SERVICE_TOKEN`을 실제 이름 `SERVICE_TOKEN`으로 맞추고, 같은 값/별도 값 관계와
  container별 주입 범위를 명시했다. 앱 코드는 이번 단계에서 변경하지 않았다.

이 두 키는 외부 서비스에서 발급받는 API 토큰이 아니다. 로컬에서 암호학적으로 안전한 난수를
생성한다. 같은 파일을 두 container에 통째로 주입하면 BFF 전용 actor secret이 Core에도 전달되므로,
배포 설정에서는 필요한 변수만 각각 전달해야 한다.

## 3. 생성·검사 도구

- 파일: `~/task_list/prepare-blariyo-internal-auth.cjs` (저장소 외부 로컬 보조 도구)
- 기본 실행: 기존 파일의 소유자·권한 `600`·형식·키 관계만 검사한다.
- `--create`: 파일이 없을 때만 서비스 인증키와 actor secret을 각각 32바이트 난수로 생성한다.
  저장 형식은 작은따옴표로 감싼 64자리 hex 문자열이며 서비스 키는 두 변수에 같은 값으로 저장한다.
- 보관 경로: `~/.config/blariyo/internal-auth.env`.
- 기존 파일을 덮어쓰거나 권한을 바꾸지 않는다. 중복 항목, 누락, 토큰 불일치, 두 키 재사용,
  잘못된 권한, 파일·보관 디렉터리의 심볼릭 링크를 거부한다.
- 비밀값·원문 오류를 출력하지 않으며 네트워크 요청·서버 설정 변경은 없다.

사용자 실행 명령은 한 줄이다.

```sh
/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node /Users/zeaha/task_list/prepare-blariyo-internal-auth.cjs --create
```

이번 작업에서는 실제 운영 키를 생성하지 않았다. 임시 디렉터리의 테스트 키로만 도구를 검증했다.
실제 로컬 키 생성 성공은 위 명령 결과로 별도 확인한다. 이 파일은 로컬 준비용이며,
운영 서버 secret 소유권·주입 방식은 [보안·운영 설계](../../../../../docs/system-design/05-security-operations.md)를 따른다.

## 4. 검증 결과와 남은 작업

| 검증 | 결과 |
| --- | --- |
| helper `node --check`, `--help` | 통과 |
| 생성·권한·키 분리·재실행 시 바이트 보존 | 임시 파일에서 통과 |
| 읽기 전용 실행 시 파일·디렉터리 미생성 | 통과 |
| 기존 파일 권한·형식 오류 시 원본 보존 | 통과 |
| 값 불일치·키 재사용·항목 누락·중복·알 수 없는 항목 거부 | 통과 |
| 파일·디렉터리 symlink 및 타인 쓰기 가능 디렉터리 거부 | 통과 |

격리 검사: `/private/tmp/blariyo-internal-auth.test.cjs`, Node test 5개 통과, 실패 0개.
앱 구현 변경이 없어 기존 앱 테스트를 반복하지 않았다. 실제 Web→Core 인증, container 주입,
production Compose, DB 역할·암호, 서버 배포와 운영 검증은 아직 완료하지 않았다.

다음 순서는 실제 로컬 키 생성 결과 확인 후 production 설정·DB 역할과 secret 주입 준비다.
실제 관리자 로그인은 배포 후 별도 검증 항목으로 유지한다. commit·push·배포는 수행하지 않았다.
