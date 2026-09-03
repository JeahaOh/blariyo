# 관리자 게시글 편집기 D08

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-03
- 입력 근거: [화면 설계 §2 관리자 게시글 화면](../../../../planning/03-screen-design.md), [관리 API](../admin-post-management.dev.md)
- 미검증: publishing 산출물 없음, 실제 UI·browser·accessibility test

## 1. 목적·route·milestone

`/admin`에서 게시글 검색 목록과 같은 편집기로 새 글·기존 글의 콘텐츠와 상태를 관리한다.

## 2. 진입·이탈·권한 조건

외부 관리자 인증·allowlist 필수. 미인증은 provider 로그인, 불허는 접근 거부. 저장하지 않은 변경이
있으면 이동·선택·상태 명령 전에 경고한다. 관리자 화면은 검색 노출·CDN cache 금지다.

## 3. UI 영역과 구성요소

- 검색: 상태, 게시판, 제목 prefix, 수정일, page
- 결과: 제목·상태·게시판·수정일·lockVersion
- 편집: 제목, source pair, TEXT/IMAGE block 추가·제거·순서, alt, 공지 위치
- 이미지: upload, 인증 preview, 미사용 폐기
- 상태 action: 저장, 즉시 발행, 예약, 예약 취소, 숨김, 재공개, 최종 제거
- 예약: `07:30`, `17:30` KST(`Asia/Seoul`) 기본 슬롯과 게시글별 임의 미래 시각 입력
- desktop 좌측 목록/우측 편집; mobile 상하 배치

## 4. 필드·표시값·validation

제목 1~200, block 1~40, IMAGE 최대 20, TEXT 1~20000, alt 1~300, source는 name·HTTPS URL pair,
image file 10MiB·요청 10개/100MiB. 오류는 field 가까이에 표시한다.

## 5. 이벤트·버튼·이동·후처리

- 검색·글 선택: 목록/상세 API.
- 이미지 선택: upload 요청 전체가 성공한 뒤에만 모든 preview를 표시한다. 하나라도 실패하면 성공한
  파일도 표시하지 않는다. 파일 개수·전체 합계 gate의 `413`은 `fields` 없이 요청 단위 제한으로
  안내한다. gate 통과 뒤 파일별 `413`·`415` validation 응답은 `fields[]`의 모든 실패 index와 일반화
  reason을 해당 파일 가까이에 표시한다. 크기·형식이 섞인 `413`에서도 형식 오류 파일을 빠뜨리지 않는다.
  R2·DB `503`은 특정 파일 오류로 표시하지 않고 요청 단위 장애와 전체 재시도를 안내한다. 제거는 block과
  asset 상태를 구분한다.
- 저장: 새 글 create, 기존 글 patch 후 version 갱신.
- 상태 action: 저장되지 않은 변경이 없고 현재 상태에 허용된 버튼만 활성.
- 예약: 기본 슬롯을 바로 선택하거나 offset이 포함된 임의 미래 시각을 입력한다. 기본 슬롯 외 시각도
  허용하며 API 응답의 UTC 정규화 시각을 현재 예약 상태에 반영한다.
- 최종 제거: `REMOVED`가 되돌릴 수 없음을 명시한 확인창 후 실행.

## 6. 화면 상태

- loading: 검색/편집/image 영역별 표시.
- empty: 검색 결과 없음 또는 새 초안 안내.
- error: field validation, version conflict, dependency 장애를 구분해 복구 동작 제공.
- 권한 없음: 콘텐츠·관리자 identity 상세 없이 접근 거부.
- 부분 실패: public image 삭제 중에는 재공개·최종 제거·해당 block 교체 비활성, 새로고침 안내.

## 7. 반응형과 접근성

label·오류 연결, block 순서 키보드 조작 대안, dialog focus trap/return, 상태를 색만으로 구분하지 않기,
44px touch target을 적용한다.

## 8. 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| 검색·선택 | 공통 편집 진입 | [search](../api/search-posts.md), [detail](../api/get-post-editor.md) |
| upload·폐기 | [초안 발행](../d01/draft-and-publish-post.md) | [upload](../api/upload-images.md), [preview](../api/preview-image.md), [discard](../api/discard-image.md) |
| 저장·발행 | [초안 발행](../d01/draft-and-publish-post.md) | [create](../api/create-post.md), [update](../api/update-post.md), [publish](../api/publish-post.md) |
| 예약·취소 | [예약 관리](../d01/schedule-post.md) | [publish](../api/publish-post.md), [unschedule](../api/unschedule-post.md) |
| 숨김·재공개·제거 | [권리 처리](../d01/handle-rights-request.md) | [hide](../api/hide-post.md), [republish](../api/republish-post.md), [remove](../api/remove-post.md) |

## 9. 메시지와 사용자 피드백

충돌 문구는 `(미정)`이지만 최신 내용을 재조회한 뒤 운영자가 병합해야 한다는 행동을 안내한다.
내부 provider·SQL·object key·메일 내용은 표시하지 않는다.

## 10. 화면 수용 조건

상태별 허용 action, dirty guard, version conflict 복구, image 대기 제한, 최종 제거 확인과 desktop/mobile
배치가 planning 계약과 일치해야 한다.

## 11. 미정·차단·미검증

upload 실패 UX는 all-or-nothing, 요청 단위 gate `413`의 `fields` 없음, 파일별 `413`·`415`의 모든
실패 파일 표시, `503`의 파일 표시 없음으로 확정됐다. 관리자 화면 publishing과 실제 UI·browser 증거가
없어 `초안`이다.
