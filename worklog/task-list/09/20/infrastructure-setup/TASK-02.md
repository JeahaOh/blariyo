# TASK-02 — INFRA-14 Access 설정 확인과 운영자 매핑 계약 정합화

- 기록일: 2026-09-20, KST
- 이전 기록: [운영 준비 task 목록](TASK-01.md)
- 사용자 요청: 다음 작업 진행
- 상태: **진행 — 설정 파일·공개키 확인과 운영자 매핑 구현 완료. 실제 사용자 UUID 등록·로그인 검증은 남음**

## 1. 이번에 확인한 실제 상태

| 항목 | 결과 | 범위 |
| --- | --- | --- |
| `~/.config/blariyo/cloudflare-access.env` | 존재, 본인 소유, 권한 `600` | 실값 비출력 |
| `NUXT_ADMIN_AUTH_MODE` | `access` 형식 정상 | 설정 검사 |
| `NUXT_ACCESS_ISSUER` | 팀 HTTPS URL 형식 정상 | 설정 검사 |
| `NUXT_ACCESS_AUDIENCE` | AUD 64자리 형식 정상 | 올바른 앱의 AUD인지 실제 JWT로 확인한 것은 아님 |
| issuer의 `/cdn-cgi/access/certs` | 공개 RSA 키 조회 성공 | 로그인 없이 공개키만 조회 |
| `~/.config/blariyo/admin-operators.json` | 아직 없음 | 생성·권한 부여하지 않음 |

이전 TASK의 AUD 저장 미확인 상태 이후, 실제 파일 존재와 형식을 새로 확인했다.
과거 기록은 당시 상태로 보존한다. 원본 자격증명·사용자 식별값은 문서나 출력에 복사하지 않았다.

## 2. 확인한 불일치와 변경

기술 정본은 `identity`, `operatorId`, `active` 항목의 JSON 목록을 요구했으나 실제 코드는
subject→operatorId 객체를 읽고 있었다. 운영자 비활성 상태를 명시적으로 처리할 수 있도록
기존 목록 계약에 구현을 맞췄다.

- [인프라 설계](../../../../../docs/system-design/04-infrastructure-design.md): BFF 인증 환경 변수명을
  실제 Nuxt runtime config와 일치시켰다. 기존 목록 계약, stable operatorId, BFF 전용 mount를 유지했다.
- [Access 검증 코드](../../../../../apps/web/server/utils/access.mjs): `parseAdminOperators()`를 추가했다.
  모든 항목의 문자열·boolean 형식과 identity 중복을 검증한 후 활성 목록을 만든다.
- `active: true`인 등록 identity만 허용한다. 비활성·미등록·중복 identity, 잘못된 항목,
  기존 객체 형식은 거부한다. 이메일을 JWT `sub` 대신 허용하지 않는다.
- 기존 JWT 서명·issuer·audience·만료 검증과 Core로 전달하는 identity 경계는 유지했다.
- [Docker fixture](../../../../../scripts/fixtures/docker-admin-operators.json),
  [인증 계약 테스트](../../../../../tests/auth-contract.test.ts),
  [README](../../../../../README.md),
  [보안·운영 설계](../../../../../docs/system-design/05-security-operations.md)를 함께 맞췄다.

변경 후 형식은 다음과 같다. 아래는 양식이며 실제 사용자 등록 파일이 아니다.

```json
[
  {
    "identity": "<Cloudflare Access user_uuid / JWT sub>",
    "operatorId": "<안정적인 내부 운영자 ID>",
    "active": true
  }
]
```

기존 subject→operatorId 객체를 사용하는 환경은 목록으로 바꿔야 한다. 운영 서버의 기존 매핑을
자동 변환하거나 권한을 확대하지 않았다. 나머지 배포 환경 변수·DB role 정합화는 INFRA-15에 남긴다.

## 3. 로컬 설정 검사 도구

- 새 파일: `~/task_list/check-blariyo-access.cjs` (저장소 외부 보조 도구).
- 기본: Access 환경 파일 및 운영자 JSON의 소유자·권한·형식을 검사한다.
- 운영자 JSON은 실제 앱의 `parseAdminOperators()`로 읽는다. Cloudflare UUID 형식과 활성 항목도 확인한다.
- `--check-keys`: issuer의 공개키 조회를 추가한다. API token·JWT·로그인 쿠키를 요구하지 않는다.
- 설정 파일에 `NUXT_ADMIN_OPERATORS_FILE`이 없으면 로컬 기본 `admin-operators.json`을 검사한다.
  이 기본값은 검사기 전용이다. 실제 BFF 배포에는 읽기 전용 mount 경로를 환경 변수로 주입해야 한다.
- 파일·콘솔·API를 변경하지 않는다. 사용자 identity, AUD, 원문 오류는 출력하지 않는다.

```bash
~/.nvm/versions/node/v24.18.0/bin/node ~/task_list/check-blariyo-access.cjs --check-keys
```

이번에는 운영자 파일이 아직 없어 이 명령의 전체 실설정 검사는 완료하지 않았다.
helper 문법·도움말·격리 테스트와 별도의 실제 issuer 공개키 조회만 수행했다.

## 4. 검증 결과

| 검사 | 결과 |
| --- | --- |
| `node --test tests/auth-contract.test.ts` | 3개 테스트 통과 |
| 활성·비활성·미등록·이메일 대체·중복·malformed 목록, 서명·issuer·audience·만료 | 격리된 JWT fixture에서 검증 |
| `npm run typecheck:web` | 통과 |
| `npm run lint -w @blariyo/web` | 통과 |
| `npm run typecheck:tests` | 통과 |
| 변경 인증 테스트 ESLint | 통과 |
| helper `node --check`, `--help` | 통과 |
| helper의 잘못된 설정, 공개키 성공·실패, 파일 권한·symlink 차단 | 임시 fixture 검사 통과 |
| 실제 팀 issuer 공개키 조회 | 통과 |

전체 Docker E2E, 운영자 본인의 실제 JWT 검증, Cloudflare 정책의 허용·거부, 서버 배포는
실행하지 않았다. 공개키 조회 성공만으로 AUD와 사용자 mapping이 맞는다고 판정하지 않는다.

## 5. 바로 다음 단계

1. MFA로 로그인한 App Launcher와 같은 브라우저에서 팀 도메인의
   `/cdn-cgi/access/get-identity`를 연다.
2. 본인 이메일인지 확인한 뒤 `user_uuid`만 로컬 운영자 JSON의 `identity`에 넣는다.
   반환 JSON 전체·JWT·쿠키를 채팅에 복사하지 않는다.
3. 내부 `operatorId`는 최초 지정 뒤 동일 운영자에 대해 유지한다. JSON을 권한 `600`으로 보관하고
   검사기를 실행한다.
4. 실제 JWT의 `sub`, AUD와 매핑 일치는 후속 인증 시험으로 확인한다.

공식 근거: [Access application token과 user identity](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).
`sub`는 조직 내 사용자 ID이며 사용자를 삭제 후 재등록하면 바뀔 수 있으므로 이메일이나
Cloudflare Account ID를 매핑 identity로 대신 사용하지 않는다.

이번 단계에서 secret 파일 쓰기, Cloudflare 설정 변경, 서버 배포, commit·push는 수행하지 않았다.
