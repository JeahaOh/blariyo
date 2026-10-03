# 계약 정합성·유지보수 task

legacy 수집 계약 항목은 재활성화 결정 전까지 조건부다. direct 경로에 이미 영향을 주는 유지보수 개선은 해당 코드 수정 단위에서 함께 검증한다.

## CON-01 legacy 저장·DTO·OpenAPI 계약 정합화

- **우선순위:** P1, legacy 재활성화 시 필수.
- **목표:** legacy API/OpenAPI와 DB 저장 제약, parser 결과 DTO가 같은 계약을 표현한다.
- **선행:** legacy 경로 재활성화 결정 및 지원 범위 확정. 기본 경로에 무관한 legacy 활성화는 하지 않음.
- **범위:** API 1000블록 대 DB V006 40블록 상한 결정과 migration 필요성, `attachmentCandidates` 명시 DTO 매핑, 실제 preview MIME, production auth/readiness 설명.
- **완료 증거:** 결정된 경계값 저장 테스트, 허용 필드 DTO/OpenAPI 검사, 지원 MIME 및 auth/readiness 계약 검사. 결정 미완료는 차단으로 유지.

## CON-02 direct SQL 예외와 검수 조회 수 개선

- **우선순위:** P1 유지보수.
- **목표:** direct batch 결과/검수 조회 구현과 Nest raw SQL 허용 예외 목록을 일치시키고 항목별 N+1 재조회를 제거 또는 정당화한다.
- **선행:** 실제 변경 대상의 소유권·트랜잭션·권한 경계 확인.
- **범위:** 허용 SQL 경로 문서화, 일괄 조회 또는 합리적 근거, 목록 크기별 쿼리 수 관찰.
- **완료 증거:** 코드와 예외 목록이 일치하고 기존 권한/결과를 보존하는 테스트, 1건·다건 조회 쿼리 수 비교. 성능 문제 재현 전 장애로 보고하지 않음.


### CON-02의 M0-D02/P1-01 후속 구현 범위

기존 raw SQL/조회 개선 ID에 direct 입력 연결을 추적한다. [D02 API](../system-design/03-api-design.md#m0-d02-api)·[모델](../system-design/02-data-model.md#m0-d02-input-model)의 API mailbox pull, batch receipt/runtime projection, 새4개 endpoint·화면과 migration을 구현한다. 현재 legacy 폼·source PATCH로 대체하지 않는다. D01 중복/만료·D04 역할 계약을 먼저 적용하고 COL-01/02 요청 통제를 연결한다. OpenAPI 문서와 packages/contracts 사본·생성 타입을 구현 변경에서 함께 갱신한다. 완료 증거는 D02-T1~T6, DB 역할 거부·API 외부 무요청·소스 설정 version 대조와 실제 화면 인수다. CON-01 legacy 재활성화 작업은 계속 조건부다.

## 2026-09-27 로컬 결과

CON-02의4개 API/BFF/UI·mailbox/lease/runtime·Java/API golden34·SQL 예외와1/20건 동일SQL5회·원문 외부 요청0을 구현·검증했다. [완료 감사](../../worklog/2026-09-27/m0-implementation/COMPLETION-AUDIT.md)의 D02-T1~T6·D04와 API 전체 실DB130개를 따른다. 실제 장비·운영 인수는 [별도 인계](../operations/m0-operation-handoff.md), CON-01은1000/40 차이를 유지한 조건부 대기다.

### 로컬 준비 도구 후속 — 2026-09-27 문서 대조

- 상태: **로컬 보완·검증 완료**. CON-02 후속·O05/P1-03의 개발 준비 경로를 보완했다. 운영 장비 적용은 별도다.
- 변경: [prepare-batch-review](../../scripts/local/prepare-batch-review.mjs)의 archive 검증·실제 migration ledger 출력, API→Collector 적용 순서와 [batch 권한 모듈](../../scripts/local/batch-privileges.mjs)을 현행 권한 계약에 정렬했다.
- 격리 증거: [권한 시험](../../scripts/local/batch-privileges.test.mjs)이 새 임시 DB에서 API/Collector V010 적용, 권한 적용 2회, 제한 batch 역할의 quota 차감/대기·mailbox·runtime 허용, content/검수/정정 이력 접근 및 item 삭제 거부를 확인했다. 시험 DB는 회수했다.
- 개발 적용: 실제 개발 DB API010/Collector010, 기존 media 711개 hash/크기 검증과 제한 역할 수집·API 검수·공개를 확인했다. 소유자 계정으로 수집하지 않는다.
- 근거: [개발 수집 작업 기록](../../worklog/2026-09-27/dev-21-site-publish/README.md). [로컬 실행서](../../scripts/local/README.md)·[환경 안내](../operations/environment-configuration.md)를 함께 갱신했다.
