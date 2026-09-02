# 짤 목록 D08

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-02
- 입력 근거: [화면 설계 §2·§5·§13](../../../../planning/03-screen-design.md), [퍼블리싱 기준](../../../../publishing/responsive/README.md)
- 미검증: 실제 Nuxt 화면, browser visual·accessibility test

## 1. 목적·route·milestone

최신 공개 짤을 빠르게 탐색하는 `/meme` 화면이다. `/`는 `/meme`으로 리다이렉트한다.

## 2. 진입·이탈·권한

인증 없이 진입한다. 글 행은 `/meme/posts/:postId`, 로고는 `/meme`으로 이동한다. M1 메뉴는 노출하지 않는다.

## 3. UI 영역과 구성요소

헤더, 제목 `짤`, 공지 0~3건, 일반 글 최대 20건, page navigation, 정책·권리 footer 순서다.

## 4. 필드·표시값·validation

| 표시 | 데스크톱 | 모바일 | 규칙 |
| --- | --- | --- | --- |
| 번호 | 표시 | 표시 | 공지는 `공지` badge |
| 제목 | 한 줄 | 1~2줄 | 행 전체 상세 link |
| 조회 수 | 표시 | 필요 시 숨김 | 참고값 |
| 작성자 | `운영자` | 숨김 가능 | M0 고정 표시 |
| 시각 | 표시 | 표시 | locale formatting |

page는 1 이상만 허용한다.

## 5. 이벤트·이동·후처리

- page 선택: 목록 API 재조회, URL page query 동기화, 목록 heading으로 초점 이동.
- 글 선택: 상세 route 이동.
- `다시 시도`: 현재 page 재조회.

## 6. 화면 상태

- loading: 행 skeleton과 `aria-busy`.
- empty: `아직 올라온 짤이 없습니다`.
- error: 일반 오류와 `다시 시도`.
- 마지막 page: 다음 비활성.
- 권한 없음: 공개 화면이므로 해당 없음.
- 부분 실패: 게시판 메뉴 실패 시 초기 `/meme` 목록 자체를 우선 유지할 수 있으나 실제 fallback은 미검증.

## 7. 반응형과 접근성

360·768·1280px에서 가로 스크롤이 없어야 한다. 터치 대상 44px 이상, 현재 page에
`aria-current="page"`, 공지 badge는 텍스트로 구분한다.

## 8. 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| 최초·page 조회 | [목록 탐색](../d01/browse-posts.md) | [목록 조회](../api/list-posts.md) |
| 상세 이동 | [상세 열람](../d01/view-post.md) | 상세 route SSR |

## 9. 메시지와 피드백

empty·error 문구는 화면 설계를 사용한다. 미확정 마케팅 카피는 확정값처럼 넣지 않는다.

## 10. 화면 수용 조건

공지와 일반 글 수·정렬·page가 분리되고 M1 로그인·후속 광고·미활성 게시판이 렌더링되지 않는다.

## 11. 미정·차단·미검증

정적 prototype은 혼합 단계이므로 로그인·광고 요소는 M0 구현 근거가 아니다. 실제 화면은 미검증이다.
