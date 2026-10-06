# 수집 제목의 출처·게시판 표기 정리

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `12df6aed`
- 상태: 종료(구현·검증·로컬 반영) / 갱신: 2026-10-05 21:37 KST
- 요청: `| 보배드림 베스트글`처럼 제목 뒤에 붙은 출처·게시판 이름 제거.
- 앞선 로컬 재수집 담당 종료 확인. 기존 변경 보존, commit/push/운영 배포 제외.
- 원인: 사이트명 단독 접미사만 등록되어 게시판 결합 표기가 남고, 검수 목록/상세 제목은 보정 함수 미적용.
- 범위: 공통 제목 규칙, 검수 목록·상세 표시, 회귀 검사와 관련 화면/제목 계약. 수집 원본 DB와 기존 게시글 일괄 수정 없음.
- 실제 로컬 자료에서 확인한 추가 접미사: 보배드림 베스트글, 베스트 라이브(아카라이브), HIT 갤러리(디시인사이드), YULDO(율도). 임의의 구분자 뒤 문구를 통째로 지우지 않는다.
- 검증 예정: 알려진 접미사 제거·본문/다른 출처 보존, 브라우저 목록/상세/초안 일치·원제목 보존, 빌드/타입 및 로컬 반영.

## 결과

- 공통 함수에 실제 확인된 출처·게시판 접미사4종을 추가. 검수 목록·상세 heading·초안 기본값·API 저장이 같은 규칙을 사용한다.
- 보배드림 로컬 수집 원제목6건을 읽기 전용으로 대조하여6건 모두 `| 보배드림 베스트글` 제거 확인. 원제목 DB·별도 출처/URL과 기존 게시글은 수정하지 않았다.
- 제목 중간의 출처 언급·일반 하이픈·다른 출처·접미사만으로 된 제목은 보존한다. 출처별 알려진 접미사만 제거한다.
- 수집 기획·화면·API 설계·개발 명세 동기화. wire schema/DB migration 변경 없음.

## 검증

- 수정 전 보배드림 재현 assertion 실패 확인 → 수정 후 제목/계약2 tests PASS.
- Chromium16 tests PASS: 보배드림390/1280px 목록·상세·초안에서 접미사 제거, 실제 승인/발행 제목 및 수집 원제목 보존 확인. 기존 개드립 표시 기대값은 새 화면 계약에 맞춰 변경했다.
- 최초 브라우저 실행은 새 발행 표본이 기존 시나리오의 고정 게시글 수 assertion에 포함되어 실패. 새 검증을 기존 시나리오 종료 뒤로 분리해 원래 assertion을 유지하고 전체 재실행 통과.
- Web build/typecheck, contracts/tests 타입 검사, 변경 Web/contracts/tests lint, git diff --check 통과.
- `.local-data/admin-ux-rework/screenshots/batch-title-label-{390,1280}.png`에서 제목 표시 확인. 임시 로그 `/tmp/blariyo-title-label-*.log`.
- 기존 소유 로컬 서버를 정상 종료하고 새 Web 빌드/API 프로세스로 재시작. Web3000/Core3100·workers=false·readiness READY 확인.
- HEAD `12df6aed` 유지. commit/push/운영 배포 미실행.
