# 게시글 상세 D08

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-03
- 입력 근거: [화면 설계 §4·§6·§7·§13](../../../../planning/03-screen-design.md), [퍼블리싱 기준](../../../../publishing/responsive/README.md)
- 미검증: SSR metadata, browser sharing, viewport·accessibility test

## 1. 목적·route·milestone

`/:boardSlug/posts/:postId`에서 글과 같은 게시판의 탐색 맥락을 제공한다. 초기 route는
`/meme/posts/:postId`다.

## 2. 진입·이탈·권한

인증 없음. 뒤로가기는 현재 게시판 목록으로 이동한다. 미존재·숨김·소속 불일치는 동일 404다.

## 3. UI 영역과 구성요소

고정 헤더(`목록으로`·한 줄 제목·`공유하기`), 전체 제목·메타, TEXT/IMAGE 본문, 출처 링크,
같은 게시판 하단 목록과 pagination, 브랜드 문구 `블라블라블라`와 정책 footer 순서다. footer에는
`권리 문의` mailto와 항상 접근 가능한 `이메일 주소 복사`를 함께 둔다. M0에서는 광고·로그인 진입을
렌더링하지 않는다.

## 4. 필드·표시값·validation

- IMAGE는 비율 공간, alt, 공개 media URL을 사용한다.
- 출처는 본문 뒤 1회, name 전체가 HTTPS link이며 없으면 영역을 생략한다.
- 현재 하단 행은 `aria-current="true"`, link와 tab stop이 없다.
- 정상 상세의 SSR 첫 HTML은 다음 metadata를 게시글별로 넣는다.
  - `<title>`과 `og:title`, `twitter:title`: 공개 게시글 제목을 사용한다.
  - `description`, `og:description`, `twitter:description`: 첫 공개 TEXT block plain text의 앞뒤
    Unicode whitespace를 제거하고 내부의 하나 이상 연속된 Unicode whitespace를 단일 U+0020 space로
    치환한 뒤 grapheme 수를 센다. 이 결과를 세 값에 동일하게 사용한다. 120자 이하는 80자 미만이어도
    padding 없이 그대로 사용한다. 120자를 초과하면 Unicode grapheme cluster 기준 앞 119자 뒤에 단일
    `…`를 붙여 총 120자 이하로 만들며, UTF-16 code unit이나 byte 기준으로 자르지 않는다. 공개 TEXT
    block이 없으면 `NUXT_PUBLIC_HOME_OG_DESCRIPTION`의 `블라리요에서 블라블라블라`를 사용한다.
  - `canonical`, `og:url`: 상세 `shareUrl`과 같은 절대 URL.
  - `og:site_name`: `NUXT_PUBLIC_SITE_NAME`의 `블라리요`; `og:type=article`.
  - `og:image`, `twitter:image`: 첫 공개 IMAGE block의 절대 HTTPS URL. 공개 IMAGE block이 없으면
    `SERVICE_PUBLIC_BASE_URL`과 `/og/blariyo-default.png`를 결합한
    `https://blariyo.com/og/blariyo-default.png`를 사용한다.
  - `og:image:alt`, `og:image:width`, `og:image:height`, `twitter:image:alt`: 첫 공개 IMAGE block이
    있을 때 같은 block의 alt·width·height를 사용한다. fallback인 경우 게시글 IMAGE block의 값을
    임의로 만들지 않는다.
  - `twitter:card=summary_large_image`.

## 5. 이벤트·이동·후처리

- 정상 표시: 조회 수 API를 lifecycle당 한 번 호출하되 화면은 기다리지 않는다.
- 공유: popup/sheet를 열고 선택 방식 실행.
- 하단 page: 본문·스크롤 유지, 목록 영역만 교체.
- 하단 글: 새 상세 route로 이동.

## 6. 화면 상태

- loading·error: `← / 상태 제목`, 공유와 게시판 menu 숨김.
- 404: `noindex`를 넣고 내용·제목·이미지·출처·내부 사유 없이 `볼 수 없는 게시글입니다`와 목록 link.
- 하단 목록 부분 실패: 본문 유지, 해당 영역 재시도.
- 공유 provider 실패: popup 유지, 방식별 피드백과 다른 방식 제공.
- 카카오톡 공유: Kakao JavaScript SDK를 사용하되 실제 key·Web domain 등록·SDK URL·SRI·CSP host
  확인 전에는 항목을 숨긴다. 링크 복사와 브라우저 기본 공유는 계속 제공한다.
- 권한 없음: 공개 화면이므로 해당 없음.

## 7. 반응형과 접근성

데스크톱 공유는 header 아래 floating panel, 모바일은 bottom sheet다. Escape·바깥 클릭·닫기와
focus return을 지원한다. 이미지 alt, 44px target, 360px 이상 무가로스크롤을 검증한다.

## 8. 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| 최초 표시 | [상세 열람](../d01/view-post.md) | [상세 조회](../api/get-post.md) |
| 조회 수 | [상세 열람](../d01/view-post.md) | [조회 수 증가](../api/increment-post-view.md) |
| 하단 page | [상세 열람](../d01/view-post.md) | [목록 조회](../api/list-posts.md) |
| 공유 | [게시글 공유](../d01/share-post.md) | API 해당 없음 |

## 9. 메시지와 사용자 피드백

공유 성공·실패는 `aria-live`로 알린다. 숨김 여부나 내부 사유를 메시지로 구분하지 않는다.

## 10. 화면 수용 조건

출처 1회, 하단 현재 글 포함 최대 20건, page 이동 시 본문 유지, 카카오 비활성·실패 시 링크 복사와 기본 공유 유지,
404 콘텐츠 비노출·`noindex`, metadata별 값 출처·canonical·공유 URL 일치를 만족해야 한다. IMAGE가 있는
정상 상세는 절대 HTTPS OG 이미지와 alt·크기를 첫 HTML에 포함하고, IMAGE가 없으면 확정 fallback
이미지를 사용한다. TEXT 유무에 따른 description 우선순위도 첫 HTML에 반영한다.
권리 이메일 복사는 제목·본문 없이 `BLARIYO_RIGHTS_CONTACT_EMAIL` 주소만 clipboard로 전달하며,
mailto 실행 결과와 무관하게 항상 사용할 수 있어야 한다.

## 11. 미정·차단·미검증

서비스 도메인, 상세 metadata fallback과 카피 계약은 확정됐다. Kakao SDK script URL·SRI integrity,
JavaScript key, CSP host의 실제 값과 개발자 콘솔 Web domain 등록은 미검증이다. 이를 확인하기 전에는
카카오톡 공유 항목 활성화를 차단한다. SSR·browser runtime과 접근성 검증은 별도 구현 증거가 필요하다.
