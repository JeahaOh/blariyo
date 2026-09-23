# 사이트 모듈 분리 전 결과 기준선

- 기준 source: commit `8cda23e3e3681c9c8fcc777e189496b337c09e17`의 `SiteAdapters.java`.
- 해당 파일 SHA-256: `3e7715ecaa96b97cb41f54c94c2531ef9fbe8aec383d36cd6244aeca5f15085b`.
- [module-baseline.json](module-baseline.json): 분리 전에 실행한 상세 21개·목록 19개의 전체 출력 SHA-256.
- JSON object key만 정렬하고 배열 순서는 그대로 유지한다. 상세에는 identity와 전체 detail 결과,
  목록에는 모든 entry·날짜·next가 포함된다. parserVersion·본문·미디어·첨부·SNS 변경도 검출한다.
- 17개 사이트는 기존 `observed/*.html`을 사용한다. fmkorea·ppomppu·pgr21·youtube-community는
  합성 HTML로만 실행했다. PGR21·YouTube의 목록은 미지원이므로 목록 기준값이 없다.
- 입력과 출력 조립은 [SiteFixtureSupport](../../java/com/blariyo/collector/source/common/SiteFixtureSupport.java)에 있다.
  `main`은 결과를 표준 출력으로 내보내며 기준 파일을 자동 갱신하지 않는다.
- 이 값은 코드 이동의 동등성 증거다. 실제 사이트 접근·수집 성공이나 DB/object readback 증거가 아니다.
  의도한 동작 변경 시 원문 fixture·계약을 검토한 뒤 해당 기대값만 갱신한다.
