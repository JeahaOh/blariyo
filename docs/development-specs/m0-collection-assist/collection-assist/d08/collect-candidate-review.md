# 수집 후보 검수 화면 D08

## 1. 화면·프로그램 목적, route와 milestone

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- route: `/admin/collect`, 로컬 collector의 Discord `/collect url`
- 기준일: 2026-09-04
- 입력 근거: [화면 설계 §2 수집 후보 검수 화면](../../../../planning/03-screen-design.md), [수집 보조 개발 보강서](../collection-assist.dev.md)
- 미검증: source, browser, 접근성, 실제 image preview

운영자가 관리자 화면 또는 로컬 collector의 Discord `/collect url`로 후보를 만들고, 생성된 후보를 관리자 화면에서
검수·반려·초안 승격한다.

## 2. 진입·이탈·권한 조건

- 외부 관리자 인증 allowlist 통과 필요.
- 공개 경로에서 접근할 수 없다.
- Discord 명령은 로컬 collector가 허용 guild·channel·user만 처리하고 일반 메시지 감시는 하지 않는다.
- 초안 승격 성공 시 관리자 게시글 편집기로 이동한다.

## 3. UI 영역과 구성요소

- 원문 URL 입력란과 `후보 만들기`
- Discord `/collect url`로 생성된 후보의 상태 표시
- 후보 목록: 출처명, 제목, 원문 링크, 이미지 후보 수, 수집 시각, 상태, 중복 표시
- 후보 상세: 제목 편집, 원문 링크, 로컬 collector preview 또는 원격 URL metadata를 통한 이미지 후보 확인, 선택 checkbox, 실패·경고 요약
- 작업 버튼: `재시도`, `반려`, `초안으로 승격`
- 중복 확인 영역: 기존 게시글 링크와 확인 checkbox

## 4. 필드·표시값·validation

- URL은 `https` 형식만 client 1차 검증한다. 최종 검증은 서버가 한다.
- 반려 사유는 허용 code 중 하나를 선택한다.
- 이미지 선택은 1~20개다.
- 후보 제목이 없으면 승격 전 제목 입력을 요구한다.
- 내부 stack, 원문 HTML 전체, Python 임시 파일 내부 경로, storage key는 표시하지 않는다.

## 5. 이벤트·버튼·이동·후처리

| 이벤트 | 처리 |
| --- | --- |
| 후보 만들기 | 관리자 화면은 후보 작업 접수, 로컬 collector는 Discord 명령 처리와 결과 제출 |
| 재시도 | `retry-candidate` 호출 |
| 반려 | 사유 선택 후 `reject-candidate` 호출 |
| 초안으로 승격 | 중복 확인·선택 이미지 검증 후 `promote-candidate-to-draft` 호출 |
| 원문 열기 | 새 창, `rel="noopener noreferrer"` |

## 6. loading·empty·error·권한 없음·부분 실패 상태

- loading: 후보 만들기와 승격 중 버튼 중복 클릭을 막는다.
- empty: 아직 후보가 없으면 URL 입력을 주요 행동으로 둔다.
- error: 서버 error code에 맞춰 일반화된 메시지를 표시한다.
- 권한 없음: 관리자 인증 화면 또는 접근 불가 상태로 보낸다.
- 부분 실패: 이미지 후보 일부 누락은 경고로 표시하되 승격 가능 여부는 선택 이미지 기준으로 판단한다.
- 임시 preview 만료: preview 재생성 또는 승격 시 원격 재fetch가 필요하다는 메시지를 표시한다.

## 7. 반응형과 접근성

- 360px 이상에서 가로 스크롤 없이 목록과 상세를 사용할 수 있어야 한다.
- 이미지 선택 checkbox는 키보드 조작 가능해야 한다.
- 작업 버튼은 상태별로 disabled reason을 screen reader가 알 수 있어야 한다.
- 외부 원문 링크는 새 창 열림을 접근성 이름에 포함한다.

## 8. 이벤트별 D01·API 매핑

| UI 이벤트 | D01 | API |
| --- | --- | --- |
| 후보 만들기 또는 Discord `/collect url` | [URL 후보 생성과 검수](../d01/create-and-review-candidate.md) | [create-candidate-from-url](../api/create-candidate-from-url.md), [collector-internal-api](../api/collector-internal-api.md) |
| 재시도 | [후보 재시도와 반려](../d01/retry-or-reject-candidate.md) | [retry-candidate](../api/retry-candidate.md) |
| 반려 | [후보 재시도와 반려](../d01/retry-or-reject-candidate.md) | [reject-candidate](../api/reject-candidate.md) |
| 초안으로 승격 | [후보 초안 승격](../d01/promote-candidate-to-draft.md) | [promote-candidate-to-draft](../api/promote-candidate-to-draft.md) |

## 9. 메시지와 사용자 피드백

- 허용되지 않은 출처입니다.
- 이 경로는 수집할 수 없습니다.
- 잠시 후 다시 시도해 주세요.
- 같은 원문 후보가 이미 있습니다.
- 후보를 반려했습니다.
- 초안으로 만들었습니다.

## 10. 화면 수용 조건

- 후보 생성은 후보 또는 명시적 실패 상태로 끝난다.
- 실패 후보는 재시도 또는 반려만 가능하다.
- 승격 성공 뒤 자동 발행하지 않고 편집기로 이동한다.
- 원문 HTML 전체와 내부 오류 상세를 화면에 노출하지 않는다.
- Python 임시 파일 내부 경로와 image binary를 화면에 노출하지 않는다.

## 11. 미정·차단·미검증 항목

- 결정 필요: 출처 관리 화면/API 세부 계약
- 차단: 출처별 source spec의 운영 위험·기술 gate 확인 전 production 활성화 불가
- 미검증: source, browser, 접근성, 실제 image preview
