# main 설계 병합 시 구현 상태 인계

- 기록일: 2026-09-08
- 대상: `main`의 최신 설계를 `feature/m0-core` 구현 브랜치에 병합하는 시점
- 역할: 구현 증거와 최신 설계의 차이를 기록하는 인계 자료. planning·system-design 정본이 아님

## 현재 구현 증거

- `feature/m0-core`의 `c788f18`은 docs 기준으로 새로 개발한 M0 Core와 수집 보조 구현을 보존했다.
- `c080550`은 수집 후보의 PENDING 보존, lease 만료 RUNNING 처리 cycle 최대 claim 3회,
  재시도 시각·attempt 초기화와 격리 DB 정리를 보완했다.
- 현재 source에는 Nuxt Web/BFF, Express Core, PostgreSQL migration, OpenAPI·생성 계약,
  관리자 수집 화면과 legacy Python collector가 있다. 병합 전 로컬 검증 범위는 [루트 README](../../../README.md)에 기록돼 있다.
- main 병합 상태의 중앙 검증에서 build, 통합 42건, 브라우저 8건이 실패 0건으로 통과했다. 통합 검증
  격리 DB suffix는 `70915a974125`다. Docker 검증은 다시 실행하지 않았고, 이전 Docker 검증 이후 구현
  파일 110개의 hash가 유지됐다는 대조 결과만 확인했다.

이 검증은 최신 Spring 설계 전체 수용이나 Docker 재검증을 뜻하지 않는다. 실제 출처 fetch, 라이브
Discord, production 배포와 법무·운영 수용은 계속 미검증이다.

## 최신 Spring 설계와의 경계

[Spring 수집 서버 상세 설계](../../../docs/system-design/07-spring-collector-design.md)가 앞으로 구현할 수집기의
현행 기술 계약이다. `apps/collector` Spring Boot, Spring Batch·Quartz, 전용 local PostgreSQL,
`collectorExecutionId` fencing, 모든 변경 API replay, Core 원자 quota와 암호화 spool은 아직 구현되지 않았다.

기존 [Node/Core 수집 API](../../../apps/api/src/collection.mjs)와 [Python collector](../../../tools/collector/README.md)는
전환 전 구현 증거와 호환성 검토 입력으로 보존한다. 해당 구현의 존재나 테스트 결과를 Spring 전환 완료로
표시하지 않는다. planning·system-design 충돌은 최신 Spring 계약을 따르고, legacy 동작은 이 문서와
[수집 기능 명세](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md)에서 구분한다.
