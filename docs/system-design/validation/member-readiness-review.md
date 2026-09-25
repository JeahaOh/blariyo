# M1·M1.5 확정 전 검증 결과

- 확인일: 2026-09-08
- 상태: 수행 가능한 문서·오프라인 검증 완료, 운영값과 실제 구현 검증 미완료
- 기준선 분리·태그·병합: 미실행. 검증 완료 조건이 남아 있어 확정하지 않음.

## 수행 결과

| 항목                     | 결과                                           | 증거·한계                                                                                                                   |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 법무 근거·문구 검토      | 완료, 최종 적법성·운영 발행 미확정             | [동의 전문 검토](../../legal/signup-privacy-consent.md#6-근거-검토-결과-2026-09-08). 파기 접수와 완료 표현 보완             |
| 이름 단어·전체 조합 검사 | 224개 단어 문맥 검토, 262,144개 기계 검사 완료 | [사전 검수](../../planning/09-random-name-catalog.md#6-초도-사전-검수-결과-2026-09-08). 모든 문구를 사람이 읽은 결과는 아님 |
| 생일·제약 설계 모델      | 21개 검사 통과                                 | Python 날짜 및 SQLite 메모리 모델. 생일 전날/당일·자정·윤일·입력 오류·고유 제약·FK·탈퇴 후 이름 보존                        |
| 운영 설정                | 확인 범위의 소스 기본값 미설정                 | 아래 조사 범위. 비밀 값을 읽거나 출력하지 않음                                                                              |
| 실제 M1·M1.5 코드        | 검사 대상에서 확인되지 않음                    | 회원·익게 migration/route/화면/테스트가 없으므로 실행 통합 검증 불가                                                        |
| 문서 안전성              | 파손된 법무 README 표 3행 복구                 | 기존 링크 검사로는 표 열 불일치를 찾지 못했으므로 표 열 검사 추가                                                           |

재현 명령: `python3 docs/system-design/validation/check-member-design.py`.
이 스크립트는 제품 구현을 import하지 않는다. PostgreSQL transaction·잠금·worker·OAuth·브라우저·운영 배포의
대체 테스트가 아니다. 기존 M0 테스트를 실행해 M1·M1.5 완료 증거로 사용하지 않는다.

## 실제 작업 트리와 운영값 조사 범위

- 기획 트리 `planning-design-only`, HEAD `0ade2e4`: 애플리케이션 source 없음.
- 별도 구현 트리 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-m0-core`, `feature/m0-core`, HEAD `2bb8396`:
  미커밋 M0·수집 보조 작업 존재. 기존 변경을 수정하지 않고 source·migration·계약·테스트 파일을 조회함.
- 검색 키: `IdentityService`, `CommunityService`, `thread_participant`, `AGE_REQUIREMENT_NOT_MET`,
  `ALIAS_ALLOCATION_UNAVAILABLE`, `SIGNUP_PRIVACY`. 확인 대상 source에서 일치 없음.
- `apps/web/nuxt.config.ts`: 운영자 표시명·개인정보 담당자·일반/권리/개인정보 문의 이메일 기본값은 빈 문자열,
  siteOrigin은 localhost. 배포 환경에서 덮어쓴 값은 확인하지 않았으므로 실제 운영 설정 전체가 비었다고 단정하지 않음.
- `apps/web/server/plugins/production.ts`: 법무 필수값을 검사하는 M0 guard는 존재하지만 실제 설정·연락처 수신 증거가 아님.
- M1 네 제공자의 실제 앱 등록·callback·secret 관리·fresh-auth·revoke·알림·정책 발행 증거는 미확인.
- 로컬 PATH에서 psql/postgres를 찾지 못함. DB 실행 검증은 수행하지 않음.

## 완료에 필요한 입력과 실행

1. 운영자 표시명·담당자·접수 이메일·운영 도메인·실제 호스팅/이메일 계약 정보와 안전한 설정 위치.
   secret은 대화나 문서에 붙이지 않고 secret manager/file 존재와 adapter 호출 성공으로 확인한다.
2. 30일 guard·8주 백업/ledger·신고 90일의 목적·최소 기간·대체 수단·권리 영향 판단 및 운영 책임자 확정.
   이 기간은 임의의 법정 의무로 확정하지 않는다. 가입 전 임시 소셜 정보 처리와 국외이전 계약도 함께 확인한다.
3. 실제 M1·M1.5 구현 또는 검증 가능한 구현 작업 트리. 현재 코드가 없으므로 전체 구현 작업이 선행되어야 한다.
4. [기술 수용 조건](../06-member-community-design.md#acceptance)의 PostgreSQL 경쟁·worker 재시작·실제 provider 인증·
   탈퇴·로그 미잔존·백업 복원·브라우저 접근성 테스트와 결과 증거.

이 항목들이 완료되기 전에는 설계 추정 완성도 수치를 올려 검증 완료를 대신하지 않는다.
