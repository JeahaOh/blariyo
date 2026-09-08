# 문서 정합성 주 검수 결과

- 검토일: 2026-09-08
- 상태: 검토 완료·정본 수정 미실행
- 범위: 현행 기획·법무·기술·기능 명세와 정적 검토물. 구현·런타임·법적 적법성 심사는 제외.
- 방식: 하위 모델 3개가 독립 검토하고 주 에이전트가 상충 원문을 직접 읽어 채택·중요도를 재판정.
- 정본 수정: 없음. 수정은 별도 업무이며 이번 task는 현황 파악이다.

## 판정

큰 정책·아키텍처 방향은 일치하지만 일부 수용 조건은 정반대 정책을 요구한다. 현행 정본과 예전
요약·수용 문구·정적 화면 사이의 동기화가 부족하다. 기준선 확정 전에 High 항목부터 보완해야 한다.
문서 수·링크 통과율을 의미 정합성 퍼센트로 환산하지 않는다.

확정 발견 **12건: High 2 / Medium 6 / Low 4**, 추가 확인 2건이다. 구조 문제의 표 파손 10행은 원인 1건으로 묶었다. Critical은 확인되지 않았다.

## 채택한 발견

| ID | 중요도 | 문제·직접 확인 근거 | 영향·최소 조치 |
| --- | --- | --- | --- |
| D01 | High | `docs/planning/03-screen-design.md:466` 탈퇴 후 원문 비노출 ↔ 같은 파일 467 및 `docs/system-design/06-member-community-design.md:185-195` 콘텐츠 KEEP | 탈퇴 공개 콘텐츠를 숨기는 잘못된 수용 테스트로 이어짐. 숨김/삭제와 탈퇴 연결 제거를 분리 |
| D02 | High | `docs/planning/03-screen-design.md:458`, `docs/legal/privacy-policy.md:116` 개인정보처리방침 동의 ↔ `docs/system-design/06-member-community-design.md:130-135` TERMS+SIGNUP_PRIVACY | 잘못된 정책 ID·동의 이력을 검증할 위험. 필수 가입 동의 명칭을 통일 |
| D03 | Medium | `docs/planning/01-service-plan.md:374-378` 연령 방식 미정 ↔ `docs/planning/08-member-community-plan.md:17-32` 직접 입력·14세 미만 금지 확정 | 제품 결정과 법무 검토 잔여를 분리. 법무 placeholder는 삭제하지 않고 범위를 정정 |
| D04 | Medium | `docs/planning/03-screen-design.md:378-381` 글쓴이 또는 이름 ↔ `docs/system-design/06-member-community-design.md:623-624` 이름+별도 배지 | 이름 대신 글쓴이만 표시할 수 있음. 화면에 authorLabel과 배지 병기 |
| D05 | Medium | `docs/planning/content-collection/README.md:267-273` 초기 /collect status ↔ 기능 명세 `collection-assist.dev.md:1010` /collect url만 처리 | 상태 명령 누락 위험. 제품 포함 여부와 기술 상세 미정을 분리 |
| D06 | Medium | 수집 기능 명세 `collection-assist.dev.md:349-358,628-638` metadata+preview 제출 ↔ 같은 파일 239-257의 result 응답 후 preview 순차 업로드 | candidateImageId·새 lockVersion 없이 호출할 위험. 업무 흐름을 API 순서대로 분리 |
| D07 | Low | 수집 기획 `README.md:294-296` 및 기능 명세 174 확인 interaction 필수 ↔ 명세 628-636,967 이벤트 요약에 확인 누락 | 요약만 따라 구현할 때 확인 생략 위험. 기존 필수 확인 단계 참조 추가 |
| D08 | Low | `docs/system-design/02-data-model.md:958` Core API만 변경 ↔ API 설계 787-798 기존 API 유지 | 문언이 호출자 전환을 API 변경으로 오해시킴. Core만 서비스 데이터를 변경한다는 뜻으로 정정 |
| D09 | Low | `docs/system-design/03-api-design.md:643-646` 후속 npm 수집 command ↔ 아키텍처 73-80,306-310 실행 주체 후속 결정 | 현재 수집 보조를 막지는 않음. 후속 실행 기술을 미정으로 일치 |
| D10 | Medium | `docs/publishing/responsive/app.js:349-350` 이메일·닉네임·사진 처리 ↔ `docs/legal/signup-privacy-consent.md:19-28` 추가 요청 없음 | 정적 검토 화면이 이전 정책을 표시. 실제 개인정보 수집이나 법 위반으로 판단한 것은 아님 |
| D11 | Low | `docs/wireframes/community/index.html:71,91,114-119` 댓글·신고·수정/삭제 등 미정 ↔ 현행 `docs/planning/08-member-community-plan.md:64-96` | 참고안의 현행 상태 표시가 오래됨. 역사 참고물 표시와 현행 정본 링크 또는 갱신 필요 |
| D12 | Medium | API·기술 표 셀 내부의 미이스케이프 `파이프`가 열 경계를 깨뜨림. 구조 보고서의 최종 행 목록 참조 | null·enum 계약이 잘못 표시될 수 있음. 코드 표기 안을 포함해 셀 내부 파이프 escape 후 재검사 |

