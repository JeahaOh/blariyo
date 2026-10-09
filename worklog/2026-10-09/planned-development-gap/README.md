# 계획 대비 개발 잔여 검토

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 10:43 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / 기준 HEAD: `0bf9533`.
- 요청: 계획 대비 아직 개발하지 않은 항목 확인.
- 변경 경로: 이 기록만. 기존 untracked 작업 기록 보존. 앱·정본·DB·설정 변경 및 commit/push 없음.
- 범위: planning/system-design/legal/status/roadmap/요구사항 표와 현재 API·Web·Collector·migration 정적 대조. 운영 서버·외부 서비스 재조회, build/test는 실행하지 않았다.

## 실제 개발 잔여

| 구분 | 잔여 | 판정·근거 |
| --- | --- | --- |
| M0.5 | 게시글 `body_html` 저장 전환 | [로드맵](../../../docs/roadmap.md#45-m05--게시글-본문-html-저장-구조-전환). [현재 저장](../../../apps/api/src/persistence/posts.repository.ts)은 TEXT/IMAGE block. 정책 본문의 body_html 컬럼은 게시글 전환 증거가 아님 |
| M1 | 네이버·카카오·Google·Apple 가입/로그인, 동의·연령 판정, 계정 연결/해제·세션·탈퇴 | [제품 계약](../../../docs/planning/08-member-community-plan.md), [기술 계약](../../../docs/system-design/06-member-community-design.md). 현재 feature·page·migration·실행 계약에 대응 회원 구현 미확인 |
| M1.5 | 익게 텍스트 글·댓글·글별 랜덤 이름·내 활동·신고·제재/운영 관리 | 같은 제품·기술 계약. 일반 게시판 공통 route가 있으나 회원 참여·댓글·신고 구현은 미확인 |
| 후속 수익화 | 광고 슬롯·광고 연동/동의·차단 안내·제휴 표시 | [서비스 기획 §6](../../../docs/planning/01-service-plan.md#6-후속-광고와-제휴). 현재 제품 구현 미확인, M0 범위 밖 |
| Discord 후속 | Discord 안에서 제목/문장 수정 | [로드맵 첫 항목](../../../docs/roadmap.md). 관리자 초안 편집 기능과 구분 |
| 사용자 지정 방향 | X/Instagram 게시물 별도 캡처 또는 내부 이미지 추출 | [요청 기록](../../2026-10-08/social-post-capture-direction/README.md). [parser](../../../apps/collector/src/main/java/com/blariyo/collector/source/common/OrderedContentParser.java)는 추가 SNS fetch 없이 링크를 보존. 방식·실패 정책 미정 |
| 검토 후보 | 검수 이력 기반 수집 필터 | [검토 기록](../../2026-10-08/review-pattern-filtering/README.md). 일별 특징/판정 이력·예측 비교·자동 필터 미구현. 확정 구현 과제로 승격된 것은 아님 |
| 검토 후보 | Discord 30분 검수·판정 근거 보존 강화 | [주기 검토](../discord-review-publication-recheck/schedule-frequency-review.md). [reviewSlot](../../../apps/api/src/features/collection/discord-review.service.ts)은 07:30/17:00. [finishObservation](../../../apps/api/src/persistence/discord-review.repository.ts)은 반응 상세를 비움. 주기 변경·최소 근거 보존은 미구현 |
| 선택적 후속 | BigQuery 저장/집계·분석 대시보드, 자동 CD | [분석 확장](../../../docs/planning/04-analytics-expansion-proposal.md), [운영 상태](../../../docs/operations/current-status.md). 현재 필수 M0 개발 범위와 구분 |

## 미개발로 세면 안 되는 항목

- M0 공개 목록/상세·관리자 작성/예약/발행/숨김·이미지·정책, URL/자동 수집·검수·보존 회수는 대응 source가 있다. 현재 실행 통과를 재검증했다는 뜻은 아니다.
- Discord 승인/반려/발행도 구현돼 있다. [10/9 재조회 기록](../discord-review-publication-recheck/README.md)은 10/8 운영 승인 8건 모두 PUBLISHED를 확인했다. 이번 검토의 실시간 운영 조회 결과로 인용하지 않는다.
- GA4 analytics-v1의 이벤트/동의 코드, Kakao 공유 코드, Drive 백업/복원 도구는 존재한다. 실제 외부 수신·계정/설정·고지·운영 전환 인수는 별도다.
- COL-QUALITY-01 출처별 원문/수집 결과/미리보기 만족도 검사, OWNER/EDITOR Access/MFA·반복 업무, 복구/rollback·실제 기간 관찰 등은 검사·인수 잔여다. 최신 완료 증거를 이번 범위에서 확인하지 못한 항목을 코드 부재로 판정하지 않는다.
- 차단/미검증 출처 재개와 legacy CON-01은 조건부 대기다. 모든 후보 출처 성공은 M0 완료 조건이 아니다.

## 판단 한계와 우선순위 제안

- 9/27 요구사항 표의 I32/P8/U0 및 80%는 당시 M0 40개 묶음 기준이다. 현재 전체 제품 개발률로 재사용하지 않는다. 후속 Discord·수집 구현과 운영 기록을 별도로 대조했다.
- 운영 효율을 우선하면 판정 근거 보완/주기 정책 확정 → 출처별 품질 검사와 SNS 보완 → Discord 편집 순서를 제안한다. M0.5는 M0 운영 인수 후 구조 변경으로 분리하고, 회원 → 익게 순서를 유지한다. 착수·기한은 미정이다.
- 검증: 현재 source/정본·Git 기준선 대조, 기록 내 상대 링크 존재, 작업 전후 Git 상태, diff whitespace 확인. 코드 변경이 없어 build/test 및 브라우저 검사는 실행하지 않음.
