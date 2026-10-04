# 운영 배포 전 DB 변경 필요 여부 확인

- 담당: Codex (현재 세션)
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치·후보: `release@c4fd0f9ce5d520b0e8e2863ece82c76ff61cd47a`
- 상태: 종료
- 갱신: 2026-10-04 KST
- 요청: 운영 배포 전에 운영 DB를 수정해야 하는지 확인.
- 범위: Git/source 비교와 운영 DB 읽기 전용 조회. 이 검토 기록만 추가하며 commit·push·DB 변경·배포는 수행하지 않는다.

## 결과

- 이번 후보에 필요한 신규 DB migration·수동 DDL·데이터 변환은 없다.
- 운영 부팅 helper가 가리키는 release는 `release-b2a7435-main-nightly-20261003T045949Z`였다.
- `b2a7435..release`의 API/Collector migration, API entity·DB 설정, DB 권한 SQL은 변경 없음.
- 운영 DB의 API·Collector ledger는 각각 V001~V010, 각 10건이며 후보 파일의 버전 집합·SHA-256과 모두 일치했다.
- Collector V001은 구현 규칙대로 Spring Batch schema + DROP TABLE 제거 후 Quartz schema + collector-v001 SQL의 합성 체크섬으로 대조했다.
- 운영 `ops.is_schema_ready('V010') = true` 확인.
- 관리자 검색 변경은 기존 title·published_at 컬럼을 사용하는 쿼리 변경이다. `body_html` 구조 전환은 후속 M0.5 계획이며 이번 후보의 SQL·엔티티에는 없다.
- API는 `synchronize: false`, `migrationsRun: false`; 야간 배포 스크립트도 migration을 실행하지 않는다.

## 검증 경계

- 알려진 운영 서버·DB를 명시하여 `BEGIN READ ONLY`, statement timeout 5초 안에서 ledger와 schema readiness만 조회했다. 데이터 원문·비밀은 출력하지 않았다.
- 최초 API ledger 조회는 checksum 컬럼명을 잘못 지정해 실패했다. 실제 구현의 `checksum_sha256 BYTEA`를 확인하고 hex 변환하여 재조회했다. DB 쓰기는 없었다.
- 판정은 위 후보 기준이다. 이후 migration이 추가된 후보에는 그대로 적용하지 않는다. 이 조회는 백업·전체 운영 기능 수용·새 이미지 배포 완료의 증거가 아니다.
- 기록은 review-only 예외로 release 작업 폴더에 미커밋 상태로 남긴다. release 직접 commit은 하지 않는다.
