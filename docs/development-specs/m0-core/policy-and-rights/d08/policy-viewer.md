# 정책 Viewer D08

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-02
- 입력 근거: [화면 설계 §10](../../../../planning/03-screen-design.md), [퍼블리싱 기준](../../../../publishing/responsive/README.md)
- 미검증: 승인 본문, actual browser·accessibility test

## 1. 목적·route·milestone

`/terms`, `/privacy` 직접 화면과 어느 공개 화면에서나 여는 modal로 정책 전문·이력을 제공한다.

## 2. 진입·이탈·권한 조건

인증 없음. modal 닫기·Escape·dim 클릭으로 원래 포커스와 스크롤에 복귀한다. 직접 route는 browser 뒤로가기·footer 이동을 제공한다.

## 3. UI 영역과 구성요소

제목, 현재/선택 version 상태, 전문, 하단 `버전 / 적용 기간` 행 목록, 닫기와 오류 상태다.

## 4. 필드·표시값·validation

현재는 `yyyy.mm.dd ~ 시행 중`, 과거는 `yyyy.mm.dd ~ yyyy.mm.dd`. 허용 HTML만 렌더링하며 외부 link는 안전 속성을 사용한다.

## 5. 이벤트·버튼·이동·후처리

footer click은 modal, 직접 URL은 page. 이력 행 전체 선택은 해당 version 전문으로 바꾸고 문서 상단으로 이동한다.

## 6. 화면 상태

loading, current 없음/error, 과거 version 없음, empty history를 구분한다. 권한 없음은 해당 없음.

## 7. 반응형과 접근성

`role=dialog`, `aria-modal`, focus trap/return, background `inert`, scroll lock, heading 구조와 keyboard row selection을 적용한다.

## 8. 이벤트별 D01·API 매핑

열기·version 전환은 [정책 열람](../d01/view-policy.md)과 [정책 조회](../api/get-policy.md)에 연결한다.

## 9. 메시지와 사용자 피드백

내부 DB·sanitize 오류를 노출하지 않는다. 법무 placeholder가 남은 문서를 production current로 표시하지 않는다.

## 10. 화면 수용 조건

modal/direct route의 version·전문이 같고 focus·scroll·history 전환이 동작해야 한다.

## 11. 미정·차단·미검증

법무 승인·시행일·사업자 실값이 없어 production은 차단된다.
