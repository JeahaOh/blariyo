# 검수 대기에서 수집 실패·차단 제외

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 / 갱신: 2026-10-06 21:07 KST
- 요청: 실패한 수집물이 검수 대기에 남는 현상 확인 및 수정.
- 확인: 지정 item `fbd1f94f-e222-40ab-8bad-9aee5eda5c38`은 todayhumor/BLOCKED/SOURCE_NOT_ALLOWED이며 검수 기록 없음. 실패 기록은 PARSE 단계, assetKind 없음. 이미지 재시도 후 삭제 경로가 아니다. 목록 SQL은 기록 없는 모든 상태를 UNREVIEWED로 필터링하고 UI도 검수 전으로 표시했다.
- 범위: batch-review repository·API 통합 시험·browser batch-review 회귀, admin-batch Vue, 화면·API·기능 계약, 이 기록. 품질 도입 담당의 파일·공유 build·Git은 수정하지 않는다. 자체 격리 build와 테스트 DB를 사용한다.

## 결과와 검증

- 목록 SQL의 UNREVIEWED 조건에 FETCHED를 추가하여 집계와 페이지 조회를 함께 수정했다. UI 목록/상세의 비수집 완료 항목은 검수 대상 아님으로 표시하며 승인·발행 단계 안내를 숨겼다. 실패 삭제·원본 링크·직접 상세 조회는 유지한다.
- 자체 사본에서 API·API test·Web build PASS. 별도 PostgreSQL18(loopback55451, `blariyo-review-eligibility-test`)에서 API 통합21 tests PASS. 여섯 비검수 상태의 검수 대기 제외·진단 조회 유지, 페이지 합계21건/2페이지를 검증했다.
- 최초 두 시험은 신규 fixture의 SKIPPED_POLICY 필수 skip_reason 누락, SQL parameter text/varchar 추론 충돌로 실패했다. DB 제약은 유지하고 fixture를 수정하여 새 시험 DB에서21개 모두 통과했다. 기존 FAILED+UNREVIEWED가1건이라는 기대값은 이번 검수 대상 계약에 따라0건으로 바꾸고, 검수 필터 생략 시1건 유지 및 다른5개 상태를 함께 확인했다.
- 실제 Chrome에서 지정 item의 접근 제한/검수 대상 아님 표시, 오늘의유머 검수 전4건(모두 수집 완료), 접근 제한 필터1건(검수 대상 아님)을 확인했다. 조회 후 상세/URL 선택 해제도 유지됐다. 개발 DB의 해당 source 미검수 FETCHED4/BLOCKED1 readback과 일치한다.
- 브라우저 자동 회귀도 FAILED+UNREVIEWED0건 및 검수 필터 없는 실패21건 페이지 동작으로 보강했다. 자동 browser 전체 suite는 이번 작업에서 실행하지 않았으며 위 Chrome 수동 검증과 구분한다.
- 자체 로컬 서버를 수정된 사본으로 재시작했다(3000/3100). 기존 DB 데이터 삭제·재수집·운영 반영·커밋/푸시는 하지 않았다. 공유 build와 품질 도입 담당 소유 파일을 건드리지 않았다. 전체 quality 입력 유효성은 이번 변경 이후 별도 확인해야 한다.
- 기준: UNREVIEWED 필터는 FETCHED만 포함한다. 전체/실패/차단 조회와 직접 상세는 보존하며 비수집 완료 항목은 검수 대상 아님으로 표시한다. 기존 DB 데이터 삭제와 재수집은 하지 않는다.
