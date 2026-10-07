# 운영 서버 수집기 동거 실측

- 요청: 운영 서버에 수집기를 올려 실제 수집·부하 시험.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `1c255a9`
- 상태: 종료 — 운영 실제 수집·저장·부하 관측 완료 / 갱신: 2026-10-07 19:54 KST
- 변경 범위: 본 기록, 수집 기획·기술 계약의 일회성 시험 경계. 운영에는 collector 전용 제한 컨테이너, 필요한 수집 migration·전용 권한을 적용한다.
- 제외: 웹/API 교체, main 병합, 공개 발행, 운영 정기 예약 활성화, 기존 로컬 예약 변경.

## 실행·완료 기준

1. 운영 DB 백업·기존 게시글 기준선 확보, Collector V010 → V015 호환성 확인.
2. 현재 커밋의 collector를 로컬 빌드하고 SHA-256 고정. feature 산출물의 일회성 운영 시험이며 main 정식 릴리스로 보고하지 않는다.
3. 별도 컨테이너에 CPU 0.5개·메모리 512MiB·swap 추가 금지·Java heap 256MiB·동시 출처 1개 제한. 첫 수집 dogdrip 최대5건,1페이지,24시간,기본5초 간격.
4. DB·비공개 object 저장, 공개 HTTP 응답, host 가용 메모리·swap·컨테이너 CPU/메모리·OOM을 관찰한다. 지속적인 공개 오류·가용 메모리256MiB 미만·OOM이면 수집을 중단한다.
5. 시험 후 실행 컨테이너와 임시 인증 정보·DB login/HBA 접근을 회수하고 데이터·결과는 보존한다. 운영 정기 실행 여부는 별도 판단한다.

## 사전 관측

- 19:44: host 메모리1906MiB, 가용1144MiB, swap사용19MiB, root여유49GB.
- 웹63MiB/API67MiB/DB39MiB, 서비스 모두healthy.
- API migration V010, Collector V010 확인. 수집108건, 게시글83건.
- 운영 웹/API는 SHA `3e3e1d0b79cd71d4ff3b6969fa6282b14da7fcf4` 이미지. 시험은 이를 교체하지 않는다.

## 실행 결과

- `2026. 10. 07. 19:51:07`~`19:52:10`: 고급유머(`goodgag`) **5건 모두 FETCHED**, 실패0·중복0. DB run 기준63.121초, 컨테이너 시작/종료를 포함하면72.17초.
- 운영 수집 항목108→113, 미디어382→385, 실행 기록43→45. 앞선 개드립(`dogdrip`) 1회는 목록 요청에서 `SOURCE_ACCESS_BLOCKED`로 중단, 수집0건. 이 코드는401/403 응답에 해당하며 원시 상태코드는 별도 기록하지 않아 둘 중 어느 코드인지는 확정하지 않는다. 접근 우회·반복 요청을 하지 않았다.
- 원문5개·미디어3개·리포트1개를 R2에서 실제 GET으로 읽었다. 합계915,649 bytes, 미디어3개는 DB의 SHA-256·크기와 일치했다. 원문·리포트는 읽기 성공과 비어 있지 않음을 확인했다.
- 고급유머5건은 원 게시 시각을 parser가 확인하지 못해 기존 `INCLUDE_UNKNOWN` 정책으로 수집했다. 오늘 작성된 글5건이라고 해석하지 않는다.
- 기존 게시글83건의 행 digest가 실행 전후 동일. 자동 발행0건. 웹·API·DB 이미지와 StartedAt 유지, 모두healthy. 운영 API의 collect SELECT 권한 유지.
- DB schema: API V010 유지, **Collector V011~V015 신규 적용**. 기존 V001~V010 checksum 확인 후 소유자 `blariyo_migrator`와 transaction/advisory lock·DDL timeout을 적용했다. 새4개 테이블의 기존 backup role SELECT 권한도 확인했다.
- 실행 전 암호화 전체 DB 백업을 R2 업로드하고 다운로드 hash까지 확인했다. 이는 선택 백업/retention 운영 인수 완료를 의미하지 않는다.

