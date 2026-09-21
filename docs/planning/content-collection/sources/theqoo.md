# 더쿠 수집 명세

- 명세 상태: 정책 확인 후 비활성
- source key: `theqoo`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-03
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `(미정)`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 더쿠 |
| 운영 주체 | 주식회사 더쿠 |
| 기준 URL | https://theqoo.net/ |
| 허용 host | `(미정)` |
| 허용 path | 없음 |
| 제외 path | 전체 경로 |
| 수집 목적 | 커뮤니티 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | https://theqoo.net/service |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 회원 게시물 저작권은 작성자에게 귀속. 회사는 서비스 운영·전시·전송·배포·홍보 및 제휴 제공 범위에서 이용 가능. 회사가 그 외 방법으로 이용하려면 사전 동의 필요. |
| `robots.txt` URL | https://theqoo.net/robots.txt |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `/robots.txt` 요청이 사이트 404 HTML을 반환했고 명시 robots 규칙을 확인하지 못함. robots 미확인 상태로 판정. |
| 공개 API·RSS 제공 여부 | 공개 RSS 링크 미확인 |
| 문의·중단 요청 채널 | https://theqoo.net/contact, `admin@theqoo.net` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 중간 |

확인 결과가 불명확하거나 기술 gate를 통과하지 못하면 `활성 단계`를 `비활성`으로 유지한다.

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | robots 규칙과 외부 재사용 위험 판정이 명확하지 않음. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외 |

선택 parser type: `HTML_LIST`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `https://theqoo.net/{board}/{numericDocumentId}` 후보 |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 내부 https redirect만 후보 |
| 제거할 query parameter | `(미정)` |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | canonical link 또는 요청 URL | 1 | 요청 URL 사용 또는 실패 |
| 제목 | OG title 또는 게시글 제목 selector | 1 | 후보 실패 |
| 본문 이미지 | 본문 이미지 selector 후보 | 1 | 후보 실패 또는 운영자 보정 |
| 이미지 순서 | DOM 순서 | 1 | DOM 순서 |
| 게시 시각 | 게시글 time/metadata 후보 | 2 | `null` |

이미지 제외 규칙:

- 로고·프로필·이모티콘: logo, profile, emoticon 제외
- 광고·추적 pixel: ads, analytics 제외
- 추천글 thumbnail: sidebar/widget 영역 제외
- 최소 크기·허용 MIME: `(미정)`
- 외부 CDN host 허용 범위: `theqoo.net`, `img.theqoo.net`, `img-static.theqoo.net` 후보. 사용 결정 전 보류


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | `(미정)` |
| 일일 요청 상한 | `(미정)` |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | `(미정)` |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

| 유형 | 샘플 식별값 | 기대 결과 | 확인 결과 |
| --- | --- | --- | --- |
| 정상 목록 | 없음 | DETAIL_ONLY는 목록을 사용하지 않음 | 실행하지 않음 |
| 빈 목록 | 없음 | DETAIL_ONLY는 목록을 사용하지 않음 | 실행하지 않음 |
| 정상 상세 | numeric URL 후보 | 제목·이미지 후보 추출 | 미수행 |
| 이미지 없는 상세 | synthetic fixture | 명시적 실패 또는 운영자 보정 | 미수행 |
| 삭제·차단 | synthetic fixture | 실패 기록·재시도 제한 | 미수행 |
| 구조 변경 | synthetic fixture | parser 실패 감지 | 미수행 |
| 중복 URL | canonical 후보 | 새 후보 생성 안 함 | 미수행 |

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
- [ ] 이용약관·`robots.txt` 확인
- [ ] Discord·운영자 URL 수집 보조 fixture 검증
- [ ] 목록·feed fixture 검증 해당 없음
- [ ] URL 정규화와 중복 방지 검증
- [ ] 요청 간격·일일 상한·연속 실패 기준 확정
- [ ] 원문 HTML·이미지·개인정보가 로그에 남지 않음
- [ ] feature flag와 출처별 활성값 기본 비활성 확인
- [ ] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 보류
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03 / `(미정)`
- 보류·차단 사유: robots 규칙 미확인, 외부 서비스의 게시물 이용 동의 없음, fixture 미검증.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 비활성 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `DETAIL_ONLY`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_UNVERIFIED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `DETAIL_ONLY`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.
