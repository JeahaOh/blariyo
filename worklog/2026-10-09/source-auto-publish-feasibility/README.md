# 수집 완료 알림과 출처별 자동 발행 가능 여부

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: 게시글별 Discord 전송 연결 방식과 특정 수집처의 무검수 자동 발행 가능 여부 확인.
- 변경 범위: 이 검토 기록만. 코드·정본·설정·DB·예약·Discord·발행 상태를 변경하지 않았다. 기존 미커밋 소스와 다른 기록을 보존했다.

## 현재 구현 확인

- Collector 저장과 Discord 전송은 다른 실행 단계다. `DiscordReviewWorker.exportOne()`이 API에서 전송 대상을 claim하고 글별 head 메시지, thread의 본문/이미지 메시지를 보낸다. 따라서 글1건은 검수 대표 메시지1개와 여러 본문 메시지에 대응하며 단일 메시지 전체로 제한되지 않는다.
- 이번 로컬 테스트는 수집기만 실행했고 이전 중지된 Discord 작업은 유지했다. 전송 대상 글이 저장돼도 worker를 실행하지 않으면 전송되지 않는다.
- `docs/planning/content-collection/README.md`는 수집 후 운영자 검수 없이 자동 발행하지 않는 정책이다. 현재 소스/출처 설정에 출처별 무검수 자동 발행 모드는 확인되지 않았다.
- `discord-review-policy.ts`는 등록된 사람의 승인 반응이 있을 때 APPROVE_PUBLISH를 만든다. `discord-review.service.ts`의 SYSTEM 경로는 만료 REJECT만 허용한다.
- `review-command.service.ts`에는 이미 승인 → 초안 생성 → 발행의 공통 실행 경로가 있다. 사람 승인 이후의 자동 처리가 출처별 무검수 승인 기능을 뜻하지 않는다.

## 가능 여부와 제안 — 미구현

- 특정 출처의 무검수 자동 발행은 개발 가능하다. 현재 설정 하나를 켜는 기능은 아니며 제품 정책과 출처별 발행 권한, 공통 API 명령 경로를 함께 확장해야 한다.
- 출처별로 검수 필요 / 조건 통과 시 자동 발행을 구분하고, 이미지·본문 검증/중복 방지 등 공통 검사를 유지하는 형태가 적합하다. 자동 판단 근거는 사람 승인과 구분해 기록한다.
- Discord 전송은 발행 여부와 분리해 검수 요청 또는 발행 결과 알림으로 사용할 수 있다. 자동 발행이 Discord 작업 가동에 종속되지 않도록 구성하는 안이다.
- 현재 요청은 가능 여부 문의이므로 자동 발행을 켜거나 구현하지 않았다. 구체 대상 출처·발행 범위·알림 방식은 미정이다.

## 검증

- Git 작업 전후 상태 확인, 관련 planning 및 현재 status/roadmap, Collector worker와 API 정책/명령 코드 직접 대조.
- 소스 변경이나 실행 테스트 없음. 기록의 `git diff --check` 확인. 과거 memory는 공유 검수 권한과 사람 승인 조건을 찾는 데 사용했으며 현행 소스로 재확인했다.
