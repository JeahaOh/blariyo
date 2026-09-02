# Blariyo 개발 Spec 정본 라우팅

기획에서 개발 Spec을 만들 때 모든 문서를 읽지 않고 대상 기능과 직접 연결된 정본·증거만 선택한다.
개발 Spec은 상위 정본을 복제하거나 재정의하지 않고 기능별 구현 흐름과 매핑을 소유한다.

## 입력 라우팅

| 입력 기능·질문 | 우선 정본 | 함께 확인할 문서·증거 |
| --- | --- | --- |
| 서비스 범위, 게시 규칙, milestone | `docs/planning/01-service-plan.md` | 화면·인프라 기획, 관련 system-design |
| 운영 형태, 비용 경계, provider 전제 | `docs/planning/02-infra-plan.md` | system-design `01`, `04`, `05` |
| 화면, route, 상태, 반응형 동작 | `docs/planning/03-screen-design.md` | publishing·wireframes, system-design `01`, `03` |
| 분석, 동의, 광고 활성화 | `docs/planning/04-analytics-ad-plan.md` | legal 쿠키·개인정보, system-design `01`, `03`, `05` |
| 비교 기준과 수용 조건 | `docs/planning/05-benchmark-spec.md` | 서비스·화면 기획 |
| 문구와 색상 | planning `06`, `07` | 화면 기획과 publishing; 기능 계약에 필요한 항목만 |
| 콘텐츠 수집 | `docs/planning/content-collection/README.md` | 서비스 기획 §8, system-design `01`, `02`, `03`, `05`, legal |
| 개인정보·권리·쿠키 | `docs/legal/`의 관련 문서 | planning의 출시 단계, system-design `02`, `03`, `05` |

후속 단계의 문구나 화면이 존재한다는 사실만으로 그 기능을 현재 개발 범위에 포함하지 않는다.
각 planning의 milestone과 활성화 gate를 우선한다. publishing과 wireframe은 planning과 비교하는
정적 증거이며 구현 완료나 제품 결정의 근거로 단독 사용하지 않는다.

## 공통 기술 계약 라우팅

| 확인할 계약 | 공통 정본 | 개발 Spec에 적을 내용 |
| --- | --- | --- |
| 시스템 경계와 주요 흐름 | `docs/system-design/01-system-architecture.md` | 대상 기능의 consumer·provider와 호출 순서 |
| 데이터와 migration | `docs/system-design/02-data-model.md` | 기능이 읽고 쓰는 entity·상태·제약 매핑 |
| 외부 BFF와 내부 Core API | `docs/system-design/03-api-design.md` | 작업별 request·response·validation·오류와 공통 계약 링크 |
| 인프라와 배포 | `docs/system-design/04-infrastructure-design.md` | 기능에 직접 영향을 주는 환경·자원 제약 링크 |
| 보안과 운영 | `docs/system-design/05-security-operations.md` | 권한, secret 경계, logging·monitoring·복구 요구 링크 |

공통 envelope, 인증 방식, 전역 오류 원칙, 공통 상태 정의와 운영 기준은 기능 Spec마다 반복하지 않는다.
기능이 공통 계약과 다른 동작을 요구하면 예외를 임의 확정하지 말고 해당 system-design 정정과 승인을
선행 조건으로 남긴다.

## 출력 라우팅

기능별 출력 루트는 `docs/development-specs/<milestone>/<feature-slug>/`다.

| 산출물 | 소유하는 내용 | 주 입력 |
| --- | --- | --- |
| `<feature-slug>.dev.md` | 요구사항 추적, 범위, 결정, 미정·차단, API·프로세스·화면 목록 | planning·legal·관련 system-design |
| `api/<operation>.md` | 한 작업의 API 구현 계약 | 개발 보강서, API 공통 계약, 데이터·보안 계약 |
| `d01/<process>.md` | 행위자와 시스템의 순차 처리·실패·상태 전이 | 개발 보강서와 API Spec |
| `d08/<screen-or-program>.md` | 화면·프로그램의 UI 상태·이벤트·API 매핑 | 화면 기획, 정적 비교 자료, 개발 보강서, API·D01 |

API가 없으면 `api/`에 빈 파일을 만들지 않는다. 프로세스나 화면·프로그램이 여러 개면 D01과 D08을
각각 분리한다. 파일명은 URL이나 표시명을 그대로 쓰지 않고 안정적인 lowercase kebab-case slug를 쓴다.

## 충돌 처리

1. 제품 범위·milestone·화면 규칙 충돌은 planning을 먼저 정정한다.
2. 공유 데이터·API·인프라·보안 계약 충돌은 system-design을 먼저 정정한다.
3. 기능 내부 흐름·UI·API 매핑 충돌은 development-specs에서 정정한다.
4. source·OpenAPI·migration·test가 Spec과 다르면 구현 drift로 기록하고 문서를 근거 없이 실행 상태에 맞추지 않는다.
5. 사용자 요청 범위에 상위 정본 수정이 없으면 변경하지 않고 대상 파일, 영향과 필요한 결정을 보고한다.
