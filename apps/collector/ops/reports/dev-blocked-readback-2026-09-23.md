# Collector 개발 DB blocked/unverified writeback 검토 자료

범위: 임시 Docker 개발 DB `blariyo-collector-readback`와 로컬 object store `/tmp/blariyo-collector-live-blocked-objects`. 운영 DB/S3 검증이 아니다.

| source            | run id                                 | state  | failure                        | URL                                                                  | source post key                        | report object                                                                     |
| ----------------- | -------------------------------------- | ------ | ------------------------------ | -------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| pgr21             | `3a83f15c-0098-4bfe-bb99-85773debc421` | FAILED | SOURCE_ACCESS_BLOCKED / DETAIL | `https://pgr21.com/humor/507793`                                     | `humor:507793`                         | `collect/report/3a83f15c-0098-4bfe-bb99-85773debc421.jsonl` exists=true bytes=158 |
| fmkorea           | `c3a478e7-f9c2-47b2-ba73-0373d4ed3d4b` | FAILED | SOURCE_ACCESS_BLOCKED / DETAIL | `https://www.fmkorea.com/8468698945`                                 | `8468698945`                           | `collect/report/c3a478e7-f9c2-47b2-ba73-0373d4ed3d4b.jsonl` exists=true bytes=160 |
| ppomppu           | `7997fa18-fb43-4310-bbe1-6ac8afe2cfa5` | FAILED | SOURCE_ACCESS_BLOCKED / DETAIL | `https://www.ppomppu.co.kr/zboard/view.php?id=freeboard&no=10108060` | `freeboard:10108060`                   | `collect/report/7997fa18-fb43-4310-bbe1-6ac8afe2cfa5.jsonl` exists=true bytes=160 |
| youtube-community | `45ca0295-ecd8-423e-9af7-4aadcaf822a0` | FAILED | PARSE_FAILED / DETAIL          | `https://www.youtube.com/post/UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ`  | `UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ` | `collect/report/45ca0295-ecd8-423e-9af7-4aadcaf822a0.jsonl` exists=true bytes=161 |

판정:

- `pgr21`, `fmkorea`, `ppomppu`는 live 상세 URL을 시도했지만 접근 차단으로 실패 상태와 원인이 저장됐다.
- `youtube-community`는 live `/post/{id}` HTML에 community renderer가 없어 `PARSE_FAILED`로 저장됐다.
- 이 자료는 실패 상태 저장/readback 증거이며, 상세 본문 수집 완료 증거가 아니다.
