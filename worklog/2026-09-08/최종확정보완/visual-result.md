# R10 정적 정책 modal 보완 및 화면 검증

## 범위와 변경

- 승인 범위에서만 변경했다: `docs/publishing/responsive/app.js`, `docs/publishing/responsive/README.md`.
- 정본(`planning`, `legal`, `system-design`)과 애플리케이션 구현은 변경하지 않았다.
- 수정 전 사본은 `/private/tmp/blariyo-r10-app.js.before`, `/private/tmp/blariyo-r10-responsive-readme.before`에 보관했다.
  - 수정 전 SHA-256: `b3f109b79fb610b1cbceb26e8384a1cc15c991f1a18d7b0b9416a55634551994` (app.js), `c65ce26e85c0fa4e8a5b398bf3ececed8c95a6275155250740194c0dcb3cd4f4` (README)
  - 수정 후 SHA-256: `fe1890b215fc668b217fbf6e1b30a039ce0b7fe234d833cc5467894ed89fe50f` (app.js), `341a6c655513e8c064cfdf7af559e86d4b55c8e5f923247c49e6daa90ecb69d9` (README)

`app.js:327-388`은 현재 보기와 과거 보기 예시 본문을 분리했다. 현재 개인정보 보기의 Apple refresh credential 보유 예외와 삭제 조건은 `app.js:361`에 반영했다. 이력의 버전·기간·본문이 실제 발행 정책이 아니라는 표시는 `app.js:317-318`, `app.js:381-384`, 과거 가상 본문의 `app.js:329-335`에 중복 없이 명시했다. 선택으로 `innerHTML`이 교체된 뒤 focus가 문서 밖으로 빠지던 문제는 `app.js:386-387`에서 dialog를 다시 focus하도록 보완했다. README의 정적 시연 한계는 `README.md:49`에 기록했다.

## 실행 검증

다음 명령을 2026-09-08에 실행했다.

```sh
node --check docs/publishing/responsive/app.js
git diff --check
node /private/tmp/blariyo-r10-policy-check.mjs
```

- `node --check`, `git diff --check`: 오류 없음.
- 마지막 명령은 Playwright Chromium에서 1280×900과 390×844를 각각 열었다. 두 viewport에서 푸터의 개인정보처리방침을 열고, 현재 본문의 Apple refresh credential 예외 문구를 확인한 뒤 `이전 보기 예시 A`를 선택했다. 선택 후 본문이 가상 본문으로 바뀌고, modal dialog가 `document.activeElement`를 포함하는지도 확인했다.
- 출력: `desktop: modal, Apple notice, history body switch, and dialog focus verified`, `mobile: modal, Apple notice, history body switch, and dialog focus verified`.
- 화면 산출물은 [데스크톱 전환 화면](policy-desktop.png), [모바일 전환 화면](policy-mobile.png)이다. 두 이미지는 `이전 보기 예시 A`를 선택한 뒤의 상태이며, 가상 본문·가상 적용 기간·정적 시각 검수 표기가 실제로 보인다.
- full-page 이미지와 구분해 [모바일 실제 viewport 화면](policy-mobile-viewport.png)도 390×844에서 캡처했다. modal 내부 `scrollTop`을 끝으로 옮긴 뒤 `이전 보기 예시 B`가 viewport 안에 들어오는 것을 확인하고 캡처했으며, 이어서 내부 scroll을 0으로 돌렸을 때 닫기 버튼이 viewport 안에 다시 들어오는 것도 확인했다. 따라서 작은 화면에서 이력 B와 닫기 조작 모두 modal 내부 scroll로 접근 가능하다.
- 별도의 desktop CUA 검증에서도 같은 전환 뒤 접근성 트리가 `개인정보처리방침` dialog container에 focus가 남아 있음을 확인했다. 검수 URL은 `http://127.0.0.1:38080/publishing/responsive/index.html`이며 로컬 서버를 유지 중이다.

## 한계

이 검증은 정적 퍼블리싱 화면의 modal 동작과 표시만 다룬다. 실제 정책 artifact 발행, 제공자 token 암호화·보관·삭제 작업, API·DB, 법무 확정은 검증하거나 구현하지 않았다. 따라서 이 결과는 출시 또는 실제 개인정보 처리 완료 증거가 아니다.
