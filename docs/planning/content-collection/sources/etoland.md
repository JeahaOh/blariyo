# 이토랜드 수집 명세

- 명세 상태: 1차 검토
- source key: `etoland`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-03
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `(미정)`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 이토랜드 |
| 운영 주체 | 주식회사 컨택트 |
| 기준 URL | `https://etoland.co.kr` |
| 허용 host | `etoland.co.kr` |
| 허용 path | 없음 |
| 제외 path | 전체. 특히 `/private/`와 회원·포인트·출석·광고·검색 관련 경로 |
| 수집 목적 | 공개 유머 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://etoland.co.kr/terms/service` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 약관에서 매크로·봇 자동화, 사이트 콘텐츠 무단 수집·복제·외부 재공개, 운영 방해를 금지하는 조항을 확인했다. |
| `robots.txt` URL | `https://etoland.co.kr/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `/` 허용, `/private/` 차단. Yeti/Googlebot에 crawl-delay 2, 여러 GenAI user-agent에 `Disallow: /`가 있다. |
| 공개 API·RSS 제공 여부 | sitemap 확인. 공개 API·RSS는 `(미정)` |
| 문의·중단 요청 채널 | 약관상 고객 문의 `etoland3@gmail.com` 확인 |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 약관의 무단 수집·복제 금지 조항 때문에 별도 허가 전 상세 fetch 불가. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외. |

선택 parser type: `MANUAL`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `/b/{board}/view/{slug-or-id}` 형식 관찰. 사용 결정 전 비활성. |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 같은 host의 `https` redirect만 검토 가능. |
| 제거할 query parameter | 검색·필터·page 등은 `(미정)` |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

상세 수집은 사용 결정하지 않는다. selector와 이미지 제외 규칙은 `(미정)`이다.


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | `(미정)`; robots에는 일부 검색 봇 crawl-delay 2/10 관찰 |
| 일일 요청 상한 | 0 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | `(미정)` |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

실제 fixture는 작성하지 않았다. 원문 HTML·이미지 복제 없이 synthetic fixture를 별도 작성해야 한다.

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
- [x] 이용약관·`robots.txt` 확인
- [ ] Discord·운영자 URL 수집 보조 fixture 검증
- [ ] 목록·feed fixture 검증 해당 없음
- [ ] URL 정규화와 중복 방지 검증
- [ ] 요청 간격·일일 상한·연속 실패 기준 확정
- [ ] 원문 HTML·이미지·개인정보가 로그에 남지 않음
- [x] feature flag와 출처별 활성값 기본 비활성 확인
- [x] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 보류
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03, 운영 위험 판정자 `(미정)`
- 보류·차단 사유: 약관상 무단 수집·복제·외부 재공개 금지 확인. 별도 허가 전 자동 수집 차단.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책 확인 완료, parser 미검증 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_AGENT_BLOCKED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.
