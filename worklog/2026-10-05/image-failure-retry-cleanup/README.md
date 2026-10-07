# 이미지 수집 실패 1회 재시도·정리

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6aed`
- 상태: 종료 / 갱신: 2026-10-05 22:02 KST
- 요청: 이미지 때문에 수집 실패한 글을 한 번 더 재시도하고 계속 실패하면 삭제.
- 우선 범위: 고정 로컬 DB5439/collector-objects의 현재 미검수 이미지 실패 항목. 이후 배치에도 자동 적용하라는 사용자 응답 확인. 운영 제외.
- 대상 확인: 아카라이브·보배드림·고급유머·웃대·인스티즈·율도 각1건, 총6건. 최신 failure의 phase=MEDIA 및 assetKind=IMAGE로 판별, 모두 ROBOTS_UNVERIFIED. 본문/URL 해석 오류4건과 승인/반려·발행 자료는 제외한다.
- 방식: 대상/원문·첨부·DB 사전 백업 → 기존 collect-url 배치로 항목당1회 재시도(기존 robots/quota/간격 유지) → 정상 완료는 보존, 실제 재시도 실행과 실패가 확인된 항목만 정확한 manifest로 삭제.
- 변경 경로: Collector runner/store·V011 migration·retention worker·권한 설정·검증·planning/system-design. 제한 삭제 함수의 행별 capability와 사전 백업을 사용. 만료일 조작·trigger 비활성화·권한 확대 없음.
- 앞선 all-source-title-audit 종료 확인. 제목 규칙 누락 수정은 이번 범위에 섞지 않는다. 기존 변경 보존, commit/push/배포 없음.

## 구현과 검증

- Collector V011: 글당 한 번의 이미지 재시도 기록, 이전 이미지 실패 claim 인식, run/source·기한·검수·게시글 보호를 검증하는 제한 삭제 함수, item/run별 durable 파일 정리. V012: 이미지 응답 압축 오류도 같은 실패 분류에 포함. V013: 재시도 도중 crash로 failure 행 없이 남은 FETCHING 항목도 이전 run 경로를 claim 전에 기록. 로컬에 적용한 V011 checksum을 보존하기 위해 후속 migration으로 보완했다.
- 목록/단건/queue에 적용. 단건/queue는 `IMAGE_RETRY_EXHAUSTED`로 종료해 일반 queue 재시도로 글을 다시 시도하지 않는다. 파일·본문 오류와 DB/설정/만료 오류는 자동 삭제 대상에서 제외한다. 정상 이미지 용량을 중복 차감하지 않는다.
- retention worker가 정확한 raw/media 경로를 삭제하고 부재 확인 후 완료. 실패·중단 시 목록을 유지하고 다음 실행에서 재개한다. 최소 retry/cleanup 기록은 선택 백업에 포함한다. 공개 게시글·private 사본과 공유 run/report는 보존한다.
- 첫 구현 전체 Collector 292 tests PASS(81 suites, DB readback19, skip0). 이후 queue 종료 코드·응답 압축 분류 보완 후 관련 12 tests 재검증 PASS(skip0), 실제 retention JVM 8 tests PASS, 로컬 최소 권한1 test·계약/migration hash1 test PASS, Collector bootJar/API test build PASS.
- 기존 첨부 오류 재시도 테스트는 이미지 실패 대신 FILE 실패 fixture를 사용해 기존 수동 재시도/완료 snapshot 불변성 검증을 유지했다. 이미지 재실패는 새 DB 테스트에서 삭제·중복 방지·파일 삭제 재개로 검증한다.
- 검증 중 retention-only API fixture에 Spring 전용 V010을 추가해 collector schema 누락으로 실패했다. 기존 fixture 범위에 맞춰 직접 사용하는 V011~V013만 추가하고 실제 worker 8개 검증을 다시 통과했다. 전체 V001~V013 설치는 별도 실제 DB 역할 검사로 검증한다.

## 로컬 실행 결과

- 백업: `.local-data/backups/image-retry-2026-10-05T12-51-56-535Z/`의 DB archive, object 전체 사본, manifest. archive 목록 읽기와 전체 object 해시 일치 확인.
- 고정 DB `127.0.0.1:5439/blariyo_local`, 고정 `.local-data/collector-objects`만 사용. 아카라이브·보배드림·고급유머·웃대·인스티즈·율도 6건을 기존 `collect-url` 배치로 각1회 추가 실행했다.
- 6건 모두 `ROBOTS_UNVERIFIED` 재실패 → 6건 삭제, 복구 성공0건. robots/allowlist/간격/일일 budget은 그대로 적용했다.
- 최초/재시도 run의 item 경로 정리12개 완료, 대기0, RUNNING0. 백업의 대상 원문6개와 새 run의 원문 부재, media prefix가 빈 상태임을 확인했다.
- 백업 시점 대비 content 전체 테이블·대상 밖 item/media/review/retention·기존 run/report/checkpoint/queue/confirmation 행 해시 일치. 기존 대상 밖 파일598개 해시 일치. 게시글117·승인53·반려15 보존, 미검수17건 남음. 앞선 작업 기록 숫자를 재사용하지 않고 이번 백업 직전 상태와 대조했다.
- 목록 API200에서 삭제 대상 제외, 삭제한 상세6건 모두410 확인. retention 최소 식별 행을 유지하는 기존 API의 Gone 응답이며 payload가 반환되지 않는다.
- 실행·DB/object readback: `.local-data/image-retry-20261005/{results,verification,http-verification}.json`. 원문 URL·인증값은 worklog에 복제하지 않는다.
- 로컬 Collector V013/권한 반영 완료. 운영 DB·배포·commit/push 미실행.

## 최종 확인

- V013 crash 복구 보완 후 관련12 tests 재통과(skip0). 기존 실패 행 없이 중단된 run을 재개해도 추가 재시도가 늘지 않고 최초/재실행 두 원문 경로가 모두 삭제됨을 검증했다.
- 최종 API V001~V013 / Collector V001~V013로 실제5역할·이미지 제한 삭제·전용 정리 접근·앱 쓰기 차단 검증 PASS. 별도 DB 복원77개 테이블 전체 행/ledger·16개 sequence 일치 PASS.
- 최종 retention JVM8 tests, 로컬 batch 최소 권한1 test, migration hash1 test, scripts 타입 검사/lint, 문서 상대 파일 링크5개 문서 및 git diff --check PASS.
- HEAD12df6ae 유지, 기존 수정·미추적 파일 보존. 완료 범위는 구현·격리 검증·현재 로컬6건 처리와 다음 로컬 배치 적용이며, 운영 반영은 미배포다.
