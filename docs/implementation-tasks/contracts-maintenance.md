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
