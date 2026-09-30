# 파비콘 feature 통합과 기존 작업 보존 재검토

- 요청: 파비콘을 별도 feature로 커밋 후 release 병합, 앞선 작업의 유실 여부 재검토.
- 담당: Codex / 상태: 종료 (파비콘 커밋·보존 검토) / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/brand-favicon`, 기준 release `ad5bc788915eee41a182114c1c0e4f5542829816`.
- 인계: Gemini의 종료된 [파비콘 작업](../brand-favicon/README.md) 8파일을 사용자 후속 지시에 따라 인수.
- 변경 범위: 기존 파비콘6개·Nuxt head 설정·원본 작업 기록, 이 기록 폴더, 현행 status/roadmap의 Git 보류 상태.
- 갱신: 2026-09-30T22:09:16.899941+09:00.

## 보존과 처리

- 시작8파일은 `.local-data/git-backups/favicon-20260930/`에 원본 복사·SHA-256·patch로 보존했다. 모든 Git ref의 추가 bundle 생성·검증 완료.
- release 기준 새 feature로 작업을 이관했다. Nuxt 설정의 겹친 부분만 해결하고 release의 관리자 CSS·로그인 설정을 유지했다.
- 파비콘 등록 중 제거됐던 `devtools: { enabled: false }`를 복구했다. 원본 이미지6개와 Gemini의 당시 기록은 변경하지 않는다.
- [기존 Git 정리](../git-cleanup-execution/README.md)의 통합 및 cherry-pick 보존, 별도 m0-core88파일, 원격 상태를 재검증한다.
- 검증·병합·push 결과는 후속 항목에 기록한다. main 승격·운영 배포는 이번 범위가 아니다.

## 결과

- 파비콘 기능 커밋: `3f353888006f12fec75c1a86ebe837fa56870fac`. Nuxt 변경은 release 대비 `app.head.link` 11줄 추가뿐이다.
- 원본 이미지6개와 Gemini 기록1개는 시작 SHA-256과 일치한다. [기준선](BASELINE.json), [현재 검증](VALIDATION.json), [HTTP readback](RUNTIME-CHECK.json).
- Web build, 타입 검사, lint, 캐시 시험4개 PASS. 실제 HTTP6파일은 원본과 바이트 동일하고 HTML의 아이콘 link5개를 확인했다. Chrome SVG 표시와 PNG 원본을 시각 확인했다.
- 앞선 통합의 source tree5개는 검증 시점과 동일하다. 이번에 API/Collector/전체 브라우저 기능 시험을 재실행한 것으로 보고하지 않는다.

## 유실 재검토 판정

- [전수 대조 결과](PRESERVATION-AUDIT.json): 비교한 커밋·파일·기존 미커밋 기준선에서 설명되지 않는 유실 **0건**.
- 정리한14개 cherry-pick 전부 release 조상이며 기존 날짜순 first-parent 순서 유지. 10개 patch 동일, 3개는 기록된 문서 충돌 해결, 1개는 기존 merge의 빈 이력 표식이다. 날짜 재정렬 전후 전체 tree도 동일하다.
- 기존 feature 최종 `da3a96e`가 release에 포함된다. 두 부모 중 한쪽에 있던 파일의 통합 후 삭제0개. 자동 결합과 별도로 달라진27경로는 충돌 해결·화면 탐색 연결·과거 캡처 보호·이번 통합 증거 추가로 모두 설명된다.
- 앞서 커밋한38파일 중36개 원본 바이트는 release 조상에서 확인했다. 로그2개는 당시 [공백 정리 기록](../scoped-uncommitted-commits/LOG-NORMALIZATION.json)의 전후 해시와 일치하며 현재도 보존됐다.
- 계약5개·migration19개의 manifest 해시 일치. 별도 m0-core88파일은 상태·HEAD·전체 SHA-256 모두 시작과 동일하다.
- 최초 backup bundle의 SHA-256 일치·verify 통과, bare 복구 저장소의29개 ref commit/tree 조회·fsck 통과. 삭제한 기존 브랜치의 이력도 복구 가능하다.
- 검토 중 `docs/status.md`에 남은 analytics-v1 구현 미실행 문구는 통합 전부터 오래된 상태였다. 실제 코드와 9/25 구현 기록·9/30 통합 검증을 근거로 로컬 구현/운영 활성화 상태를 나눠 갱신했다.

## 종료 브랜치와 최종 반영

- [종료 처리](CLEANUP.json): 이전 `feature/m0-design-completion`의 local/remote 삭제 완료. 둘 다 기존 원격release 조상이고 열린 head/base PR0개를 재조회했다. 파비콘 작업은 새 feature 커밋으로 보존했다.
- 이 검토 기록 커밋 후 `feature/brand-favicon → release`를 `--no-ff`로 병합하고 승인된 일반 push를 실행한다. 최종 SHA·서버 readback·root clean은 실행 후 최종 응답에서 보고한다. 이 기록은 반영 전 검증을 고정하며 미래 실행을 통과로 간주하지 않는다.
- 병합 후 이번 종료 feature의 로컬 참조를 정리한다. `feature/m0-core` 및 기존 고유 원격14개는 유지한다.
- main=`8af7244` 유지. 운영 배포·실제 GA4 수신·운영 인수는 이번 보존 검토와 별개다.
