# URL 허용 규칙 실패 원문 재현

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: URL 허용 규칙에 걸린 이유 설명. 범위는 운영 읽기 전용·실패 당시 원문 오프라인 파싱·이 기록. 앱/운영 설정 수정·배치 재개·사이트 재수집 없음.
- 앞선 [출처별 실패 조사](collection-failure-reasons.md)의 더쿠/오늘의유머 PARSE 미확정 원인을 후속 확인. 클리앙 LIST 원인은 아직 미확정이다.

## 확인된 원인

| 출처 | 실패한 주소 특성 | 정확한 조건 |
| --- | --- | --- |
| 더쿠 | 본문 첫 이미지 `https://imgnews.pstatic.net/...` | HTTPS는 맞지만 네이버 뉴스 이미지 호스트가 해당 출처 imageOrigins에 없음. 본문 호스트 theqoo.net과도 달라 SOURCE_NOT_ALLOWED |
| 오늘의유머 | 본문 첫 이미지 `http://thimg.todayhumor.co.kr/...` | 이미지 호스트는 허용돼 있으나 주소가 HTTP. SourcePolicy.allow는 HTTPS만 허용하므로 SOURCE_NOT_ALLOWED |
| 클리앙 | LIST 단계 | 실패 당시 목록 원문/redirect/DNS 상세 미확인. 위 두 사례 원인으로 일반화하지 않음 |

- 기존 운영 원문 2개를 private R2에서 GET해 로컬 일시 자료로만 사용. 본문·이미지 전체 주소·object key·credential은 기록하지 않았다.
- 로컬 Collector JAR로 원래 설정/원문을 파싱: 두 건 모두 SOURCE_NOT_ALLOWED 재현. 각 본문 selector 결과1개, 첫 이미지에서 위 위반 확인.
- 진단용 메모리 사본만 변경: 더쿠에 해당 HTTPS 이미지 origin 추가, 오늘의유머의 해당 HTTP 이미지 주소를 HTTPS로 치환. 두 건 모두 파싱 성공·이미지1개. 이미지 서버 요청은0건이며 실제 HTTPS 제공·이미지 byte 수집 성공을 입증한 것은 아님.
- 운영 설정·저장 원문·소스는 그대로 유지. 임시 원문 JSONL은 진단 후 삭제. 원본 저장소 자료 삭제는 없음.
- 이 오류는 상대 사이트가 차단했다는 뜻이 아니다. 서버가 임의 주소나 내부망으로 요청하지 못하도록 정한 출처/이미지/HTTPS 통제에 걸린 것이다.
- 현재 parser는 이미지 후보 검증 실패를 글 단위 실패로 올린다. runner는 SOURCE_NOT_ALLOWED를 출처 중단 사유로 처리하므로 이미지 하나로 해당 글·후속 출처 순회가 중단될 수 있다. 해당 출처 이전 성공 글은 보존한다.

## 근거·검증

- [URL/이미지 정책](../../../apps/collector/src/main/java/com/blariyo/collector/source/SourcePolicy.java): imagePolicy와 allow.
- [본문 parser](../../../apps/collector/src/main/java/com/blariyo/collector/source/common/OrderedContentParser.java): img 처리에서 policy.imagePolicy 검사.
- [수집 runner](../../../apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java): PARSE 실패 전달과 stopSite.
- source SHA b57724d~HEAD의 관련 parser/정책 핵심 파일 diff 없음. 로컬 JAR 원문 재현은 운영 프로세스에서 재실행한 결과가 아님.
- probe 초회는 Json.parse 인자 타입 오류로 컴파일 실패, byte[]로 고친 후 위 재현/후보 파싱 완료. production build/test를 실행한 것으로 표시하지 않는다.
- 상대 링크 존재·Git diff whitespace·작업 전후 상태 확인. 기존 untracked 보존, 이 기록만 추가. 후속 수정은 미실행.
