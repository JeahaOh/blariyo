# Blariyo 정책 문서 초안

- 문서 상태: 기획 정본 반영, 출시 전 확정 필요
- 기준일: 2026-08-12
- 서비스 명칭: `블라리요`

## 문서 목록

| 문서 | 파일 | 고정 경로 |
| --- | --- | --- |
| 이용약관 | [terms-of-service.md](./terms-of-service.md) | `/terms` |
| 개인정보처리방침 | [privacy-policy.md](./privacy-policy.md) | `/privacy` |
| 권리자 요청 안내 | [rights-request.md](./rights-request.md) | `/rights` |
| 쿠키 설정 안내 | [cookie-settings.md](./cookie-settings.md) | `/cookie-settings` |

네 경로는 푸터에서 modal로 열고 직접 URL에서도 같은 내용을 독립 화면으로 제공한다. `#` 임시 링크로 출시할 수 없다.

- 이용약관과 개인정보처리방침 modal은 현재 적용 버전의 전체 본문을 먼저 표시한다.
- 본문 하단 이력에는 버전, 제목, 시행일, 상태를 저장하고 버전을 선택하면 같은 modal의 전체 본문을 해당 버전으로 바꾼다.
- 새 버전 공개 시 이전 본문을 덮어쓰지 않는다.
- 권리자 요청과 쿠키 설정은 각각 입력 form과 선택 control을 가진 modal로 제공한다.

## 공통 정책 계약

- 초기에는 `짤/meme` 게시판 하나만 운영하고 `/`는 `/meme`으로 리다이렉트한다. 추후 `익게/community`, `뉴스/news`와 다른 게시판을 추가할 수 있다.
- 공개 목록은 광고 행을 제외한 게시글 20개, 상세 하단은 같은 게시판의 현재 글 주변 게시글 20개를 사용한다.
- 초기 게시글은 관리자가 보기에 웃긴 것을 직접 선별해 발행하고 외부 콘텐츠에는 출처를 표시한다. 출처 표시는 권리 확보를 뜻하지 않는다.
- 권리자 요청이 접수되면 대상 게시글을 먼저 숨기고 관리자가 재공개·수정·삭제를 판단한다.
- 자동 수집 결과는 임시 후보 큐에만 저장한다. 운영자 확인과 수동 발행 없이 공개할 수 없다.
- 필수 내부 운영 통계와 선택 GA4를 서로 다른 목적, 식별자, 저장소, 철회 절차로 운영한다.
- 네이버, 카카오, Google, Apple 소셜 회원가입·로그인을 제공한다. 소셜 제공자의 동의와 블라리요 이용약관 동의·회원가입 개인정보 수집이용 동의는 분리한다.
- 소셜 비밀번호는 수신·저장하지 않고 provider 고유 식별자를 계정 연동 키로 사용한다. 이메일은 로그인 계정의 고유 키로 사용하지 않는다.
- GA4는 분석 동의 후에만 로드하며 회원 번호, 이메일, 닉네임과 provider 식별자를 GA4로 보내지 않는다.
- 상세 광고는 본문·출처 다음, 하단 목록 중간, 목록 아래만 허용한다.
- 광고 호출 실패는 광고 차단으로 간주하지 않는다. 확정 차단 때는 닫을 수 있는 전면 dim modal을 표시하며 닫은 뒤 콘텐츠 열람을 제한하지 않는다.
- 제휴 링크에는 링크와 가까운 위치에 제휴 관계와 수수료 수취 사실을 분명히 고지한다.

## 출시 차단 항목

아래 placeholder는 삭제하지 않는다. 하나라도 `[입력 필요]` 또는 `[출시 차단: ...]` 상태면 production 공개, GA4 활성화, 광고·제휴 실험을 시작할 수 없다.

