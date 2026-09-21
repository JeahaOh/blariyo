# 유튜브 커뮤니티 수집 명세

- 명세 상태: 검토 전
- source key: `youtube-community`
- 작성일: 2026-09-21
- 최종 확인일: `(미정)`
- 확인 담당자: `(미정)`
- 활성 단계: 비활성
- parser version: `(미정)`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 유튜브 커뮤니티 |
| 운영 주체 | Google LLC / 채널 운영자 `(법적 사용 주체 확인 필요)` |
| 기준 URL | https://www.youtube.com/ |
| 허용 host | `www.youtube.com` `(채널 URL·redirect 확인 필요)` |
| 허용 path | `/@채널핸들/community` `(실제 URL 규칙 검증 필요)` |
| 제외 path | 로그인·비공개·멤버 전용·라이브 채팅 경로 `(미정)` |
| 수집 목적 | 공개 커뮤니티 게시물 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | https://www.youtube.com/static?template=terms |
| 이용약관 확인일 | `(미정)` |
| 수집 관련 조항 판단 | `(법무 검토 필요)` |
| `robots.txt` URL | https://www.youtube.com/robots.txt |
| `robots.txt` 확인일 | `(미정)` |
| User-Agent 적용 결과 | `(미정)` |
| 공개 API·RSS 제공 여부 | YouTube Data API·공개 페이지 여부 확인 필요 |
| 문의·중단 요청 채널 | `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | `(미정: 낮음 / 중간 / 높음)` |

확인 전에는 출처를 활성화하지 않는다.

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | `(미정)` | 공개 커뮤니티 게시물 단일 URL 검토 |
| 공식 공개 API·feed | `(미정)` | YouTube Data API 사용 조건·quota 확인 필요 |
| RSS·Atom | 사용하지 않음 | 공식 제공 여부 확인 전 |
| server-rendered HTML 목록 | `(미정)` | 커뮤니티 탭 구조·로그인 요구 확인 필요 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위에서 인증·차단 우회 금지 |

선택 parser type: `(미정: YOUTUBE_COMMUNITY / METADATA)`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 `(미정)` |
| 상세 URL pattern | `https://www.youtube.com/@{handle}/community/{postId}` 후보, 실제 확인 필요 |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 같은 YouTube host 내 redirect만 `(미정)` |
| 제거할 query parameter | `(미정)` |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | `(미정)` |
| 제목 | `(미정)` | `(미정)` | 후보 실패 |
| 본문 텍스트 | `(미정)` | `(미정)` | 후보 실패 |
| 본문 이미지 | `(미정)` | `(미정)` | 후보 실패 또는 운영자 보정 |
| YouTube 영상 링크 | 공식 watch/shorts URL을 LINK 블록으로 보존 `(미정)` | `(미정)` | 원문 링크만 보존 |
| 게시 시각 | `(미정)` | `(미정)` | `null` |

임베드 영상 자체를 내려받아 복제하지 않는다. 삭제·비공개·멤버 전용이면 원문 링크와 실패 사유만 남긴다.

## 6. 검증 fixture와 활성화 판정

- 정상 공개 커뮤니티 게시물 URL: `(미정)`
- 이미지 포함 게시물: `(미정)`
- 영상 링크 포함 게시물: `(미정)`
- 삭제·비공개·멤버 전용 게시물: `(미정)`
- 로그인 요구·구조 변경 fixture: `(미정)`
- 실제 URL·robots·약관·parser 테스트 전까지 활성화하지 않는다.
