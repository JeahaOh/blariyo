# 모듈화·재사용성·미사용 코드 검토

- 요청: 현재 코드의 모듈화, 재사용성, 미사용 코드와 구조 품질 평가. 구현 수정 요청은 아님.
- 담당: Codex 구조 검토 / 상태: 종료 / 갱신: 2026-10-09 23:27 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`.
- 기준 HEAD: `ec913b7957cc67e8096d6b7325afdc1ebe107709`.
- 변경 담당 경로: 이 검토 기록만. `source-management-deployment`의 진행 담당과 기존 수정·미추적 파일은 보존한다. 앱·검사 소스 변경, 빌드 산출물 생성, Git 변경 작업, 운영 접근은 하지 않는다.
- 기준 원문: `AGENTS.md`, `docs/ai/README.md`, `docs/status.md`, `docs/roadmap.md`, `docs/README.md`, `docs/system-design/08-code-structure.md`, `docs/system-design/01-system-architecture.md`, `docs/planning/content-collection/README.md`, 관련 서비스 기획 절.
- 적용 스킬: `/Users/zeaha/.agents/skills/audit/SKILL.md`. 독립 에이전트 검증은 수행하지 않음.

## 결론

앱·도메인·저장 계층 분리와 공유 계약은 실제 구현돼 있다. 다만 관리자 페이지의 책임 집중, direct 수집기 사이의 중복, 미사용 private 메서드, 구조 검사의 탐지 공백이 있어 전체적으로 충분히 정리됐다고 평가할 수는 없다. 이번 판단은 소스와 정적 검사에 한정하며 운영 장애나 성능 저하를 재현한 결과가 아니다.

## 확인한 지적

| ID | 우선순위·유형·신뢰도 | 조건·문제·영향 | 위치 | 권장 조치 |
| --- | --- | --- | --- | --- |
| E1 | P1 / 검사 오류 / 높음·재현 | Collector import 검사 정규식이 `source.*`와 같은 wildcard를 누락한다. 현행 내부 wildcard import 26개·15파일이 해당하며, 금지 대상 `web.*` 예시도 검출되지 않았다. 구조 검사 통과가 전체 의존성 검증을 뜻하지 않는다. 실제 순환 의존성을 발견했다는 뜻은 아님. | `tests/architecture.test.ts:44` | wildcard를 해석하거나 명시 import로 제한하고 금지 의존성 탐지 회귀를 추가. 가능하면 실제 타입 참조를 검사. |
| D1 | P2 / 설계 / 높음·소스 | `admin.vue` 1,005줄(스크립트 515줄까지), `admin-batch.vue` 868줄(스크립트 602줄까지). 전자는 검색·편집·업로드·발행·중복 요청 복구, 후자는 목록·선택·polling·만료·일괄 처리·복구·경로 상태가 페이지에 집중된다. 줄 수 자체보다 상태 결합과 개별 시험 난도가 문제. | `apps/web/app/pages/admin.vue:246`, `apps/web/app/pages/admin-batch.vue:73`, `apps/web/app/pages/admin-batch.vue:370` | 목록/편집 UI와 요청·복구 상태 단위로 단계적으로 분리. 기존 멱등성·버전 충돌·이탈 방지 유지. |
| D2 | P2 / 재사용 / 높음·소스 | 목록/단건 수집기 양쪽에 이미지 재시도, 용량 계산, 파일 저장과 SNS URL 추출이 중복된다. 이미지 정책 수정 시 두 경로를 같이 고쳐야 하며 처리 차이가 생길 위험이 있다. 현재 동작 불일치가 재현된 것은 아님. | `apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java:142`, `apps/collector/src/main/java/com/blariyo/collector/run/DirectUrlRunner.java:126` | 미디어 처리 공통 객체를 추출하되 목록 탐색·단건 입력의 다른 흐름은 유지. 재시도·용량 초과·저장 전후 생존 확인을 양쪽 경로에서 검증. |
| R1 | P3 / 미사용 코드 / 높음·소스 | private 메서드 3개가 각 클래스에서 선언 외 참조가 없다: DirectBatchRunner.pause/objectName, DirectUrlRunner.pause. 관련 경로에서 명시적인 반사 호출 근거도 발견하지 못함. | `apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java:133`, 같은 파일 `:135`, `apps/collector/src/main/java/com/blariyo/collector/run/DirectUrlRunner.java:189` | 호출되지 않는 세 메서드 및 연관 import를 작은 별도 변경으로 정리. 단건의 objectName은 실제 호출되므로 삭제 대상에서 제외. |

## 좋은 구조와 판단 경계

- API: Controller/Service/Repository 계약과 persistence 구현 분리, UnitOfWork로 트랜잭션 경계 관리. `PostsService`는 DB 구현 대신 주입된 계약을 사용한다.
- Collector: registry의 21개 사이트 adapter, 목록·상세 parser 분리, 공통 요청 정책 `SourceRequests`와 용량 계산 `ArticleMediaBudget` 재사용을 확인했다.
- Web: contracts 기반 응답 타입, 공통 UI/로딩 상태/출처 코드 조회와 앱 간 HTTP 경계를 확인했다.
- 자동 생성 계약 파일이나 엔티티 선언 파일이 길다는 사실만으로 결함으로 분류하지 않는다.
- legacy 호환 경로는 현행 기획에 남아 있으므로 비활성·구형이라는 이유만으로 미사용 삭제 대상으로 확정하지 않는다.
- 전체 함수·export·의존성의 도달 가능성을 전수 증명한 감사는 아니다. 이번에 확인한 미사용 메서드 3개를 저장소 전체의 미사용 코드 총수로 해석하지 않는다.

## 검증

- 기본 shell의 Node 20.19.2에서는 `.ts` 확장자를 처리하지 못해 구조 검사 진입 실패. 소스 결함으로 판정하지 않음.
- 설치된 프로젝트 지정 Node 24.18.0으로 `node --test tests/architecture.test.ts` 직접 실행: 4개 통과, 실패·skip 0. 해당 테스트가 원문 소스를 직접 읽는 것을 확인해 build:test 생성 없이 실행했다.
- 실제 테스트 파일의 import 정규식을 읽어 명시 클래스 import 1건 검출 / wildcard source 및 금지 web 예시 0건 검출을 assert로 확인했다. 저장소를 수정하지 않고 실행했다.
- Collector Java 143파일에 대한 private 메서드 선언·동일 파일 참조 검색으로 위 3개 후보를 추출하고 원문을 대조했다. 반사 호출 검색에 일치 없음.
- 프로젝트 지정 Node 24.18.0 PATH에서 `npm run lint`: 종료 코드 0. API·Web·scripts·tests ESLint 및 Oxlint 실행 통과. Java 미사용 코드 검증을 대신하지 않음.
- 전체 빌드·기능 회귀·브라우저·Collector 실행·DB/운영 검증: 미실행.
- `git diff --check` 통과. 최종 HEAD는 기준과 같고 기존 배포 담당 변경 외에는 이 기록 폴더만 추가됨. 앱·테스트·설정 파일 변경 및 commit/push 없음.

## 후속

권장 순서는 구조 검사 공백 보완 → 확정 미사용 코드 제거 → 중복 미디어 처리 통합 → 관리자 페이지 책임 분리다. 구조 개선 시 기존 결과를 유지하는 회귀 증거가 필요하다. 이번 검토에서는 개선 코드를 구현하지 않는다.
