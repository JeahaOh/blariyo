# 비공개 파일 위치 목록과 Git 제외

- 담당: Codex
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/collection-schedule-0430-1530`
- 상태: 종료 — 위치 목록·Git 제외·보관 경로 정렬 완료, 실제 백업·복원 미실행 / 작업일: 2026-10-07 KST
- 요청: Discord 준비와 별도로 포맷 시 유실되지 않도록 비공개 파일 관리 위치 통일 또는 목록화, Git 제외.
- 변경 범위: `.gitignore`, 운영 비공개 파일 안내와 진입 링크, Discord 입력 파일의 토큰 보관 예정 경로·저장 도구, 이 기록.
- 보존 경계: 기존 credential·복구키·런타임 파일의 이동·삭제·내용 출력·외부 업로드 없음. 백업 실행·복원 검증은 별도이며 이번 목록 작성으로 완료 처리하지 않는다.
- 기존 상태: 두 Discord worklog 폴더 untracked. 운영·로컬 입력 JSON은 사용자 값이 있으며 해당 경로만 보완한다.

## 결과

- 갱신: 2026-10-07 22:03 KST. 운영 정본: [비공개 파일 위치](../../../docs/operations/private-files-and-recovery.md).
- 실제 존재/권한 확인: ~/.config/blariyo 기존 파일26개, Git 제외 age 복구키, iCloud Lightsail 개인키·계정 복구 코드 후보, .local-data의 개발/운영 수집/데이터 폴더, SSH와 launchd 설정. 이름/메타데이터만 목록화했고 비밀값을 기록하지 않았다. Keychain 항목·클라우드 사본·운영 서버 원격 파일은 미검증.
- 새 토큰 위치: ~/.config/blariyo/discord/local/discord-token. 디렉터리0700 생성, 로컬 JSON과 getpass 저장 도구를 일치시켰다. 자동 승인된 로컬 폴더 생성 범위 외에는 기존 외부 비공개 파일을 변경하지 않았다. 이전 task_list 준비 경로는 빈 상태로 보존하고 사용 중단을 명시했다. 실제 token은 아직 없으며 두 환경 token 보관 확인은 false다.
- Git 제외: 실제 Discord 입력 JSON2개·token·age identity·Lightsail key·비공개 복구 폴더를 추가했다. JSON2개는0600으로 맞췄다. 기존 데이터 제외 유지, template·안내·도구는 추적 가능. 강제 add/이미 추적된 비밀에 대한 한계를 명시했다.
- 검증: 제외 대상7경로 매칭, 공개 템플릿/문서/도구3경로 비제외, 검사한 비공개 경로 Git 추적0, JSON 파싱, 상대 링크 존재, helper 합성값0600/덮어쓰기/심볼릭 링크 거부, 실제 token 미저장 확인. 실제 백업·해시 readback·복원·외부 업로드·commit/push는 미실행.
