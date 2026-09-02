# 게시글 공유 D01

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-02
- 입력 근거: [화면 설계 §7](../../../../planning/03-screen-design.md), [보안·운영 §4](../../../../system-design/05-security-operations.md)
- 미검증: 실제 domain, 카카오 설정, browser·provider runtime

## 1. 목적과 범위

상세 canonical URL을 링크 복사, 기기 공유, 카카오톡 또는 X로 공유한다.

## 2. 행위자·시작·선행 조건

공개 상세를 정상 표시한 이용자가 헤더의 `공유하기` 버튼을 누른다.

## 3. 정상 흐름

1. 데스크톱은 버튼 아래 popup, 모바일은 하단 share sheet를 연다.
2. 선택한 방식에 상세 `shareUrl`과 공개 제목을 전달한다.
3. 성공·취소·실패 결과를 `aria-live` 영역에 알린다.
4. 닫기·바깥 클릭·Escape 후 포커스를 공유 버튼으로 돌린다.

## 4. 대안·실패 흐름

- `navigator.share` 미지원이면 해당 항목을 숨기거나 다른 방식을 유지한다.
- 카카오 script/CSP 설정 실패면 카카오 항목만 숨기고 링크 복사는 항상 유지한다.
- clipboard 실패면 선택 가능한 URL과 실패 안내를 제공한다.

## 5. API 매핑

API 해당 없음. 브라우저 공유 기능과 외부 공유 provider를 사용하며 BFF·Core에 공유 API를 만들지 않는다.

## 6. 데이터·상태 전이

Blariyo DB 상태 전이 없음. GA4가 활성이고 분석 동의가 있을 때만 `share` 이벤트를 브라우저에서 보낸다.

## 7. 권한·트랜잭션·멱등성·재시도

인증·transaction 해당 없음. 사용자의 명시적 재선택 없이 자동 재시도하지 않는다.

## 8. 완료 조건과 수용 기준

카카오 실패 환경에서도 popup과 링크 복사가 동작하고 키보드로 열고 닫을 수 있어야 한다.

## 9. 미정·차단·미검증

카카오 CSP host·공개 JavaScript key·실제 도메인은 `(미정)`이며 카카오 활성화만 차단한다.
