# 21개 출처별 수집 정책

모든 출처에 같은 `hot` 목록 정책을 적용하지 않는다. 출처별 정책은 다음 네 가지 중 하나다.

- `HOT_LIST`: 검증된 chart/list URL에서 목록을 발견하고 상세 parser로 이어간다. 이 상태는 list parser와 detail parser가 모두 있어야 한다.
- `DETAIL_ONLY`: 목록 자동 발견은 하지 않고, 공개 상세 URL을 수동·Discord 입력으로 처리한다. detail parser는 필수다.
- `BLOCKED`: fetch 자체를 실행하지 않는다. 현재 registry 예제에서는 21개 모두 detail parser를 두기 위해 `BLOCKED` parser 값을 제거했고, 운영 비활성은 `approved=false`, `batchApproved=false`, `blockedReason`으로 표현한다.
- `UNVERIFIED`: parser fixture는 있으나 실제 공개 URL, 개발/운영 DB, S3/R2 readback이 끝나기 전까지 운영 실행하지 않는다.

| source | 정책 | 목록 URL | 상세 parser | 현재 사유 |
|---|---|---|---|---|
| arcalive | HOT_LIST | `hot` https://arca.live/b/live | `ARCALIVE` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| bobaedream | HOT_LIST | `hot` https://www.bobaedream.co.kr/list?code=best | `BOBAEDREAM` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| clien | HOT_LIST | `https://www.clien.net/service/board/park` | `CLIEN` list+detail | hot list→detail→개발 DB/object readback 완료. run `adea86a9-d476-4488-98e0-2080613821d8`; blocks 7, media 0. 운영 DB/S3·Discord Gateway 미검증 |
| dcinside | HOT_LIST | `https://gall.dcinside.com/board/lists/?id=hit` | `DCINSIDE` list+detail | hot list→detail→개발 DB/object readback 부분 완료. run `dbcc0585-15b6-4d38-86c5-956d40fe61e3`; fetched 1, `DETAIL/PARSE_FAILED` 1 |
| dmitory | HOT_LIST | `hot` https://www.dmitory.com/issue | `DMITORY` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| dogdrip | HOT_LIST | `hot` https://www.dogdrip.net/dogdrip?sort_index=popular | `DOGDRIP` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| etoland | HOT_LIST | `https://etoland.co.kr/b/etohumor06/list` | `ETOLAND` list+detail | hot list→detail→개발 DB/object readback 완료. run `e91bb38b-a31b-4692-b578-6c9220f9b731`; fetched 2 |
| fmkorea | UNVERIFIED | 없음; 수동 URL만 | `FMKOREA` | detail parser fixture + collect-url 저장 경로; live URL·DB/S3 미검증 |
| goodgag | HOT_LIST | `hot` https://www.goodgag.net/ | `GOODGAG` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| humoruniv | UNVERIFIED | 없음; 수동 URL만 | `HUMORUNIV` | detail parser fixture + collect-url 저장 경로; live URL·DB/S3 미검증 |
| instiz | HOT_LIST | `https://www.instiz.net/pt` | `INSTIZ` list+detail | hot list→detail→개발 DB/object readback 완료. run `130feccc-7e4b-4a31-9b22-2b681922d5d3`; blocks 4, media 3. 운영 DB/S3·Discord Gateway 미검증 |
| inven | HOT_LIST | `hot` https://www.inven.co.kr/best/issue | `INVEN` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| mlbpark | HOT_LIST | `hot` https://mlbpark.donga.com/mp/b.php?m=list&b=bullpen | `MLBPARK` | 목록→상세 batch는 PARTIAL; text-only 상세 readback 완료, 이미지 media fetch 실패 rough edge 있음; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| natepann | HOT_LIST | `https://pann.nate.com/talk/c20002` | `NATEPANN` list+detail | hot list→detail→개발 DB/object readback 완료. run `472a917a-8b64-46b3-8db0-8bd40930eef5`; blocks 1, media 0. 운영 DB/S3·Discord Gateway 미검증 |
| pgr21 | UNVERIFIED | 없음; 수동 URL만 | `PGR21` | detail parser fixture + collect-url 저장 경로; live URL·DB/S3 미검증 |
| ppomppu | UNVERIFIED | 없음; 수동 URL만 | `PPOMPPU` | detail parser fixture + collect-url 저장 경로; live URL·DB/S3 미검증 |
| ruliweb | HOT_LIST | `hot` https://bbs.ruliweb.com/best/humor | `RULIWEB` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| theqoo | HOT_LIST | `hot` https://theqoo.net/hot | `THEQOO` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| todayhumor | HOT_LIST | `hot` https://www.todayhumor.co.kr/board/list.php?table=humorbest | `TODAYHUMOR` | 목록→상세→임시 개발 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| yuldo | HOT_LIST | `hot` https://yul-do.com/humorissue | `YULDO` | 목록→상세→로컬 DB/object readback 완료; 운영 승인·운영 DB/S3·Discord Gateway 미검증 |
| youtube-community | UNVERIFIED | 없음; 수동 URL만 | `YOUTUBE_COMMUNITY` | detail parser fixture + collect-url 저장 경로; live URL·DB/S3 미검증 |

`HOT_LIST`라도 정책 승인 전에는 registry의 `approved=false`, `batchApproved=false`를 유지한다. 목록이 불가능한 출처는 억지로 chart URL을 만들지 않고 `DETAIL_ONLY` 또는 `UNVERIFIED`로 남긴다. 목록과 상세의 요청 간격·페이지 수·글 수는 source별 설정을 따른다.

완료 판정은 [출처별 수집 검증표](reference-site-validation.md)를 따른다. fixture 통과는 구현 증거일 뿐 실제 사이트 검증·개발 DB readback·운영 DB/S3 readback을 대신하지 않는다.
