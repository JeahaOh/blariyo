# 제한 역할 적용 후 실제 목록 수집 검증

2026-09-23 KST, 로컬 DB와 local object store. 운영/S3/Discord Gateway 증거가 아니다.
상세 결과는 [JSON](local-role-followup-2026-09-23.json)에 있다.

| source | 실제 목록 추출 | 이번 후보 | 신규 FETCHED | 기존 중복 skip | 실패 | 신규 이미지 | DB/object/report readback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| dmitory | 20 | 5 | 5 | 0 | 0 | 5 | 통과 |
| yuldo | 15 | 5 | 4 | 1 | 0 | 6 | 통과 |
| todayhumor | 30 | 5 | 1 | 3 | 1 | 4 | 성공·실패 기록 모두 일치 |
| dcinside | 47 | 5 | 0 | 1 | 4 | 0 | 실패 원본·사유·report 일치; 수집 성공 아님 |

모두 `--max-pages 1 --max-items 5 --since 24h --write-db`로 실행했다.
실제 목록 HTML은 JSON의 gitignored rawPath에, 상세 HTML은 collect/raw에 보존했다.
본문/media 해시·크기·디코딩/report/checkpoint 대조는 `scripts/local/verify-batch-run.mjs <runId>`로 수행했다.
자동 승격·발행하지 않았다. 신규 결과는 관리자 검수 대상으로 남으며 공개 글은 68건으로 유지된다.

디시의 관측 본문에 있는 dcimg5.dcinside.com/dccon.php 경로만 image origin/path 허용 목록에 추가했다.
최소 구조 fixture와 타 경로·타 host·상세 fetch 불허 회귀 테스트가 통과했다.
이 변경은 해당 CDN 이미지 다운로드를 검증했다는 의미가 아니다.

오늘의유머 1건과 디시 4건의 오류는 SOURCE_IMAGE_LIMIT_EXCEEDED다. 외부 사이트 접근 차단으로
분류하지 않는다. 원문 이미지를 자르지 않고 실패를 남겼으며, 수집·검수·승격의 이미지 20장
내부 한도를 함께 조정할 후속 구현이 필요하다. 이번 readbackPass는 실패 기록의 정합성을
포함하므로 collectionComplete와 동일하지 않다.

이번 실행 후 collect는 FETCHED93/FAILED6/SKIPPED_POLICY1, 이미지170, RUNNING0이다.
개별 사이트 전체 완료나 21개 사이트 전체 검증 완료로 확대하지 않는다.
