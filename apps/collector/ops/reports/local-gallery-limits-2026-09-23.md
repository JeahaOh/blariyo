# 다중 이미지 수집·승격 검증 — 2026-09-23

## 판정

이미지 20장 때문에 실패했던 실제 공개 글 두 건을 수정된 제한으로 재수집하고 정식 API 검수 → 초안 → 별도 발행까지 확인했다. 전체 21개 사이트 완료를 의미하지 않는다. 원격 S3/R2와 Discord Gateway는 이 검증 범위가 아니다.

| 출처 | 원문 | 수집 run | 저장 이미지 | 공개 글 | readback |
| --- | --- | --- | ---: | --- | --- |
| todayhumor | https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797973 | a3ac4fde-19e8-433f-acd8-d8a7d1841dd6 | 21 | http://localhost:3000/meme/posts/106 | raw/media/report/DB, private/public 통과 |
| dcinside | https://gall.dcinside.com/board/view/?id=hit&no=17809 | a0500dfe-5e97-4621-8442-3c1a5b780cac | 49 | http://localhost:3000/meme/posts/107 | raw/media/report/DB, private/public 통과 |

DCInside 원문 143블록은 링크 설명 확장을 포함해 content 본문에 보존됐다. 두 글 모두 브라우저에서 모든 이미지 로드를 확인했다. DCInside는 390px에서도 가로 넘침이 없었다. 초안 시점에는 private 사본만 존재했으며 별도 발행 뒤 public 사본을 검증했다.

## 변경 계약

이미지200개/본문1000블록, 파일30MiB/이미지·첨부합계150MiB. `mediaLimits` source 설정은 상한을 낮출 수 있다. 초과 시 잘라 성공시키지 않고 해당 글 실패로 기록한다. API 수집 이미지 입력/재인코딩 출력도30MiB, 출력합계150MiB이며 일반 업로드10MiB/요청10개·100MiB는 유지한다. 요청 간격10초, 픽셀·프레임 제한은 유지한다.

## 실행과 검증

```sh
# Node 24.18.0, JDK 25
node scripts/local/run-batch.mjs collect-url --source todayhumor --url 'https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797973' --write-db
node scripts/local/run-batch.mjs collect-url --source dcinside --url 'https://gall.dcinside.com/board/view/?id=hit&no=17809' --write-db
node scripts/local/verify-batch-run.mjs a3ac4fde-19e8-433f-acd8-d8a7d1841dd6
node scripts/local/verify-batch-run.mjs a0500dfe-5e97-4621-8442-3c1a5b780cac
node scripts/local/verify-dry-run.mjs dcinside
node scripts/local/verify-collected-content.mjs
```

- dry-run: collect 11테이블과 object379개 전후 해시 동일, 정상 종료.
- 공개 전수:70게시글/207이미지/70본문순서/SNS10/목록4페이지, 오류0.
- Java 전체129개 중113통과/16DB환경skip. 별도 임시DB runner/lifecycle5개 통과. 이후 추가한 observed fixture 포함 SourceMediaLimitsTests2개 통과.
- API 격리통합12개:49장 검수·초안·별도발행/용량초과 사전무쓰기/기존 실패복구·멱등·숨김재발행 통과.
- API수집이미지3개,Web/config5개,root26개 통과. API/Web build/lint/typecheck,tests lint/typecheck 통과.
- 기존 migration SQL 내용은 변경하지 않았다. 과거 계약 기준선은 보존하고 승인된 후속 계약과 추가 migration은 별도 contract-evolution manifest로 전수 대조한다.
- 검증 artifact는 `.local-data/verification/{batch-run-<id>,gallery-todayhumor,gallery-dcinside,dry-run-dcinside,collected-content}.json`에 있다. DB 백업은 `.local-data/backups/before-media-limits-20260923.dump`다.

## 남은 검증

기존 DCInside17808/17807/17805의 실패 기록은 아직 이번 성공 결과로 바꾸지 않는다. 별도 Hot batch를 실행해 확인한다. Goodgag371439 큰 이미지도 현재 재시도 결과를 별도로 기록한다. 일반 첨부 파일 실제 사례, 나머지 사이트별 최대5건/상세전용/차단 근거 등 BACKLOG 전체 수용 기준은 계속 진행한다. commit/push/배포 없음.

### 후속 재시도 관측

Goodgag371439 run `dc4be5cd-3010-4b5b-a309-c726179f9771`은 파일30MiB 제한으로 FAILED다. 해당 PNG HEAD는200, Content-Length45,590,774bytes를 반환했다. 원문 접근 차단이 아니라 설정된 자원 한도에 의한 실패다. media0/실패1의 DB·report readback은 통과했고 collectionComplete는false다.
DCInside 후속Hot batch run `5bef4c3f-d638-41ac-bb4e-310dfac23307`은 마지막 확인 시 RUNNING이다. 결과를 예상해 성공 처리하지 않는다.
