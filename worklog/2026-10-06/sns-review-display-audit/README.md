# SNS 링크 수집 방식과 검수 화면 대조

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료 / 갱신: 2026-10-06 21:09 KST
- 요청: 지정 수집물의 SNS 링크 처리가 이전 변경 방식과 일치하는지 확인.
- 범위: 기획·기존 기록·현재 source·로컬 DB·브라우저 읽기 검토 및 이 기록만 작성. 다른 담당 파일과 기존 변경을 보존한다.

## 확인 결과

- 현행 수집 기획은 SNS URL을 LINK로 보존하고, 공개 화면은 지원하는 공식 임베드를 사용한다. SNS 본문·영상 복제 또는 캡처 저장으로 변경한 계약은 확인하지 못했다. 9월23일 batch 고도화 기록도 URL 보존과 공개 X 공식 iframe 확인을 구분한다.
- 지정 item `a621c1a0-7020-4eac-8b04-49e6891227d9`: 율도/FETCHED, 본문 LINK1개, sns_links1개. 둘 다 `https://twitter.com/museun_happen/status/2107376863094145516`이며 수집 DB에 해당 SNS의 본문·이미지는 없다.
- `apps/web/app/pages/admin-batch.vue`는 LINK를 일반 `<a>`로만 렌더링한다. 실제 Chrome에서도 상세 하단에 URL 텍스트만 표시되고 SNS 임베드는 없다.
- 공개 상세 `apps/web/app/pages/[boardSlug]/posts/[postId].vue`는 `socialDisplayBlocks`와 `XPost`/`SocialPost`를 사용한다. 공식 임베드 사용 여부는 환경 설정과 외부 위젯 로딩 결과에 따르며 이번 검토로 해당 SNS의 실제 임베드 성공을 주장하지 않는다.
- 결론: 현재 수집 저장 방식은 URL 보존 계약과 일치한다. 검수 화면에는 공개 화면의 SNS 임베드 표시 경로가 연결되지 않아 확인 경험이 다르다. 검수에서도 게시물 내용을 보이게 하려면 기존 SNS 표시 컴포넌트 연결이 필요하다.

## 검증·잔여

- DB readback과 실제 관리자 브라우저 표시를 대조했다. 수집 parser·공개 표시·검수 표시를 별개로 확인했다.
- 코드/DB/설정 수정·재수집·발행·커밋/푸시는 하지 않았다. 작업 기록만 작성했으며 `git diff --check`로 공백 오류를 확인한다.
- 이전에 SNS 캡처/본문 복제 방식으로 변경한 별도 결정이 있었다면 현재 확인한 계약과 다르므로 그 결정의 범위를 추가 대조해야 한다.
