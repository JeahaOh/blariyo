# 수집 실행 장비 IP에 따른 차단 가능성 설명

- 요청: 개발 서버 IP 때문에 차단될 수 있는지 설명.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 08:57 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`.
- 담당 경로: 이 기록 폴더만. 이전 담당 종료 확인, 기존 소스·사용자 변경·과거 기록 보존.
- 검토: PinnedHttp.validate의 NON_PUBLIC_IP는 목적지 DNS 주소 검사이며 실행 장비의 발신 IP 차단과 다르다. SourceRequests의 HTTP_ACCESS_DENIED는 실제401/403 응답을 구분하지만 IP가 원인인지 단독 확정하지 못한다.
- 외부 근거: Cloudflare 공식 IP Access rules는 발신 IP/통신망/국가 기준의 차단·접근 확인을 지원한다. [공식 문서](https://developers.cloudflare.com/waf/tools/ip-access-rules/).
- 오늘 새벽의 디미토리·개드립 SOURCE_ACCESS_BLOCKED는 외부 응답/접근 확인 분류로 IP 차단 가능성은 있지만 실제 원인 미확정. 클리앙 SOURCE_NOT_ALLOWED는 내부 URL/DNS/IP/redirect 검사 분류로 발신 IP 차단과 동일시하지 않는다. 당시 누락 진단은 추정하지 않는다.
- 직전 검사는 격리 DB/응답 fixture 회귀이며 실제 개발/운영 발신 IP에서 수집처 접속 성공을 검증한 결과가 아니다.
- 권장 확인: 동일 URL·동일 수집기/설정·같은 요청 조건을 실행 환경별 소량 비교해 HTTP 상태/진단/시간을 확인한다. 차이만으로 IP 단독 원인으로 확정하지 않는다.
- 실행하지 않음: 발신 공인IP 조회·원문 사이트 요청·재수집·운영 변경·코드 수정·Git 반영.
- git diff --check 통과. 신규 링크는 확인한 공식 문서이며 기존 변경 보존 확인.
