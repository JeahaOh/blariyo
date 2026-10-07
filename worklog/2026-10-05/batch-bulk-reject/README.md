# 수집 결과 목록 일괄 반려

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6ae`
- 상태: 종료 / 갱신: 2026-10-05 22:16 KST
- 요청: 수집 결과 검수 목록에서 체크한 여러 항목을 일괄 반려.
- 변경 경로: Web 검수 페이지·관리 CSS, browser 검증, planning 화면·API 설계의 화면 호출 규칙, 이 기록.
- 기존 작업 image-collection-process-audit 종료 확인. 기존 dirty/untracked 변경 보존. 현재 요청은 UI 구현이며 이미지 수집 정책 수정은 범위 밖.
- 구현 범위: 현재 페이지 선택/전체 선택, 처리 가능한 항목 제한, 기존 단건 API 순차 호출, 버전 충돌·부분 실패·응답 유실 구분, 조회 시 선택 해제.
- 검증 계획: Web 타입/lint/build, 격리 DB Chromium에서 선택·반려·동시 변경·응답 유실·재조회·반응형 정렬 확인.
- 운영 변경·commit/push 미실행.

## 구현·검증

- 목록 체크와 상세 선택을 분리하고 현재 페이지 전체 선택·부분 선택 표시·선택 건수·선택 반려 버튼을 구현했다. FETCHED·미반려·게시글 미연결·미만료만 선택 가능하다.
- 기존 detail/review API를 순차 호출한다. 목록 당시 item version·review lockVersion/상태와 최신 상세를 대조하고, 기존 contentDigest/서버 버전 검증을 유지한다. 변경된 항목은 개별 실패로 남긴다.
- 처리 중 버튼/조회/화면 이탈을 잠그고 공통 로딩바를 사용한다. 응답 유실은 항목별 body와 Idempotency-Key를 보존해 `반려 결과 다시 확인`으로 같은 요청만 재전송한다. 성공 항목은 재전송하지 않는다.
- 결과는 완료·실패·미확인 건수와 실패 제목/사유로 표시한다. 목록 갱신 실패는 반려 실패로 바꾸지 않는다. 일괄 처리 시 기존 상세/URL 선택을 닫고 수동 조회·페이지 이동 시 체크를 비운다.
- API 계약·DB migration 변경 없음. 기존 권한 검증과 반려 저장 API 재사용. 삭제·발행 호출 없음.
- Web build/typecheck, 변경 Vue와 신규 테스트 ESLint, tests/tsconfig 전체 타입 검사 통과.
- 격리 DB Chromium: 기존 검수·navigation20 tests 통과. 신규6 tests 통과(선택/전체 선택/모바일, 항목 충돌·대상 외 보존, POST 성공 후 응답 유실·동일키 재확인·lock_version1, 목록 조회 실패와 상세 해제, 페이지 이동·현재 페이지 한정).
- 최초 신규 fixture SQL의 UUID/text 매개변수 충돌은 명시적 uuid cast로 수정 후 재실행했다. 애플리케이션 실패가 아니다.
- 1280/768/390/320px에서 가로 넘침·버튼44px·toolbar 영역 검사 통과. 1280/390px 실제 스크린샷 육안 확인. 증거: `.local-data/admin-ux-rework/screenshots/batch-bulk-*.png`.
- 로컬 서버 새 Web 빌드 반영 후 `/admin/batch` 인증 GET200, 체크박스/전체 선택/선택 반려 HTML 확인. 테스트는 랜덤 격리 DB에서 실행했으며 로컬 실제 수집 항목의 반려 요청은 실행하지 않았다.
- 운영 반영·commit/push 미실행. 기존 이미지 수집 프로세스 검토에서 확인한 정책 문제는 이 UI 변경과 별개로 남아 있다.

- 최종 안내 문구 정정 후 Web 재빌드·신규 Chromium6 tests 재실행·로컬 새 빌드 인증 GET200 재확인 완료. `git diff --check` 통과. 기존 변경 보존, HEAD `12df6ae` 유지.
