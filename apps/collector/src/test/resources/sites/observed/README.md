# 실제 HTML에서 정제한 회귀 fixture

17개 사이트의 목록·상세 HTML 34개와 인벤 첨부 경계 상세 HTML 2개, 총 36개다. 각 `.html.json`은 공개 URL, 원본/정제본 SHA-256,
목록 식별자·순서·시각·페이지 이동, 상세 블록 순서·이미지·첨부 개수를 기록한다.
원본은 Git 제외 로컬 저장소에 보관하며 fixture는 원문의 개인정보·본문·원격 미디어 주소를
재배포하는 용도로 사용하지 않는다. 날짜·페이지 숫자·공지 표식·공개 글 식별자는 parser 검증에 필요해 유지한다.

`ObservedFixtureMain`은 스크립트·HTML 주석·이벤트·입력 값과 비구조 속성을 제거하고
본문 텍스트와 미디어 URL을 fixture 값으로 바꾼다. 텍스트의 원래 값은 보존하지 않는다.
정제 전후의 parser 구조가 일치해야 저장하며, 목록 URL의 추적 인자는 제거할 수 있지만
canonical identity, post key, 순서, 날짜와 페이지 이동은 유지해야 한다.
정제본은 Git의 LF 규칙에 맞춰 줄바꿈·들여쓰기와 줄 끝 공백을 정규화한 뒤 해시를 기록한다.
원본 해시는 변경하지 않으며, checkout 후에도 정제본 해시가 일치해야 한다.
NBSP 공백과 로딩 표시를 실제 본문·이미지로 바꾸지 않는다.

저장소 루트에서 회귀 테스트:

```sh
./apps/collector/gradlew -p apps/collector test --tests '*ObservedSiteFixtureTests'
./apps/collector/gradlew -p apps/collector test --tests '*InvenAttachmentTests'
```

로컬 원본에서 다시 생성할 때는 `testClasses fixtureClasspath`를 실행한 뒤 `apps/collector`를
작업 디렉터리로 두고 다음 main에 인자를 전달한다. classpath는 `build/fixture-classpath.txt`다.

```text
com.blariyo.collector.source.ObservedFixtureMain SOURCE list|detail PUBLIC_URL PRIVATE_RAW_FILE OUTPUT_HTML
```

이 fixture는 저장 시점에 parser가 읽은 구조의 회귀 증거다. 현재 사이트 접속, 원문 완전성,
DB/object 저장·readback, 검수·발행 성공을 대신하지 않는다. SNS/첨부가 없는 원문에 해당
자료가 있다고 주장하지 않는다. 혼합 본문·SNS·첨부 경계는 별도 테스트와 실제 사례로 검증한다.
fmkorea·ppomppu·pgr21·youtube-community에는 성공 원문 fixture가 없으며 이 폴더에 포함하지 않는다.

인벤 `attachments-external`은 본문 밖 `.articleFile`의 파일 2개와 본문 이미지 8개,
`attachments-repeated`는 첨부 영역과 본문에 반복된 파일 URL의 단일 다운로드 후보를 검증한다.
파일 다운로드 아이콘은 본문 이미지가 아니다. 각 링크의 표시 순서는 보존하고 파일 후보만 중복 제거한다.
