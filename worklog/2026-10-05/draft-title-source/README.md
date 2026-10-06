# 초안 제목의 출처 접미사 제거

- 요청: 초안 제목 끝의 `- DogDrip.Net 개드립` 등 사이트 표기 제거.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD·release: `12df6aed`
- 상태: 종료(구현·검증·로컬 적용 완료) / 갱신: 2026-10-05 19:43 KST
- 앞선 common-code-groups 담당 종료 확인. 기존 dirty 변경 보존.
- 변경 경로: contracts 제목 보정 유틸, API batch 승격, Web 검수 초안 제목, 관련 테스트, planning·API 설계·개발 명세.
- 범위: 현행 batch 초안 기본값과 저장 제목에서 출처별 알려진 접미사만 제거. 수집 원제목·출처 필드·기존 게시글 보존. DB migration 없음.
- 검증 예정: 접미사/본문 하이픈/다른 출처 보존, API 실제 초안 저장·원제목 보존, 브라우저 제목 입력, API/Web 빌드 및 타입 검사.
- commit/push/운영 배포는 이번 범위에 없음.

## 결과

- 공유 `@blariyo/contracts/draft-title`을 Web 기본값과 API 승격 저장에 적용. sourceKey별 알려진 사이트명과 앞 구분자를 제목 끝에서만 제거한다. 공통코드 표시명 수정으로 제거 규칙이 바뀌지는 않는다.
- 사용자 예시 → `실업급여 받고 여행 왔다는 말에 화가 많이 났다는 강레오` 확인. 일반 하이픈·중간 문구·다른 출처·미등록 출처·빈 제목 방지 확인.
- 수집 원제목·별도 출처명/URL·본문 및 기존 저장 게시글은 보존. 신규 초안에 적용하며 기존 초안 일괄 갱신은 수행하지 않았다.
- 정책·API 설계·개발 명세 동기화. API wire schema와 DB 구조 변경 없음.

## 검증

- 제목 단위 검사 및 migration 계약 검사: 2 tests PASS.
- API 실DB batch 통합: 21 tests PASS. 제목 생략/명시 요청의 실제 저장 및 원제목·출처 보존 검증.
- Chromium batch 브라우저: 12 tests PASS. 원제목 heading 유지, 초안 입력에서 사이트명 제거, 수동 제목 수정 후 저장과 기존 복구 흐름 확인.
- 최초 브라우저 실행은 새 fixture가 등록 후 출처 식별자를 변경해 DEDUP_IDENTITY_CONFLICT로 실패. 출처·run을 최초 INSERT부터 지정하도록 fixture를 수정한 뒤 전체 재실행 통과. guard·기대 assertion은 유지했다.
- API/Web build, contracts/Web/tests 타입 검사, 변경 API/Web/contracts/tests lint, `git diff --check` PASS.
- 현재 세션의 기존 서버를 정상 종료하고 새 빌드로 재시작: Web3000/Core3100, workers=false, API readiness READY, 미인증 batch302→로그인200. DB migration·운영 접속 없음.
- 상세 로그: `/tmp/blariyo-draft-title-api.log`, `/tmp/blariyo-draft-title-browser.log`, `/tmp/blariyo-draft-title-web.log`, `/tmp/blariyo-draft-title-types.log` (로컬 임시 증거).
- 잔여: Git 반영·운영 배포 미실행.
