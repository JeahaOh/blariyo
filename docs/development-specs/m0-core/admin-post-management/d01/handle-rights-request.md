# 권리 문의 게시글 처리 D01

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [권리자 안내 §3~§5](../../../../legal/rights-request.md), [보안·운영 §12](../../../../system-design/05-security-operations.md)
- 미검증: 실제 접수 이메일·수령인, 법률 검토, 운영·outbox runtime

## 1. 프로세스 목적과 범위

권리 문의 이메일을 확인한 운영자가 자료 완전성 판단 전 게시글을 먼저 숨기고 최종 조치를 결정한다.

## 2. 행위자·시작·선행 조건

행위자는 확정 접수 채널을 관리하는 운영자다. 접수 이메일·수령인·회신 채널은 출시 전 확정이 필요하다.

## 3. 정상 흐름

1. 운영자가 메일에서 대상 공개 URL을 확인한다.
2. `/admin`에서 게시글과 현재 상태를 찾는다.
3. `RIGHTS_EMAIL`로 숨김 명령을 실행한다.
4. 공개 상세 404·목록 제거·모든 image/cache purge 상태를 확인한다.
5. 요청자에게 접수·비노출을 회신하고 필요한 보완을 받는다.
6. 운영·법률 판단에 따라 수정 후 재공개, 재공개, 비노출 유지 또는 최종 제거를 선택한다.
7. 결과를 당사자에게 회신한다.

## 4. 대안·실패 흐름

- 자료 부족: 숨김 유지, 보완 요청.
- purge 실패: 공개 API 404 유지, outbox 해결 전 재공개·삭제 금지.
- 법정 재개 절차 적용: 일반 흐름 대신 승인된 법률 절차와 기한을 따른다.

## 5. 단계별 API 매핑

검색 [search](../api/search-posts.md), 숨김 [hide](../api/hide-post.md), 수정 [update](../api/update-post.md),
재공개 [republish](../api/republish-post.md), 제거 [remove](../api/remove-post.md). 이메일 송수신 API는 해당 없음.

## 6. 데이터·상태 전이

`PUBLISHED→HIDDEN_REVIEW→PUBLISHED|REMOVED`. 메일 본문·소명 자료는 application DB·log에 복사하지 않는다.

## 7. 권한·트랜잭션·멱등성·재시도

관리자 인증·key·version 필수. outbox는 최대 8회 후 DEAD 알림이며 자동으로 공개 상태를 되돌리지 않는다.

## 8. 완료 조건과 수용 기준

접수 직후 비노출과 최종 상태·회신이 확인되고 raw 요청이 application log/DB에 없어야 한다.

## 9. 미정·차단·미검증

`[출시 차단: 권리자 요청 수령인·이메일·시행일 입력 필요]`; 법률 검토와 실제 운영은 미검증이다.
