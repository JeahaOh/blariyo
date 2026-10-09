# Discord·관리자 화면 게시물 검토 병행 가능성 검토

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 확인 HEAD: `85109e67779f046ddefd4b0440d163adc3df39ac`
- 상태: 종료 — 정본·소스 정적 검토 완료, 구현 미착수 / 갱신: 2026-10-06 21:26 KST
- 요청: 게시물 검토를 Discord 자동화와 현재 관리자 화면에서 병행할 수 있는지 검토만 수행.
- 범위: 현행 `/admin/batch` 수집 게시물 검수 중심. 회원 게시물 신고 처리·AI 자동 판정은 별도 요구로 간주.
- 변경 경로: 이 신규 작업 기록만. 품질 도입 기록의 종료(21:18), 후속 커밋 기록의 종료 확인. 기존 dirty/untracked를 보존하고 source·정본·DB·서버·Discord 설정·Git 반영은 변경하지 않는다.

## 결론

기술적으로 가능하다. 관리자 화면과 Discord가 동일한 API 소유 검수 상태·명령을 사용하는 구조를 권장한다. 알림·요청 접수·결과 갱신을 자동화하고 공개 결정은 운영자가 한다. 아직 구현된 투트랙 기능으로 보고할 수 없다.

| 확인한 근거 | 현재 상태와 의미 |
| --- | --- |
| [개발 명세](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md):53 | Discord 검수/발행 명령을 현재 범위 밖으로 명시. 후속 구현 시 planning부터 범위를 갱신하고 기술·API·개발 명세 동기화 필요 |
| [관리자 화면](../../../apps/web/app/pages/admin-batch.vue):275,369 | 승인→초안 생성→발행을 화면이 순차 요청. 서버의 단일 영속 작업 흐름은 아님 |
| [검수 서비스](../../../apps/api/src/features/collection/batch-review.service.ts):153 | item/review 버전, contentDigest, 멱등 receipt, 항목별 lock·원문 중복 검사가 있어 공통화 기반 재사용 가능 |
| [Discord Gateway](../../../apps/collector/src/main/java/com/blariyo/collector/discord/DiscordGateway.java):78,130 | `/collect url`, 상태, 수집 확인/취소 처리. 검수·발행 interaction 처리는 없음 |
| [관리자 인증](../../../apps/api/src/http/auth.guard.ts):20 및 [보안 계약](../../../docs/system-design/05-security-operations.md):67 | 서비스 토큰·actor·role과 BFF의 Access identity 검증 구조. Discord 수집 allowlist를 발행 권한으로 간주할 수 없음 |
| [원본 전송 제한](../../../docs/system-design/05-security-operations.md):232 | Discord에 image binary·storage key·내부 절대 경로를 남기지 않는 계약. 원본 미디어를 Discord에 복사하는 안은 별도 정책 변경 대상 |

## 대안과 추천 범위

| 대안 | 장점 | 비용·한계 | 판단 |
| --- | --- | --- | --- |
| Discord 알림 + 관리자 상세 링크 | 기존 인증/검수 화면 활용, 가장 작은 변경 | Discord 안에서 판단을 확정하지 못함 | 첫 연결 검증 단계 |
| Discord 승인 및 발행/반려 + 관리자 상세 편집 | 휴대폰에서 신속 처리, 같은 상태 공유 | 권한 매핑·공통 처리·동기화·복구 필요 | 목표안 |
| Discord에서 전체 본문/이미지 편집까지 제공 | Discord 안에서 작업 종결 | 이중 편집 UI 유지, 외부 사본 보존/회수·표현 제약 | 초기 범위에서 제외 권장 |

추천 UX는 검토 대기 알림 카드에 제목·출처·상태·관리자 상세 링크를 표시하고, 연결된 운영자에게 `승인 및 발행`, `반려`를 제공한다. 제목/본문/이미지 확인·복잡한 편집은 관리자를 사용한다. 충분히 내용을 확인하지 않은 알림 카드만으로 승인하도록 유도하지 않는다. 관리자의 현재 itemId 직접 링크를 재사용할 수 있다. 실제 관리자 origin은 설정값이며 이번 검토에서 추정하지 않는다.

## 구현 전에 해결할 항목

