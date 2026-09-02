# 공개 게시글 탐색 개발 보강서

## 1. 문서 정보와 입력 근거

- 문서 상태: `초안`
- milestone: `M0 Core` (`m0-core`)
- 기능: `public-post-browsing` — 공개 게시판 목록·상세·공유·조회 수
- 기준일: 2026-09-02
- 미검증: Nuxt·BFF·Core source, migration, OpenAPI, test, runtime, 실제 CDN·공유 provider
- 주요 근거:
  - [서비스 기획 §1, §2, §5, §7, §10, §14](../../../planning/01-service-plan.md)
  - [화면 설계 §2, §5~§7, §13](../../../planning/03-screen-design.md)
  - [분석·광고 계획 §1~§4, §12](../../../planning/04-analytics-ad-plan.md)
  - [시스템 아키텍처 §4~§6](../../../system-design/01-system-architecture.md)
  - [데이터 모델 §3, §7~§9](../../../system-design/02-data-model.md)
  - [API 설계 §1~§3, §6~§9](../../../system-design/03-api-design.md)
  - [반응형 퍼블리싱 프로토타입](../../../publishing/responsive/README.md)

## 2. 목표와 대상 milestone

비로그인 이용자가 `/meme`의 최신 게시글을 페이지 단위로 탐색하고, 게시글 상세·같은 게시판의
하단 목록·공유 기능을 연속해서 이용하게 한다. 초기 게시판은 `meme` 한 개지만 공개 조회 계약은
활성 게시판 데이터와 `boardSlug`를 기준으로 확장 가능해야 한다.

## 3. 행위자와 진입 조건

- 행위자: 인증하지 않은 공개 이용자
- 진입: `/` 또는 `/meme`, 공유받은 `/:boardSlug/posts/:postId`
- 선행 조건: 활성 게시판과 공개 상태 게시글. 공개 조건은 `PUBLISHED`이고 `publishedAt <= now`다.
- `/`는 별도 페이지가 아니라 `/meme`으로 리다이렉트한다.

## 4. 범위와 범위 밖

범위:

- 활성 게시판 조회, `meme` 목록, 상세와 하단 목록 context
- 고정 공지 0~3건과 일반 글 20건 분리, 번호 페이지네이션
- 상세 최초 정상 표시 뒤 참고용 조회 수 1 증가
- 링크 복사·브라우저 공유·카카오톡·X 공유와 SSR canonical·OG
- loading·empty·error·404·공유 provider 부분 실패

범위 밖:

- M0 수집 보조·자동 수집, M1 회원, 사용자 작성, 광고 슬롯
- 이전 글·다음 글, 무한 스크롤, 게시판 문맥 없는 `/posts/:postId`
- 방문자 중복 제거, 자체 이용 이벤트 API·원시 이벤트 저장
- health endpoint는 공통 운영 계약이며 화면 기능 Spec 대상이 아니다.

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| `/`를 `/meme`으로 이동 | 확정 | 서비스 기획 §2 | D01 `browse-posts`, D08 `meme-list` | 반영 |
| 확장 가능한 게시판 구조와 `meme` 초기 데이터 | 확정 | 서비스 기획 §14, 데이터 모델 §3·§10 | `list-boards`, D01 `browse-posts`, migration contract test | 반영 |
| 공지 0~3건과 일반 글 20건 분리 | 확정 | 서비스 기획 §5 | `list-posts`, D08 `meme-list` | 반영 |
| 같은 게시판 상세와 하단 20건 | 확정 | 화면 설계 §6 | `get-post`, D01·D08 `view-post` | 반영 |
| 숨김·삭제·예약·초안을 같은 404로 처리 | 확정 | API 설계 §3 | `get-post`, D08 `post-detail` | 반영 |
| 정상 상세 표시 뒤 조회 수 1 증가, 실패는 비차단 | 확정 | 분석 계획 §3 | `increment-post-view`, D01 `view-post` | 반영 |
| 공유 popup/sheet와 provider fallback | 확정 | 화면 설계 §7 | D01 `share-post`, D08 `post-detail` | 반영 |
| 상세 SSR canonical·OG·Twitter metadata와 404 `noindex` | 확정 | 화면 설계 §7, 퍼블리싱 SSR 계약 | D01 `view-post`, D08 `post-detail`, SSR integration test | 반영 |
| payload 오류 code 이름 | 결정 필요 | API 설계 §3·§6 | `increment-post-view` | 상위 계약 불일치 |
| IMAGE 없는 상세의 OG fallback·description 생성 규칙 | 결정 필요 | 화면 설계 §7 | D08 `post-detail` | 상위 계약 누락 |
| 실제 서비스 도메인·카카오 CSP host/key | 결정 필요 | 서비스 기획 §13, 보안·운영 §4 | D08 `post-detail` | `(미정)` |
| 로그인·광고·수집 | 범위 밖 | 서비스 기획 §1 | 모든 산출물 | 제외 |

## 6. 업무 규칙과 수용 조건

- 일반 글은 `publishedAt DESC, postId DESC`; 공지는 `pinnedPosition ASC`다.
- page는 1부터 시작하고 page 1의 0건은 `200`, 전체 page를 넘으면 `404 PAGE_NOT_FOUND`다.
- 상세는 요청 게시판과 글 소속을 함께 검증하고 비공개 원인을 HTML·API에 노출하지 않는다.
- 상세 하단 페이지 이동은 본문과 스크롤 위치를 유지하고 목록만 교체한다.
- 카카오 script 실패는 카카오 항목만 숨기고 링크 복사와 다른 공유 수단을 유지한다.
- 360px·768px·1280px에서 가로 스크롤이 없고 키보드로 목록·공유·페이지 이동이 가능해야 한다.

## 7. 데이터·권한·법무 영향

- 읽기: `content.board`, `content.board_post`, `content.board_post_block`, `content.board_post_image`.
- 쓰기: 조회 수 endpoint만 `view_count`를 원자 증가하며 감사·lock version을 변경하지 않는다.
- 공개 API는 인증 없음. 관리자 identity나 내부 storage key·상태 이력은 반환하지 않는다.
- 출처 링크는 권리 확보를 뜻하지 않으며 source URL은 새 창에서 안전한 link 속성을 사용한다.

## 8. API 작업 목록

- [활성 게시판 조회](api/list-boards.md)
- [게시글 목록 조회](api/list-posts.md)
- [게시글 상세 조회](api/get-post.md)
- [게시글 조회 수 증가](api/increment-post-view.md)

## 9. D01 프로세스 목록

- [게시글 목록 탐색](d01/browse-posts.md)
- [게시글 상세 열람](d01/view-post.md)
- [게시글 공유](d01/share-post.md)

## 10. D08 화면·프로그램 목록

- [짤 목록](d08/meme-list.md)
- [게시글 상세](d08/post-detail.md)

## 11. 결정·가정·미정·차단 항목

- 결정 필요: 조회 수 endpoint의 payload 오류 code를 `VALIDATION_FAILED`로 통일할지 확정한다.
- 결정 필요: IMAGE가 없는 글의 OG fallback 자산과 description 생성 규칙을 확정한다.
- 미정: 실제 서비스 도메인, 확정 카피, 카카오 공유 CSP host와 공개 JavaScript key.
- 미검증: 정적 프로토타입은 혼합 단계 검토물이며 실제 SSR·API·접근성·공유 동작 증거가 아니다.
- 차단: 위 오류 code 불일치와 SSR metadata 미정값이 해결되기 전 이 번들은 `작성 완료`로 승격하지 않는다.
