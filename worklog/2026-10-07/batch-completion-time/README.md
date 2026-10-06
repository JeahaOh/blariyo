# 관리자 수집 완료 시각 표시

- 요청: 관리자 화면에서 수집 완료 시간 확인.
- 담당: Codex / 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 시작 HEAD: `df71465`
- 상태: 종료 — 구현·검증·로컬 반영 완료 / 갱신일: 2026-10-07 KST
- 변경 경로: batch 결과 API/repository, collection OpenAPI·생성 계약·evolution hash, 관리자 batch 화면, 해당 화면/API 명세, 브라우저 검사, 이 기록.
- 기존 Discord 검토 기록은 종료 상태이며 변경하지 않는다. 전날 [정기 수집 작업](../../2026-10-06/local-batch-schedule/README.md)은 유지한다.

## 변경 기준

- `collect.batch_item.fetched_at`은 원문·첨부 저장 후 `FETCHED` 전환 시 기록되는 글별 수집 완료 시각이다. 배치 전체 종료·보존 시작·원문 게시 시각과 구분한다.
- API 목록·상세에 nullable `fetchedAt`을 반환한다. 완료 상태가 아니면 null이다. 새 DB 컬럼·과거 시각 추정은 없다.
- 목록과 상세 제목 아래에 한국 시간 기준 `YYYY. MM. DD. HH24:mi:ss`로 표시하고 KST 문구는 생략한다(후속 사용자 요청 반영). 완료 항목의 기록이 없으면 `수집 완료 시각 미기록`, 미완료 항목에는 완료 시각을 표시하지 않는다.
- 완료 시각은 원문 검수 digest에 추가하지 않아 기존 승인 snapshot 의미를 유지한다.

## 검증·잔여

- API/Web 빌드, Web·tests 타입 검사, 변경 API/Web/test ESLint, 계약 hash 검사1건, `git diff --check`, hook 설치 검사 통과.
- 격리 DB Chromium 검사7건 통과(완료 시각3 + 기존 목록·상세 이동4). 완료 시각 검사는 최종 테스트 타입 보완 후3건 다시 통과했다. 브라우저 시간대를 미국으로 바꿔도 `2026-10-06T15:30:45.000Z`가 `2026. 10. 07. 00:30:45`로 표시됨을 확인했다. nullable/실패 값, API 목록 값, 390/1280px 줄 넘침, 상세·목록 표시와 기존 URL/이력 동작을 확인했다.
- 화면 이미지 `.local-data/batch-completion-time/screenshots/{390,1280}.png` 직접 확인. KST 문구가 없는 날짜 형식과 메타정보 배치를 확인했다.
- 로컬 서버 기존 PID75367이 이 세션의 개발 실행기임을 확인 후 정상 재시작했다. 새 실행기는 `scripts/local/start-development.mjs`, 로그 `/tmp/blariyo-completion-local-server.log`, Web3000/API3100, workers=false다. 정기 수집 LaunchAgent는 변경하지 않았다.
- 실제 로컬 데이터 목록·상세200 및 동일 `fetchedAt` 반환, SSR HTML의 완료 시각 표시 확인. DB 구조·기존 데이터 수정 없음. 완료 시각 예시 readback은 `2026-10-06T13:25:53.522Z`다.
- 초기 테스트 fixture의 요청 간격은 해당 격리 DB가 사용하는 V002 제약에 맞춰10000ms로 수정했다. 운영 수집 간격·DB 제약은 변경하지 않았다.
- 이 변경만 작업 단위 커밋한다. 운영 배포·push는 미실행이며 기존 Discord 검토 기록을 보존한다.
