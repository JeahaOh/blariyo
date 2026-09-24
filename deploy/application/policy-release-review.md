# M0 Core 정책 발행 결과와 후속 변경 기준

- 기준일: 2026-09-20
- 현재 상태: 약관·개인정보처리방침 `v0.1` 운영 DB EFFECTIVE, Core·Web 기동, 공개 HTTPS 확인
- 편집 정본: [M0 공개 정책](../../docs/legal/m0-core/README.md)
- 실행 증거: [운영 배포 기록](../../worklog/2026-09-20/infrastructure-setup/TASK-19.md)

이 표는 9월 20일 발행 당시 기록이다. [9월 23일 DB 반영](../../worklog/2026-09-23/release/production-db-promotion.md)에서도
정책 6건의 반영 전후 행 해시를 동일하게 유지했다. 현재 배포·인수 잔여는 [운영 상태](../../docs/operations/current-status.md)를 따른다.

현재 M0는 로그인 없는 짤 열람·운영자 발행·정책·이메일 문의·누적 조회 수다.
일반 회원·소셜 로그인·GA4·광고·자동 수집은 활성화하지 않았다. 후속 기능의 미확정 조건을
이번 배포에서 제거하지 않았다.

| 항목 | 현재 확인 |
| --- | --- |
| 연락처 | 기존 공개 연락처 5개를 HTML escape 후 주입. 원문은 비공개 설정에서 관리 |
| 시행일 | 사용자 최종 결정 2026-09-20. 발행 당시 시각을 artifact에 기록 |
| 호스팅 | AWS 청구 화면의 Amazon Web Services Korea LLC, Lightsail 서울 |
| 저장·보안·메일 | Cloudflare R2·CDN·Tunnel·Access·Email Routing → 일반 Gmail. 사업자 글로벌 처리와 개별 요청 처리 국가의 한계 구분 |
| 보관 | 일반 진단 로그 최대 7일 삭제 작업 검증. 문의·권리 요청은 목적 종료 후 수동 파기, 법정·분쟁 예외 분리 |
| 백업 | 12시간 주기 age 암호화 R2 DB 백업, 7일 보관. 실파일 다운로드·복원·ledger/본문 해시 대조 통과 |
| 발행 | 실제 `policies:publish` command 사용. 독립 SQL readback으로 정제 본문 SHA-256 일치 |
| 공개 | `/terms`, `/privacy`, 정책 API 200·v0.1·당일 시행일·미입력 표식 없음 |

`v0.1-draft.1`과 `v0.1-draft.2`는 당시 본문 그대로 보존했다. 초기 SQL은 고정된 draft.2를
등록하고, 새 DB의 확정 정책은 migration·seed 이후 별도 발행 command로 등록한다.
발행 시각 5분 제한과 체크섬 검사를 우회하지 않는다. 이미 발행한 v0.1 본문을 덮어쓰지 않는다.

실제 운영에서 메일 수신·처리·파기는 운영자가 수행해야 한다. 관리자 로그인 이후의 게시물
발행·이미지 업로드 흐름과 장기간 보관 timer 관찰은 별도 증거이며 공개 페이지 통과로 대신하지 않는다.
법적 분쟁의 결과나 일괄 면책을 보장하는 문서는 아니다.
