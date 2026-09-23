# Collector 21개 사이트 개발 DB 검토 자료

범위: 임시 Docker 개발 DB `blariyo-collector-readback`와 로컬 object store readback. 운영 DB/S3/R2 검증이 아니다.

요약: FETCHED_DEV_READBACK 17개, FAILED_DEV_READBACK 4개, MISSING_DEV_READBACK 0개.

| source | review state | run id | post key | title/failure | blocks | media | sns | report |
|---|---|---|---|---|---:|---:|---:|---|
| arcalive | FETCHED_DEV_READBACK | `3af6a0f0-2764-440b-8fc3-0f15f7c12604` | `183756861` | [단편]착한아이프로젝트 - 베스트 라이브 | 22 | 20 | 0 | `collect/report/3af6a0f0-2764-440b-8fc3-0f15f7c12604.jsonl` exists=true |
| bobaedream | FETCHED_DEV_READBACK | `ce6d24af-a3e7-4562-b77f-190143fefe5c` | `best:1034027` | 좆소기업 퇴사 레전드 | 보배드림 베스트글 | 5 | 5 | 0 | `collect/report/ce6d24af-a3e7-4562-b77f-190143fefe5c.jsonl` exists=true |
| clien | FETCHED_DEV_READBACK | `adea86a9-d476-4488-98e0-2080613821d8` | `park:19268242` | 서울에 꼭 살아야 하나요? : 클리앙 | 7 | 0 | 0 | `collect/report/adea86a9-d476-4488-98e0-2080613821d8.jsonl` exists=true |
| dcinside | FETCHED_DEV_READBACK | `dbcc0585-15b6-4d38-86c5-956d40fe61e3` | `hit:16435` | 힛갤 기념품 변경 안내 - 갤로그 배지, 갤러콘 - HIT 갤러리 | 30 | 2 | 0 | `collect/report/dbcc0585-15b6-4d38-86c5-956d40fe61e3.jsonl` exists=true |
| dmitory | FETCHED_DEV_READBACK | `2995f036-5cce-46d8-adf3-c7680b76f736` | `issue:426329851` | 이슈/유머 - 웹소설 <너희들은 변호됐다> 종이책 양장본 2부 예약판매 | 11 | 9 | 1 | `collect/report/2995f036-5cce-46d8-adf3-c7680b76f736.jsonl` exists=true |
| dogdrip | FETCHED_DEV_READBACK | `94bd2d67-0a1e-4820-a0f0-5ef23fc28f6e` | `726075392` | 개드립 간 난민 하루 1000명 글은 개씹선동이다 - DogDrip.Net 개드립 | 23 | 4 | 0 | `collect/report/94bd2d67-0a1e-4820-a0f0-5ef23fc28f6e.jsonl` exists=true |
| etoland | FETCHED_DEV_READBACK | `e91bb38b-a31b-4692-b578-6c9220f9b731` | `etohumor06:2803717` | 유머 게시판 활성화를 위한 긴급 공지(숏츠관련) - 유머 게시판 | 이토랜드 | 9 | 0 | 0 | `collect/report/e91bb38b-a31b-4692-b578-6c9220f9b731.jsonl` exists=true |
| fmkorea | FAILED_DEV_READBACK | `c3a478e7-f9c2-47b2-ba73-0373d4ed3d4b` | `8468698945` | SOURCE_ACCESS_BLOCKED | 0 | 0 | 0 | `collect/report/c3a478e7-f9c2-47b2-ba73-0373d4ed3d4b.jsonl` exists=true |
| goodgag | FETCHED_DEV_READBACK | `d65055f3-05b8-4132-9340-04a2c604fb4e` | `371410` | [스압] 사우디아라비아 왕실 일원이 아닌데도 부를 축적한 노동자 출신 사업가.jpg - 고급유머 | 1 | 1 | 0 | `collect/report/d65055f3-05b8-4132-9340-04a2c604fb4e.jsonl` exists=true |
| humoruniv | FETCHED_DEV_READBACK | `bbd800b5-87f2-4e5f-9a81-60e67c29729d` | `pds:1425984` | 한국에서 백인으로 살아가기.jpg | 1 | 1 | 0 | `collect/report/bbd800b5-87f2-4e5f-9a81-60e67c29729d.jsonl` exists=true |
| instiz | FETCHED_DEV_READBACK | `130feccc-7e4b-4a31-9b22-2b681922d5d3` | `pt:7905965` | 명절에 조카 때려버림.jpg | 4 | 3 | 0 | `collect/report/130feccc-7e4b-4a31-9b22-2b681922d5d3.jsonl` exists=true |
| inven | FETCHED_DEV_READBACK | `f53df0bb-45ef-4e96-b033-0459740485a5` | `webzine:2097:2731495` | 유시민, 진보 비평가들이 이대통령 지지기반 허물었다 | 7 | 1 | 1 | `collect/report/f53df0bb-45ef-4e96-b033-0459740485a5.jsonl` exists=true |
| mlbpark | FETCHED_DEV_READBACK | `961b90ce-87d1-43af-a33f-f760195357dd` | `bullpen:202609230118885845` | 한국여자바둑리그 출전중인 일본 여류기사 우에노리사 인터뷰 : MLBPARK | 12 | 0 | 1 | `collect/report/961b90ce-87d1-43af-a33f-f760195357dd.jsonl` exists=true |
| natepann | FETCHED_DEV_READBACK | `472a917a-8b64-46b3-8db0-8bd40930eef5` | `375634055` | 스물여섯인데 아무것도 없음 | 네이트 판 | 1 | 0 | 0 | `collect/report/472a917a-8b64-46b3-8db0-8bd40930eef5.jsonl` exists=true |
| pgr21 | FAILED_DEV_READBACK | `3a83f15c-0098-4bfe-bb99-85773debc421` | `humor:507793` | SOURCE_ACCESS_BLOCKED | 0 | 0 | 0 | `collect/report/3a83f15c-0098-4bfe-bb99-85773debc421.jsonl` exists=true |
| ppomppu | FAILED_DEV_READBACK | `7997fa18-fb43-4310-bbe1-6ac8afe2cfa5` | `freeboard:10108060` | SOURCE_ACCESS_BLOCKED | 0 | 0 | 0 | `collect/report/7997fa18-fb43-4310-bbe1-6ac8afe2cfa5.jsonl` exists=true |
| ruliweb | FETCHED_DEV_READBACK | `babebfb1-4915-456f-bf37-8d5b807c342d` | `300143:76767888` | 프로토스도 진짜 개 ㄸㄹㅇ들이다 | 6 | 3 | 0 | `collect/report/babebfb1-4915-456f-bf37-8d5b807c342d.jsonl` exists=true |
| theqoo | FETCHED_DEV_READBACK | `1d4fbcf4-38f4-4d9b-88c6-8ed4eebdb461` | `4353370346` | 더쿠 - 2026 김천김밥축제 행사 라인업 | 5 | 5 | 0 | `collect/report/1d4fbcf4-38f4-4d9b-88c6-8ed4eebdb461.jsonl` exists=true |
| todayhumor | FETCHED_DEV_READBACK | `0455c65f-0605-45b7-99e2-d7f6e1668d45` | `humorbest:1797970` | 오늘의유머 - 한국 영화업계가 해외촬영 데이터를 하드디스크에 보관하지 않게 된 이유.j | 3 | 3 | 0 | `collect/report/0455c65f-0605-45b7-99e2-d7f6e1668d45.jsonl` exists=true |
| yuldo | FETCHED_DEV_READBACK | `e2957b9d-5989-45d1-a6f5-f7bf73ff6cab` | `humorissue:102710142` | 남편이 차에 주유 안해뒀다고 화내 - 유머/이슈 - YULDO | 1 | 1 | 0 | `collect/report/e2957b9d-5989-45d1-a6f5-f7bf73ff6cab.jsonl` exists=true |
| youtube-community | FAILED_DEV_READBACK | `45ca0295-ecd8-423e-9af7-4aadcaf822a0` | `UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ` | PARSE_FAILED | 0 | 0 | 0 | `collect/report/45ca0295-ecd8-423e-9af7-4aadcaf822a0.jsonl` exists=true |

검토 기준:

- `FETCHED_DEV_READBACK`은 실제 공개 URL 또는 hot list batch에서 상세 fetch/parser/DB/object 저장/readback을 확인한 상태다.
- `FAILED_DEV_READBACK`은 실제 live URL을 시도했지만 접근 차단 또는 renderer 부재로 실패했고, 실패 상태와 report object 저장/readback을 확인한 상태다.
- 이 파일은 운영 DB/S3/R2 검증이나 Discord Gateway E2E 완료 증거가 아니다.
