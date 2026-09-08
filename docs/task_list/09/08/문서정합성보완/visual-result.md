# D10·D11 정적 검토물 보완과 화면 검증

- 작업일: 2026-09-08
- 승인 범위: `docs/publishing/responsive/app.js`, `docs/wireframes/community/index.html`만 수정. 정본 planning·legal·system-design과 구현 source는 수정하지 않음.
- 목적: 정적 정책 modal의 소셜 최소 수집·가입 생년월일 처리 설명을 현행 법무/M1 계약과 맞추고, 익게 참고 화면의 오래된 `미정` 표시를 현행 M1.5 계약·공개 조건으로 교체.

## 수정 전 스냅샷

수정 직전 두 파일은 Git 작업차가 없었고, 아래 SHA-256을 기록했다.

| 파일 | 수정 전 SHA-256 | 수정 후 SHA-256 |
| --- | --- | --- |
| `docs/publishing/responsive/app.js` | `e599ff4350b3e2d26dc590523c2b495a16ce1389af5a347698ce2c5e2a45d73f` | `b3f109b79fb610b1cbceb26e8384a1cc15c991f1a18d7b0b9416a55634551994` |
| `docs/wireframes/community/index.html` | `5d19c1b778499c14633b8de67d4c7c81dd77fba5b1638c429601d635de1ee1ff` | `5585ba1eaf611238c6a261aa07538963aec0665d665165aceda5187cf01dca7c` |

이번 diff는 아래 명령으로 확보했다. 기존 사용자 변경과 함께 보지 않도록 pathspec을 고정했다.

```bash
git diff --no-ext-diff -- docs/publishing/responsive/app.js docs/wireframes/community/index.html
```

## 반영 내용

| 파일 | 변경 | 정본 근거 |
| --- | --- | --- |
| `docs/publishing/responsive/app.js` | 개인정보처리방침 modal의 소셜 이메일·닉네임·프로필 이미지 수집 문구를 제거. provider 고유 식별자·직접 입력 서비스 표시명·동의 이력만 표시하고, 직접 입력 생년월일은 만 14세 이상 판정 뒤 DB·로그·분석에 남기지 않는다고 표시. | `docs/legal/privacy-policy.md:69,83-94`, `docs/legal/signup-privacy-consent.md:19-28` |
| `docs/wireframes/community/index.html` | 화면을 M1.5 설계 참고로 명시하고, 제품 계약 링크·비회원 읽기/회원 참여 gate·랜덤 이름·탈퇴 콘텐츠 유지 규칙을 표시. `미정` 탭을 실제 공개 전 확인 조건과 첫 버전 제외 범위로 교체. 목록을 페이지당 20개로 명시하고, 예시 작성자는 정본의 3부분 조합 예시로 변경. | `docs/planning/08-member-community-plan.md:64-104`, `docs/planning/09-random-name-catalog.md:8-16`, `docs/planning/03-screen-design.md:421` |

정적 화면에 실제 가입·작성·신고·운영 기능은 추가하지 않았다. 법무·provider 운영값·공개 조건은 여전히 미검증/차단 상태다.

## 검증

### 정적 검사

```bash
node --check docs/publishing/responsive/app.js
git diff --check
```

두 명령은 통과했다.

### 브라우저 화면 확인

로컬 정적 서버에서 실제 `app.js`를 로드했다.

```bash
python3 -m http.server 38080 --directory docs
```

| 화면 | viewport | 실제 상호작용·확인 결과 |
| --- | --- | --- |
| 개인정보처리방침 modal | desktop 기본 viewport | 푸터 `개인정보처리방침`을 클릭해 modal을 열었다. provider 고유 식별자·직접 입력 서비스 표시명, 선택 프로필 미요청·미보관, 직접 생년월일의 일시 처리·즉시 폐기 문구가 렌더링됐다. |
| 개인정보처리방침 modal | 390×844 | 같은 footer link로 modal을 열었다. 새 세 문단이 modal 안에 보였고, mobile 폭에서 문단과 닫기 버튼을 확인했다. |
| 익게 목록 | desktop 기본 viewport, 390×844 | M1.5 참고 상태, 제품 계약 링크, 페이지당 20개·텍스트 게시판 설명, 정본의 긴 3부분 랜덤 이름 예시와 페이지 이동을 확인했다. |
| 익게 글쓰기 참고 | desktop 기본 viewport, 390×844 | 상단 탭을 눌러 제목 1~200자·본문 1~10,000자·HTML/Markdown 미해석 문구와 두 입력 영역을 확인했다. |
| 공개 전 확인 | desktop 기본 viewport, 390×844 | 상단 탭을 눌러 회원 참여 gate, 법무·운영 근거, 첫 버전 제외, 확정된 참여·운영 규칙 카드가 모두 표시되는 것을 확인했다. |

랜덤 이름 예시 보완 후 목록을 다시 열어 정본의 3부분 예시 `달빛 아래 느긋한 수달`,
`공방의 그림 그리는 푸딩`, `무지개 아래 탐험하는 오카리나`과 `페이지당 20개` 문구를 desktop 기본
viewport와 390×844 mobile viewport에서 확인했다. 긴 이름은 두 viewport 모두 목록의 제목·메타 행과
겹치지 않았고, mobile에서는 제목 아래 메타 행에 모두 표시됐다. 루트 검수용 Chrome 탭은
`http://127.0.0.1:38080/wireframes/community/index.html#list`로 유지한다.

브라우저 자동화가 위 여섯 화면의 screenshot을 각 검증 시점에 출력했다. CUA screenshot API는 현재 작업 트리에 PNG 파일을 저장하는 기능을 제공하지 않아 별도 PNG는 만들지 않았다. 이 문서의 viewport·상호작용·렌더링 결과가 해당 화면 증거이며, 이미지 출력은 자동화 실행 기록에서 확인한다.

## 한계와 상태

- 완료: 승인된 정적 문구·상태 보완, JavaScript 구문, diff 공백, desktop/mobile 실제 화면 확인.
- 미검증: 실제 OAuth/provider 설정, 회원가입·생년월일 처리, DB·로그 비보관, API·runtime·배포, 법무 전문의 운영 버전·시행일.
- 범위 밖: API Markdown 표 D12와 정본 수정, commit, push.