표의 수집 기능 명세 경로는 `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md`,
수집 기획 README는 `docs/planning/content-collection/README.md`다.

## 보류·오탐 제외

- VM 이전 절차의 수집 cron 호스트와 Spring 로컬 Quartz 구분: 운영 절차 명확화 필요지만 원격 collector까지 중단한다는 뜻일 수 있어 확정 오류에서 제외.
- 알림 실패 제품 동작과 기술 미정의 범위: 구현 수치·저장소만 미정일 수 있어 확인 필요 항목으로 별도 유지.
- 로컬 임시 이미지, 24시간 private preview, 초안 승격의 영구 원본은 다른 단계이므로 저장 정책 충돌로 세지 않음.
- 의도된 Spring DB·Job/Step·포트·버전 미정, 법무 gate, 실제 구현 부재는 문서 오류 개수에 포함하지 않음.
- 정적 프로토타입의 M0/M1 혼합은 README에 명시됨. 미구현 UI 자체를 구현 실패로 보지 않음.
- D10은 하위 검토의 High 후보에서 Medium으로 조정. 운영 제품이 아닌 정적 검토물의 정책 drift임.

## 세부 보고서

- [정책 검토](policy-review.md)
- [수집 계약 검토](collector-review.md)
- [구조·화면 검토](structure-review.md)

## 주 에이전트 직접 검수·검증

- 하위 결과의 상충 원문을 직접 대조해 D01–D12를 채택했다. 단순 미정과 구현 부재는 개수에서 제외했다.
- D01 탈퇴 후 원문 비노출은 주 검수에서 추가 발견해 정책 에이전트에 재확인을 요청했고 보고서에 반영했다.
- 구조 검사기의 inline code 파이프 제외 규칙을 주 검수에서 발견해 GFM 기준 수정·재검사를 요청했다.
  최종 스크립트를 직접 재실행해 표 오류 10행을 확인했다. 이 중 API 설계 512행과 회원 확장 9행 원문을 대조했다.
- 기계 검사: 정본 Markdown 71개·상대 링크 660개·표 342개. 끊긴 파일/Markdown 앵커·미닫힘 fence 0건,
  표 열 불일치 10행. 외부 URL·HTML 링크·브라우저 렌더링은 이 검사 범위 밖이다.
- `git diff --check` 통과. 시작 시 스냅샷과 비교한 기존 docs 97개 해시 동일.
- task 폴더에만 task·하위 보고서·최종 보고·재현 도구를 생성했다. 정본·코드 구현·commit·push 없음.

## 권장 수정 순서

1. D01–D02: 탈퇴와 가입 동의의 잘못된 수용 조건부터 정정.
2. D03–D06·D12: 연령·이름 표시·Discord 명령·preview 순서·API 표를 일괄 동기화.
3. D07–D11: 요약 문구와 정적 검토물의 현행 기준 표시 정리.
4. 추가 확인 2건의 범위를 결정하고 같은 검사를 다시 수행한 뒤 기준선 확정 검토.
