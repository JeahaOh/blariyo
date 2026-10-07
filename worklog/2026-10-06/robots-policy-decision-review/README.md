# robots 처리 방침 이력 확인

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6ae`
- 상태: 종료 / 갱신: 2026-10-06 19:45 KST
- 요청: 과거 개발 목적 수집에서 robots.txt를 보지 않기로 한 결정이 있었는지 확인.
- 변경 경로: 이 작업 기록만. 직전 batch-failure-delete 기록 종료 확인, 기존 변경 보존.

## 확인 결과

- 사용자 이번 설명은 개발 목적 수집에서 robots.txt를 확인하지 않기로 했다는 것이다. 과거 사용자 발언 원문은 이번 확인에서 찾지 못했으므로 과거 합의를 확정했다고 보고하지 않는다.
- Git `e88e92b`의 `docs/development-specs/m0-core/decisions/검수/task-08-discord-url-and-source-risk-policy.md`는 이용약관을 자동 차단 조건에서 제외하고 robots는 기술 gate로 유지한다고 기록한다. 이는 당시 작성된 문서의 내용이며 사용자 발언 원문을 대신하지 않는다.
- 현재 [수집 기획](../../../docs/planning/content-collection/README.md)도 동일한 차단 기준을 담고 있다.
- 현재 [SourceRequests](../../../apps/collector/src/main/java/com/blariyo/collector/run/SourceRequests.java)의 controlled 생성은 checkRobots=true를 전달하고 목록·상세·이미지 요청 전 allowRobots를 실행한다. robots404 등도 ROBOTS_UNVERIFIED로 변환한다.
- [9월 27일 구현 기록](../../2026-09-27/m0-implementation/README.md)은 robots/Crawl-delay를 단건·목록·queue·probe 공통 경로에 연결했다고 기록한다.
- [이미지 실패 검토](../../2026-10-05/image-collection-process-audit/README.md)의 기존6건은 이미지 GET 이전 robots 검사 실패다. 이를 이미지 자체 실패와 함께 재시도 후 삭제한 분류 결함은 여전히 미수정이다.

## 실행과 잔여 사항

- 이력·현재 코드 확인만 수행. source·정본·DB·로컬 서버·운영 환경 변경, 수집·복구·삭제·commit/push 미실행.
- 현재 구현은 사용자가 이번에 설명한 robots 미확인 방침과 다르다. 이 기록을 구현 반영 완료로 해석하지 않는다.
- 과거 문서의 존재를 근거로 사용자 기억을 부정하거나 개발 목적의 법적 적합성을 확정하지 않는다.
- 기록의 상대 링크 존재 및 git diff --check 확인. 실행 코드 변경이 없어 테스트는 수행하지 않는다.
