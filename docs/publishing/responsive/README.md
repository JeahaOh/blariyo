# Blariyo responsive publishing prototype

- 목적: 와이어프레임 이후 실제 화면 밀도, 여백, 반응형 동작을 확인하는 정적 퍼블 파일
- 기준: 데스크톱·모바일 웹만 검토
- 실행: `index.html`을 브라우저에서 직접 열어 확인
- 한계: 정적 단일 HTML은 홈 metadata만 표현하며 게시글별 OG 검증물이 아니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 홈, 상세, 로딩·빈 목록·오류·숨김 상태 markup |
| `styles.css` | 반응형 layout, 44px 터치 대상, 목록·공유·광고·상태 스타일 |
| `app.js` | 화면 tab, 공유 메뉴, 20개 목록과 현재 글 비활성 샘플 동작 |

## 현재 반영 기준

- 게시판 메뉴는 `유머`, `이야기` 2개뿐이며 `/`는 메뉴를 추가하지 않는 두 게시판 혼합 최신 목록
- 홈 목록은 페이지당 게시글 20개이며 광고 행은 개수에서 제외
- 상세 하단 목록은 같은 게시판의 현재 글 주변 게시글 20개이며 광고 행은 개수에서 제외
- 현재 글 행은 `aria-current`로 강조하고 링크와 tab stop을 만들지 않음
- 상세 출처는 본문 하단에 1회만 표시
- 상세 광고는 본문·출처 다음, 하단 목록 중간, 목록 아래의 3개만 사용
- 이전글/다음글 별도 버튼 없음
- 모바일은 `번호 / 제목 / 시간` 중심으로 단순화
- 공유 메뉴는 링크 복사·카카오톡·X·브라우저 공유를 제공하고 `Escape`와 바깥 클릭으로 닫힘
- 푸터는 `/terms`, `/privacy`, `/rights`, `/cookie-settings` 실제 route를 사용
- 화면 선택 tab은 방향키·Home·End를 지원하고 모든 주요 터치 대상은 최소 44px

## 정적 OG 한계와 SSR 계약

이 프로토타입은 `#home`, `#detail`처럼 한 HTML 안에서 검토 화면만 바꾼다. `<head>`에는 홈 canonical과 기본 OG만 있으므로 JavaScript 전환 결과를 SNS crawler의 게시글 미리보기 계약으로 사용하면 안 된다.

실제 서비스의 `GET /posts/:postNo`는 첫 서버 응답 HTML에 아래 값을 게시글별로 렌더링한다.

- `<title>`, description, canonical `/posts/:postNo`
- `og:type=article`, `og:title`, `og:description`, `og:url`
- absolute HTTPS `og:image`, `og:image:alt`, image width·height
- `twitter:card=summary_large_image`, title, description, image, image alt

공개 게시글은 HTTP `200`을 반환한다. 없거나 숨김 처리된 게시글은 HTTP `404`, `noindex`를 반환하고 제목·본문·이미지·내부 권리 상태를 HTML에 넣지 않는다. `/`, `/boards/humor`, `/boards/talk`, `/terms`, `/privacy`, `/rights`, `/cookie-settings`도 route별 canonical을 가진 서버 응답 HTML을 제공한다.
