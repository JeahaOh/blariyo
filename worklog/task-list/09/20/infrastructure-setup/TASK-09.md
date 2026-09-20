# TASK-09 — 서버 초기 migration 완료 확인과 앱 공개 연락처 입력 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [image 검증 호환성 수정](TASK-08.md)
- 상태: **실제 서버 migration·권한 사용자 PASS. 앱 기동 필수 연락처 입력 양식 준비, 정책 확정·발행과 앱 배포는 미완료**

## 1. 사용자 실행 결과

사용자가 수정 도구의 `--apply` 실행 결과를 제공했다. 에이전트가 같은 서버 migration을
다시 실행하거나 별도 DB readback을 수행한 증거와 구분한다.

| 단계 | 사용자 출력 |
| --- | --- |
| image 전송·대상 DB·내부 network·amd64 image·초기 묶음 확인 | PASS |
| 변경 전 DB 사본 | `/opt/blariyo/postgresql/before-initial-migration-b66b9e751586.dump` 저장 PASS |
| 앱 migration | V001–V005, ledger SHA-256 일치 PASS |
| app | readiness·테이블 조회 PASS, DDL·ledger 접근 차단 PASS |
| backup | 조회 PASS, 쓰기 차단 PASS |

현재 완료 범위는 초기 앱 스키마와 역할별 권한·SQL 검사다. 변경 전 사본 저장은 정기
암호화 R2 원격 백업·복원 완료를 뜻하지 않는다. 앱 container·실제 관리자 로그인도 아직 미검증이다.

## 2. 다음 기동 조건을 source에서 확인

- [Core 설정](../../../../../apps/api/src/bootstrap/config.ts)은 production에서 `LEGAL_CONFIG`를 검증한다.
- [연락처 검사](../../../../../apps/api/src/features/policies/policy-artifact.ts)는 운영자 표시명·일반 문의·
  권리 문의·개인정보 문의 이메일·담당자 5개를 요구한다.
- [Web 운영 검사](../../../../../apps/web/server/plugins/production.ts)도 동일한 공개 설정을 요구한다.
- [Core main](../../../../../apps/api/src/main.ts)은 서버 listen 전에
  [정책 준비 검사](../../../../../apps/api/src/features/policies/policies.service.ts)를 실행한다.
  현재 적용되는 TERMS·PRIVACY 두 정책이 DB에 없으면 `POLICY_RELEASE_REQUIRED`로 중단한다.
- 저장소 [법무 정본](../../../../../docs/legal/README.md)은 여전히 초안·공개 전 확정 조건을 포함한다.
  정책 본문과 시행일을 임의로 확정하거나 검사 flag를 우회하지 않는다.

로컬 보관 디렉터리의 파일명만 확인했으며, `public-contact.json`은 아직 없었다. 다른 위치에
정리한 실제 정보·최종 정책 파일이 있는지는 사용자에게 경로 또는 준비 상태를 요청했다.
이메일·운영자 식별값·비밀 원문을 요구하거나 출력하지 않았다.

## 3. 준비한 도구와 검증

[연락처 준비 도구](../../../../../deploy/application/prepare-public-config.cjs)와
[사용 안내](../../../../../deploy/application/README.md)를 추가했다.
맥 진입점은 `/Users/zeaha/task_list/prepare-blariyo-public-config.cjs`다.

- `--create`는 `~/.config/blariyo/public-contact.json`이 없을 때만 빈 문자열 5개를 권한 600으로 생성한다.
- 기존 파일과 권한은 바꾸지 않는다. 본인 소유 일반 파일·크기·권한·JSON 항목을 검사한다.
- 값 입력 후 기본 실행은 실제 빌드된 Core의 `assertLegalConfig`로 형식을 확인한다.
- 양식 생성·연락처 형식 통과와 법무 확정·이메일 수신·정책 발행·앱 기동을 분리해 출력한다.
- 도구는 네트워크 호출·서버 배포·정책 발행·입력값 출력을 하지 않는다.

합성 연락처와 임시 디렉터리에서 600 양식 생성, 기존 값·권한 보존, 빈 값·잘못된 이메일·미정
문구·부적절한 권한·symlink·알 수 없는 항목 거부, 실제 앱 파서 통과를 확인했다. CLI help 통과.
테스트 디렉터리는 정리했다. 실제 사용자 보관 파일은 생성·수정하지 않았다.

## 4. 사용자 다음 단계

```sh
/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node /Users/zeaha/task_list/prepare-blariyo-public-config.cjs --create
open -e ~/.config/blariyo/public-contact.json
```

공개할 실제 정보를 입력한 뒤 `--create` 없이 검사한다. 연락처 준비 뒤에는 확정할 정책의
본문·시행일·적용 범위를 확인하고 정책 발행 및 앱 구성으로 이어간다. 공개 전 필요한 전체 항목은
[운영 실값 체크리스트](../../../../../docs/development-specs/m0-core/decisions/operational-values-checklist.md)를 따른다.
입력 5개가 완료돼도 전체 공개 조건이 자동으로 충족되는 것은 아니다.

기존 사용자 변경을 보존했다. commit·push·서버 변경·원격 API 호출은 하지 않았다.
