# 수집처 URL 수정 가능 여부 확인

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: 현재 수집처 관리에서 URL도 변경할 수 있는지 확인.
- 범위: 구현 조회 및 이 기록. 기존 source/DB/설정 변경 없음.
- 결과: Web URL은 링크 표시만 제공한다(SourcePublishPolicies.vue:67). URL 입력/저장 기능은 없다. 설정 API도 수집 여부·자동 발행 여부와 버전만 받는다.
- 배치 목록 대상은 source JSON의 charts[chart]를 읽는다(DirectBatchRunner.java:31). DB source_url은 구성의 기본/등록 목록 또는 사이트 루트에서 동기화되는 표시용 메타데이터다(SourceCollectionSettings.java:33).
- 판단: 행별 URL 편집을 추가할 수 있으나 API·DB·배치 대상 조회를 함께 연결해야 실제 수집 주소가 바뀐다. 출처 구조에 따른 파서·본문 경로 지원 여부도 확인해야 한다.
- 검증: 현재 소스 대조 및 git diff --check. 실행 코드 변경이 없어 테스트를 반복하지 않았다.