1. **High — 권한 경계:** Discord 계정과 내부 operatorId의 명시적 연결·해지, 명령별 권한, 허용 서버/채널, 실행 시 재검사 필요. 수집기의 DB/public 쓰기 권한을 늘리지 않고 API의 좁은 인증된 명령 경로를 설계한다. 기존 서비스 토큰을 수집기에 복사하는 구현은 권장하지 않는다. 봇만으로 발행을 허용할지, 추가 관리자 인증을 요구할지는 미정이다.
2. **High — 중간 실패 복구:** 양쪽에서 공통으로 사용하는 서버 작업이 승인/초안/발행 단계·각 멱등 키·postId·결과를 영속 보관하도록 검토한다. 이미지 처리 때문에 모든 단계를 하나의 긴 DB 트랜잭션으로 감싸지 않는다. 초안 생성 후 실패하면 해당 초안의 발행만 재시도한다.
3. **High — 동시 처리:** 카드를 만들 때 본 itemVersion/review lockVersion/contentDigest에 판정을 묶는다. 실행 직전 최신 버전을 자동 대입해 과거 내용을 승인하지 않는다. 관리자 반려 후 오래된 Discord 승인 클릭은 충돌로 막고 재조회/재판정을 요구한다. 동일 interaction 재전달은 같은 결과를 반환한다.
4. **Medium — 양쪽 표시 동기화:** DB를 기준으로 알림 재시도용 발송 대기 기록과 itemId↔messageId 대응을 보관한다. 관리자 처리 시 Discord 카드 갱신/버튼 비활성화, Discord 처리 시 관리자 재조회 반영이 필요하다. 첫 버전은 화면 복귀·명령 후 재조회 또는 제한된 폴링으로 충분하며 실시간 연결은 필수 아님. 메시지 삭제·알림 장애가 검수 저장 성공을 실패로 바꾸지 않아야 한다.
5. **Medium — 표시·보존:** 본문/이미지 사본 외부 전송은 현행 경계에 맞지 않는다. 알림 필드 최소화·멘션 차단·링크 미리보기 억제를 기본으로 검토한다. 미디어 표시가 꼭 필요하면 전송 범위·만료·삭제·고지를 정본에서 먼저 결정한다. 이번 검토는 법률 적합성 판정이 아니다.
6. **Medium — 가동 위치:** 현행 Gateway는 collector의 조건부 기능이다. 같은 프로세스에 검수 입력을 넣으면 수집기 PC가 꺼졌을 때 Discord 처리가 중단된다. 관리자/API는 독립 유지한다. 상시 Discord 사용이 요구되면 별도 상시 실행 위치와 운영 책임을 결정한다.

Discord 공식 문서는 버튼·입력 폼 interaction과 Gateway/HTTP 수신 방식을 지원한다. 최초 응답은 3초 안에 하고 interaction token의 후속 응답 유효 기간은 15분이다. 장시간 작업은 먼저 접수 응답하고 영속 작업 결과와 봇 메시지 갱신을 분리해야 한다. 이는 검토 카드 자체가 15분 후 만료된다는 뜻은 아니다.

- [Discord Components](https://docs.discord.com/developers/components/overview)
- [Discord Interaction 응답·시간 제한](https://docs.discord.com/developers/interactions/receiving-and-responding)

## 후속 개발의 수용 조건

- 양쪽 동시 승인/반려에서 오래된 요청 거절, 게시글 중복 생성·중복 발행 없음.
- 동일 interaction·응답 유실 재시도·프로세스 재시작 후 동일 작업 결과 복구.
- 권한 회수, 다른 채널/사용자, 원문 만료/변경, 이미 발행된 항목의 오래된 버튼 거절.
- 승인 성공·초안 성공·발행 실패 상태를 구분하고 기존 초안으로 복구.
- 알림 누락/메시지 삭제/Discord 장애에서도 관리자 검수 계속 가능, 복귀 후 상태 재동기화.
- 실제 운영자·Discord Gateway·관리자 브라우저·배포 증거는 각각 확인.

## 검증과 미검증

- 수행: 현행 planning·보안·개발 명세 및 API/Web/Discord source 대조, Discord 공식 문서 조회.
- 기존 테스트 파일은 참고만 했다. 테스트·빌드·브라우저·DB 조회/변경·Discord 실연결·발송·배포는 실행하지 않았다.
- 검토 결과는 개발 가능성과 필요한 변경의 판단이며 구현 완료·실동작 보장이 아니다.
- 기한·착수·봇 운영 장소·운영자 매핑·추가 인증 방식은 미정이다. 이번 요청으로 확정하지 않는다.

- 기록 검증: 상대 링크 7개 존재 확인, `git diff --check` 통과. 작업 전후 상태 대조에서 이번 신규 기록 외 기존 변경 목록 유지.