| 관측 | 실행 전 | 수집 중 | 실행 후 |
| --- | ---: | ---: | ---: |
| 공개 HTTPS 표본 | 5 | 17 | 5 |
| HTTP200 | 5 | 17 | 5 |
| 응답 중앙값 | 102ms | 113ms | 113ms |
| 최대 응답 | 108ms | 617ms | 401ms |
| 서버 최소 가용 메모리 | 1121MiB | 1025MiB | 1123MiB |

- 수집 컨테이너 관측 최대 메모리90.83MiB, CPU50.96%(한 코어100% 기준, 설정0.5코어). OOM=false, exit0.
- host swap사용22.945→23.102MiB: 증가 약0.16MiB. 장시간 swap 압박으로 판단할 관측은 없었다.
- 표본27회는 운영 서버에서 공개 도메인으로 보낸 순차 GET이다. 부하 생성 시험, 실제 사용자 전체 지연 분포 또는 무중단 보증은 아니다.
- 앞선 dogdrip 실행도 공개 GET15회 모두200, 수집기 종료와 기존 서비스 유지 확인. 실제 원문/미디어 수집 부하 증거는 goodgag 결과로 한정한다.

## 실행 중 보완과 정리

- 첫2회는 Docker `local` log driver의 압축 기본값과 `max-file=1` 조합 때문에 컨테이너 시작에 실패했다. 외부 수집·batch run 생성 전 실패했으며 각 회 임시 권한/HBA/컨테이너를 회수했다. `max-file=2`로 수정한 다음 정상 기동했다.
- 공개 `/`의 정상302를 따라 최종 페이지를 측정하도록 `curl -L`로 조정했다. 원래302 표본은 성공/실패를 판정한 본27회 통계에 섞지 않았다.
- 일회성 시험 컨테이너·전용 egress network 삭제, 임시 batch login과 grant 회수, DB 세션0, HBA 원복, 운영 collector.env 삭제를 별도 재확인했다.
- 수집5건과 리포트·미디어, Collector V015 schema, 재현용 JAR와 비밀 없는 manifest/측정 기록은 보존했다. 운영 정기 timer 추가·로컬04:30/16:30 변경은 하지 않았다.
- 운영 배포 산출물은 source `1c255a9ba261903c6a64804edb29ef0fa0b70da1`, JAR SHA-256 `171e2201eae49208ecf0d82f9022d2f80d185386c40195d48ae24a4c479b24b0`이다. main 웹/API 배포 완료로 보고하지 않는다.

## 검증과 근거

- 로컬 `gradlew test bootJar`: BUILD SUCCESSFUL. test task는UP-TO-DATE였고 저장된 결과299 tests/실패0/skip0을 새 실행299건으로 보고하지 않는다. JAR는 이번에 다시 생성·전송 후 서버에서 SHA-256 대조했다.
- 실제 운영 DB readback·기존 content digest·역할 회수·서비스 StartedAt/healthy·R2 GET/미디어 해시 검증 통과.
- Python AST, Node syntax, 문서 상대 링크, `git diff --check` 확인. source·API/UI 기능 변경은 없다.
- [비밀 없는 통합 증거](evidence.json). 상세 evidence와 과거 실패 시도는 `.local-data/production-collector-trial-20261007/`, 운영 `/opt/blariyo/operations/collector-trial-20261007/`에 보존한다.
- 본 폴더 Python/Node 파일은 이 시험의 실행 기록이다. setup은 V010 및 미존재 시험 폴더를 전제로 하므로 운영 정기 실행용 도구로 재사용하지 않는다.

## 판단·남은 작업

- 제한된5건 표본에서는 같은2GB 서버에서 출처1개·메모리512MiB·CPU0.5 제한의 실행 여유를 확인했다. 모든 출처·대형 미디어·20건/출처·장시간 반복의 용량 증거는 아니다.
- 운영 서버 요청은 로컬과 출처 접근 결과가 다르다. dogdrip은 차단됐으므로 모든 로컬 수집을 운영으로 옮길 수 있다고 판정하지 않는다. 이후 허용된 출처별 실제 결과·더 큰 미디어 표본을 확인해야 한다.
- 운영 정기 수집 전환은 미실행이다. 과거 만료8건과 선택 백업/독립 retention 운영 인수도 이번 작업으로 해결했다고 보고하지 않는다. 새 이미지 정리 대기는0건이다.