| 차단 항목 | 적용 문서·기능 |
| --- | --- |
| 사업자·운영자명, 대표자, 주소, 문의처, 시행일 | 약관·개인정보처리방침·권리자 안내 공통 |
| 개인정보 보호책임자와 담당 부서 | 개인정보처리방침 |
| 권리자 요청 수령인, 접수 이메일, 회신 채널 | 권리자 요청 안내 |
| 실제 호스팅·이메일·분석·광고 수탁자와 계약 법인 | 개인정보처리방침 |
| 네이버·카카오·Google·Apple application, client ID·secret 보관, callback URL, 최소 scope | 소셜 로그인 활성화 |
| 소셜 제공자별 개인정보 수신·제공·연동 해제 정책과 실제 계약 주체 | 소셜 회원가입 공개 |
| 14세 미만 가입 허용 여부와 연령 확인 방식 | 소셜 회원가입 공개 |
| 국외이전 국가, 항목, 시점, 방법, 보유 기간, 거부 방법 | Google·Apple 로그인, GA4·광고 태그 활성화 |
| GA4 속성·보관 설정과 실제 쿠키 만료 | 선택 분석 활성화 |
| 광고 사업자, 광고 동의 범위, 슬롯 정책 | 광고 실험 |
| 제휴 사업자, 필수 고지 문구, 수수료 구조 | 제휴 실험 |
| 익게 작성·댓글·신고, 탈퇴 후 게시글 처리 | 익게 사용자 작성 기능 공개 |

소셜 회원가입·로그인은 회원 생명주기와 제공자별 최소 수집 범위, 탈퇴·연동 해제, 국외이전 항목을 확정하고 이용약관·개인정보처리방침·쿠키 설정에 시행일을 고지한 뒤 공개한다. 익게 작성 기능은 게시글·댓글·신고와 탈퇴 후 콘텐츠 처리 기준을 별도로 확정한 뒤 공개한다.

## 작성 기준

- 초기 `짤/meme`와 추후 `익게/community`, `뉴스/news` 확장 항목을 구분한다.
- 정책 문서는 조항형 본문과 핵심 표를 함께 제공한다.
- 기능·수탁자·국외이전이 바뀌면 배포 전에 네 문서를 함께 재검토한다.

## 참고 기준

| 기준 | 반영 지점 |
| --- | --- |
| [개인정보 보호법 제30조](https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1020398435) | 개인정보 처리 목적, 항목, 보유 기간, 제공·위탁, 파기, 권리 행사, 보호책임자, 자동 수집 장치 |
| [개인정보 보호법 시행령 제31조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900079801) | 처리방침 추가 기재사항과 지속 공개 |
| [개인정보 처리방침 작성지침 2025.4](https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20806) | 처리방침 표 구성과 알기 쉬운 공개 방식 |
| [공정거래위원회 표준약관 안내](https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=201&key=202) | 이용약관 공개·변경 원칙 |
| [저작권법 제103조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029423165) | 복제·전송 중단, 당사자 통보, 재개 요청 |
| [저작권법 시행령 제41조부터 제43조](https://law.go.kr/LSW/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=63336) | 중단 통보 기한, 재개 요청·판정·예정일 |
| [korean-privacy-terms](https://github.com/kimlawtech/korean-privacy-terms) | Apache-2.0 공개 템플릿의 개인정보처리방침 목차·점검 항목 참고 |
| [네이버 회원 프로필 조회](https://developers.naver.com/docs/login/profile/profile.md) | 애플리케이션별 고유 식별자와 선택 프로필 항목 |
| [카카오 로그인](https://developers.kakao.com/docs/latest/ko/kakaologin/common) | 서비스별 회원번호, 동의 항목과 연결 해제 기준 |
| [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) | `sub`, `openid email profile` 최소 scope |
| [Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple) | 최초 승인 시 이름·이메일 수신과 Apple 사용자 식별 기준 |
| [Google consent mode 개요](https://developers.google.com/tag-platform/security/concepts/consent-mode) | 동의 전 전송이 없는 basic consent mode와 동의 상태별 tag 동작 구분 |
| [Google Analytics PII 방지 지침](https://support.google.com/analytics/answer/6366371) | 이메일·이름 등 직접 식별정보와 사용자 입력값을 GA4에 보내지 않는 기준 |
