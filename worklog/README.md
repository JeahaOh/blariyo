# Blariyo 작업 기록

수행 당시의 작업 범위·결정·검증·인계 자료를 날짜별로 보관한다. 현재 상태는 [status](../docs/status.md),
남은 작업은 [roadmap](../docs/roadmap.md), 제품·기술 정본은 [문서 안내](../docs/README.md)를 따른다.

## 보관 규칙

- 모든 작업의 기록은 `worklog/YYYY-MM-DD/<주제영역>/파일`에 남긴다. 작업 크기를 이유로 생략하지 않는다.
  세부 기준과 명시적인 전체 파일 쓰기 금지 요청의 우선순위는 [루트 지침 G05](../AGENTS.md)를 따른다.
- 작업 중인 브랜치의 worklog에 기록하며, 날짜는 한국 시간의 작업일이다. 다음 날짜의 기록은 이전 기록을 연결한다.
  session과 task를 서로 다른 최상위 경로에 중복 보관하지 않는다. 작은 작업은 기록 파일 하나로 충분하다.
- 쓰기 작업의 기록에는 루트 G03에 따라 담당·작업 폴더·브랜치·변경 경로·진행/인계/종료 상태·갱신 시각을 남긴다.
  인계 시 다음 담당과 잔여 작업을 표시한다. 담당 기록은 자동 잠금이 아니며 충돌 시 쓰기를 시작하지 않는다.
- 당시 상태·Git SHA·명령·실패·미검증 기록은 보존한다. 새 사실은 새 실행 기록과 현재 현황에 반영한다.
- 비밀·환경 실값·원본 개인정보·임시 DB/object는 넣지 않는다. 이미지를 포함한 검토 증거는 해당 작업과 같이 둔다.
- README는 찾기 위한 색인이다. 제품 규칙이나 별도 완료율을 재정의하지 않는다.

## 날짜별 기록

- [2026-09-26](2026-09-26/README.md): AI 공통 지침·harness 설계와 재검토 정정, M0 진척·공개 HTTP 관측
- [2026-09-24](2026-09-24/README.md): 문서 최신화 TASK-01~07·재검토 보완 및 전체 문서 전수 검토 진행
- [2026-09-23](2026-09-23/): admin-core, batch-review-ui, batch-고도화, collection-contract-alignment, collector-ci, collector-site-modules, directory-reorganization, m0-audit, m0-planning, release
- [2026-09-22](2026-09-22/): 진행현황-전수점검
- [2026-09-21](2026-09-21/): collector-architecture
- [2026-09-20](2026-09-20/): infrastructure-setup, local-ui-cicd, security-cost-protection
- [2026-09-09](2026-09-09/): core-spring-verification, nest-transition
- [2026-09-08](2026-09-08/): core-spring-acceptance, design-baselines, handoff, 문서정합성, 문서정합성보완, 설계기준선, 최종확정검토, 최종확정보완
- [2026-09-07](2026-09-07/): docs-consolidation
- [2026-08-14](2026-08-14/): session
- [2026-08-13](2026-08-13/): ai-governance, document-sanitization, security-hotfix
- [2026-08-12](2026-08-12/): session
- [2026-08-11](2026-08-11/): session
- [2026-08-08](2026-08-08/): session

[경로 정리 결과와 이전→현재 이동표](2026-09-23/directory-reorganization/RESULTS.md)를 통해 이전 경로를 찾을 수 있다.
