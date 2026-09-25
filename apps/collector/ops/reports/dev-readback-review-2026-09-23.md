# Collector 개발 DB readback 검토 자료

생성일: 2026-09-23

범위: 임시 Docker 개발 DB `blariyo-collector-readback`와 로컬 object store readback. 운영 DB/S3 검증이 아니다.

| source     | source post key              | title                                                                                    | blocks | media | SNS | raw | report | media objects | canonical URL                                                                               |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------- | -----: | ----: | --: | --- | ------ | ------------- | ------------------------------------------------------------------------------------------- |
| arcalive   | `183756861`                  | [단편]착한아이프로젝트 - 베스트 라이브                                                   |     22 |    20 |   0 | OK  | OK     | OK            | https://arca.live/b/yandere/183756861                                                       |
| bobaedream | `best:1034027`               | 좆소기업 퇴사 레전드 \| 보배드림 베스트글                                                |      5 |     5 |   0 | OK  | OK     | OK            | https://www.bobaedream.co.kr/view?code=best&No=1034027                                      |
| clien      | `park:19268242`              | 서울에 꼭 살아야 하나요? : 클리앙                                                        |      7 |     0 |   0 | OK  | OK     | OK            | https://www.clien.net/service/board/park/19268242                                           |
| dcinside   | `hit:16435`                  | 힛갤 기념품 변경 안내 - 갤로그 배지, 갤러콘 - HIT 갤러리                                 |     30 |     2 |   0 | OK  | OK     | OK            | https://gall.dcinside.com/board/view/?id=hit&no=16435                                       |
| dmitory    | `issue:426329851`            | 이슈/유머 - 웹소설 <너희들은 변호됐다> 종이책 양장본 2부 예약판매                        |     11 |     9 |   1 | OK  | OK     | OK            | https://www.dmitory.com/issue/426329851                                                     |
| dogdrip    | `726075392`                  | 개드립 간 난민 하루 1000명 글은 개씹선동이다 - DogDrip.Net 개드립                        |     23 |     4 |   0 | OK  | OK     | OK            | https://www.dogdrip.net/726075392                                                           |
| etoland    | `etohumor06:2803717`         | 유머 게시판 활성화를 위한 긴급 공지(숏츠관련) - 유머 게시판 \| 이토랜드                  |      9 |     0 |   0 | OK  | OK     | OK            | https://etoland.co.kr/b/etohumor06/view/유머-게시판-활성화를-위한-긴급-공지숏츠관련-2803717 |
| goodgag    | `371410`                     | [스압] 사우디아라비아 왕실 일원이 아닌데도 부를 축적한 노동자 출신 사업가.jpg - 고급유머 |      1 |     1 |   0 | OK  | OK     | OK            | https://www.goodgag.net/371410                                                              |
| humoruniv  | `pds:1425984`                | 한국에서 백인으로 살아가기.jpg                                                           |      1 |     1 |   0 | OK  | OK     | OK            | https://m.humoruniv.com/board/read.html?table=pds&number=1425984                            |
| instiz     | `pt:7905965`                 | 명절에 조카 때려버림.jpg                                                                 |      4 |     3 |   0 | OK  | OK     | OK            | https://www.instiz.net/pt/7905965                                                           |
| inven      | `webzine:2097:2731495`       | 유시민, 진보 비평가들이 이대통령 지지기반 허물었다                                       |      7 |     1 |   1 | OK  | OK     | OK            | https://www.inven.co.kr/board/webzine/2097/2731495                                          |
| mlbpark    | `bullpen:202609230118885845` | 한국여자바둑리그 출전중인 일본 여류기사 우에노리사 인터뷰 : MLBPARK                      |     12 |     0 |   1 | OK  | OK     | OK            | https://mlbpark.donga.com/mp/b.php?m=view&b=bullpen&id=202609230118885845                   |
| natepann   | `375634055`                  | 스물여섯인데 아무것도 없음 \| 네이트 판                                                  |      1 |     0 |   0 | OK  | OK     | OK            | https://pann.nate.com/talk/375634055                                                        |
| ruliweb    | `300143:76767888`            | 프로토스도 진짜 개 ㄸㄹㅇ들이다                                                          |      6 |     3 |   0 | OK  | OK     | OK            | https://bbs.ruliweb.com/community/board/300143/read/76767888                                |
| theqoo     | `4353370346`                 | 더쿠 - 2026 김천김밥축제 행사 라인업                                                     |      5 |     5 |   0 | OK  | OK     | OK            | https://theqoo.net/hot/4353370346                                                           |
| todayhumor | `humorbest:1797970`          | 오늘의유머 - 한국 영화업계가 해외촬영 데이터를 하드디스크에 보관하지 않게 된 이유.j      |      3 |     3 |   0 | OK  | OK     | OK            | https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970                      |
| yuldo      | `humorissue:102710142`       | 남편이 차에 주유 안해뒀다고 화내 - 유머/이슈 - YULDO                                     |      1 |     1 |   0 | OK  | OK     | OK            | https://yul-do.com/humorissue/102710142                                                     |

## 차단 또는 live 미완료

- `fmkorea`: HTTP 430 보안 페이지. list/detail fixture parser는 구현했지만 live DB/S3 readback 없음.
- `pgr21`: Anubis 연결 확인 페이지. detail fixture parser는 구현했지만 live DB/S3 readback 없음.
- `ppomppu`: nginx 403. list/detail fixture parser는 구현했지만 live DB/S3 readback 없음.
- `youtube-community`: live `/post/{id}` 정적 HTML에 본문 renderer가 없어 `PARSE_FAILED`. `ytInitialData.backstagePostRenderer` fixture parser는 구현했지만 live DB/S3 readback 없음.
