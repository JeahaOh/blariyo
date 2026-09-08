# M0 수집 보조 설계 기준선 manifest v1

- 상태: v1 범위 명세·문서 검수 완료, 기술·법무 조건부
- 기준선 tag: `design/m0-collection-assist/v1`
- tag 종류: annotated design tag
- 선행 기준선: `design/m0-core/v1`
- 현행 준비 판정: [M0 수집 보조](../system-design/design-readiness.md#현재-판정) 조건부 확정 가능

이 manifest는 M0 Core에 더하는 수집 보조 delta다. M0 Core 공개와 collector 활성화는 분리한다.

## 포함 범위

| 계층 | 정본 | 포함 절·범위 |
| --- | --- | --- |
| planning | [01-service-plan.md](../planning/01-service-plan.md) | §1의 `M0 수집 보조` 행, §5 수집 후보 관리자 화면 문장, §8, §10의 수집 요구사항, §14의 `M0 수집 보조`와 `수집 서버 전환 범위`. 자동 목록 수집 문장은 제외 경계로만 참조 |
| planning | [02-infra-plan.md](../planning/02-infra-plan.md) | M0 운영 목표의 collector 분리, §7의 `M0 수집 보조` 행, §10의 수집 보조 활성화 조건 |
| planning | [03-screen-design.md](../planning/03-screen-design.md) | §2의 수집 후보·출처 관리자 화면, `관리자 게시글 화면`의 수집 진입, §§2~4 관련 공통 UI, §13의 `M0 수집 보조` |
| planning | [content-collection/README.md](../planning/content-collection/README.md) | §§1~2의 수집 보조, §3.2, §§4~8, §9의 `M0 수집 보조`, §10, §11, `출처별 공통 추출·임시 파일 규칙`, `Spring 수집 서버 전환 결정`. §3.3·`M0 자동 수집` 절 제외 |
| planning | [source-spec-template.md](../planning/content-collection/source-spec-template.md) | 전체 |
| planning | `docs/planning/content-collection/sources/*.md` | arcalive, bobaedream, clien, dcinside, dmitory, dogdrip, etoland, fmkorea, goodgag, humoruniv, instiz, inven, mlbpark, natepann, pgr21, ppomppu, ruliweb, theqoo, todayhumor, yuldo 20개 파일 전체. 각 파일의 §5 목록·feed는 사용하지 않는다는 제외 경계이며, §1~4·§6~10의 단일 상세 페이지·권리·운영·활성화 계약을 설계 입력으로 사용한다. 실제 허용 승인이 아님 |
| legal | [README.md](../legal/README.md) | `공통 정책 계약`의 수집 단계 경계와 `출시 차단 항목`의 `M0 수집 보조·자동 수집` 행 중 단일 상세 페이지 수집 보조 조건 |
| system | [README.md](../system-design/README.md) | M0 수집 보조 범위·핵심 결정·Spring 수집 서버 준비 상태 |
| system | [01-system-architecture.md](../system-design/01-system-architecture.md) | §4 `Collector 전용 중계 경계`, §5의 수집 후보 생성·초안 승격, `Spring 수집 서버 전환 계약` |
| system | [02-data-model.md](../system-design/02-data-model.md) | §6 수집 데이터, §7의 후보 전이, §9~11의 수집 보존·migration/gate, `Spring 수집 배치 저장 경계` |
| system | [03-api-design.md](../system-design/03-api-design.md) | `5-1 수집 관리자 API`, 수집 관련 상태·오류·gate, `Spring 수집 서버의 실행 API와 기존 중계` |
| system | [04-infrastructure-design.md](../system-design/04-infrastructure-design.md) | §6의 collector 환경·secret 경계, §8의 preview/local temp 예산, §10 이전 절의 Quartz 중지/재개, `로컬 Spring 수집 서버 배치 경계` |
| system | [05-security-operations.md](../system-design/05-security-operations.md) | §2 수집 위협, §4 `수집`, collector secret·log·monitoring·배포 gate, §12 `수집 실패와 차단`, §13 출처 점검, `Spring 수집 전환의 보안·운영 조건` |
| system | [07-spring-collector-design.md](../system-design/07-spring-collector-design.md) | 전체 |
| system | [design-readiness.md](../system-design/design-readiness.md) | 상태 정의·변경 규칙과 `M0 수집 보조` 행 |
| development spec | [collection-assist.dev.md](../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md) | 전체 |

## 제외 범위

- M0 자동 수집의 목록·feed·pagination 자동 발견, 목록 scheduler, 자동 발행과 출처별 자동 수집 활성값.
- M1 회원, M1.5 익게, GA4·광고·제휴 활성화.
- Spring source 생성과 기존 Python source 수정·삭제. Python 재가동은 별도 승인·호환 검증 대상이다.
- 출처 문서의 존재만으로 robots·이용약관·권리·parser selector와 수집 허용을 승인하지 않는다.

## 남은 gate와 미검증

- Spring source, Core/local migration, OpenAPI, generated type, test·build·runtime, PostgreSQL/Keychain/
  launchd/Discord/Core·BFF/R2 연동과 fault test는 미구현·미검증이다.
- 실제 출처별 URL·path·redirect·robots·이용 조건·parser, interval/daily limit, User-Agent 연락처와
  운영자의 출처 사용 결정이 필요하다.
- Discord Application·guild/channel/user/role, Core credential, 운영 PC·OS 계정·설치 경로는 실값이다.
- collector가 미구현·중단이어도 M0 Core 공개 읽기·관리자 수동 작성·예약 발행·백업은 계속 가능해야 한다.

## Annotated tag 계약

tag annotation은 `Blariyo design baseline: M0 Collection Assist v1`, 이 manifest 경로,
`requires design/m0-core/v1`, `design only`, 구현 수용과 collector 활성화 제외를 기록한다. commit SHA는
tag 생성 뒤 readback 기록에서 확인한다.
