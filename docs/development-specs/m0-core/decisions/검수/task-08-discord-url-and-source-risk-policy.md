# Task 08. Discord URL 입력과 출처 운영 위험 정책 정정 검수

## 1. 요청

- 운영자가 Discord에서 URL을 지정하면 해당 메시지를 기반으로 스크래핑을 실행할 수 있는 구조를 문서화한다.
- Discord incoming webhook만으로 URL 수신을 처리하지 않고, 운영자 로컬 collector의 Discord App 연결을 사용한다.
- 출처 사이트 이용약관은 자동 차단 조건이 아니라 운영 위험 참고값으로 낮춘다.
- `robots.txt`, 차단 우회 금지, 요청 상한, SSRF 방어는 기술 gate로 유지한다.
- 이미지는 Python extractor 작업 경로에 임시 저장하고, 게시가 결정되면 블라리요 저장소에 올린다.

## 2. 반영 기준

- Discord 입력은 `/collect url:<원문URL>` 명령만 M0 수집 보조 범위로 둔다.
- 일반 Discord 채널 메시지를 감시해 URL을 추출하지 않는다.
- Discord incoming webhook은 처리 결과 알림용으로만 사용한다.
- 운영자 로컬 collector는 Discord guild, channel, user 권한을 검증한 뒤 BE collector 제출 API로 후보 결과를 전송한다.
- source spec 판정 체계는 `사용 / 보류 / 차단`과 `운영 위험도`로 정리한다.
- 이용약관은 운영 위험 참고값이며, `robots.txt` 금지·차단 응답·로그인/CAPTCHA/유료 장벽 우회 필요·요청 상한 초과·SSRF 위험은 기술 gate다.

## 3. 정정 파일 범위

- `docs/planning/01-service-plan.md`
- `docs/planning/03-screen-design.md`
- `docs/planning/05-benchmark-spec.md`
- `docs/planning/content-collection/README.md`
- `docs/planning/content-collection/source-spec-template.md`
- `docs/planning/content-collection/sources/*.md`
- `docs/system-design/README.md`
- `docs/system-design/01-system-architecture.md`
- `docs/system-design/02-data-model.md`
- `docs/system-design/03-api-design.md`
- `docs/system-design/04-infrastructure-design.md`
- `docs/system-design/05-security-operations.md`
- `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md`
- `docs/development-specs/m0-collection-assist/collection-assist/api/create-candidate-from-url.md`
- `docs/development-specs/m0-collection-assist/collection-assist/api/retry-candidate.md`
- `docs/development-specs/m0-collection-assist/collection-assist/api/promote-candidate-to-draft.md`
- `docs/development-specs/m0-collection-assist/collection-assist/d01/create-and-review-candidate.md`
- `docs/development-specs/m0-collection-assist/collection-assist/d01/promote-candidate-to-draft.md`
- `docs/development-specs/m0-collection-assist/collection-assist/d08/collect-candidate-review.md`

## 4. 검수 포인트

- Discord URL 입력과 관리자 화면 URL 입력은 같은 로컬 collector 추출·제출 흐름을 사용한다.
- Incoming webhook을 URL 수신 수단으로 잘못 문서화하지 않는다.
- 일반 메시지 감시와 Message Content intent 의존 구조를 만들지 않는다.
- 출처 이용약관을 자동 승인/차단 gate로 표현하지 않는다.
- `robots.txt`, 요청 상한, SSRF 방어, 우회 금지는 유지한다.
- 후보 단계 이미지 영구 저장을 허용하지 않는다.
- Python 임시 파일 내부 경로, image binary, storage key를 로그·응답·Discord 보고에 남기지 않는다.

## 5. 미검증

- 실제 Discord Application, command 등록, collector 실행 PC, guild/channel/user 설정은 미검증이다.
- 실제 Python extractor, 임시 파일 cleanup, R2 저장, parser, browser, runtime은 미검증이다.
- 실제 source, migration, OpenAPI, contract test는 현재 브랜치에 없다.

## 6. 검증 결과

- `git diff --check`: 통과
- Markdown 상대 링크 검사: 통과
- source spec 21개 파일의 `활성 단계`, `운영 위험도`, 이미지 임시 저장 섹션, 최종 판정 필드 확인: 통과
- source spec 내 이전 승인·금지 중심 판정 표현 잔존 검사: 통과
- 비밀값·토큰·쿠키 원문 패턴 검사: 발견 없음
