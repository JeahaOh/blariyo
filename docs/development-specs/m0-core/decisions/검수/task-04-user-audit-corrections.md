# M0 Core 전체 감사 사용자 정정 반영

- 상태: 정정·재검수 완료 · browser/runtime 미검증
- 기준일: 2026-09-03
- 선행 감사: [세부 결정 반영 및 전체 감사](./task-03-final-decisions-full-audit.md)
- Git 경계: 기존 변경을 보존하고 stage, commit, push를 수행하지 않는다.

## 사용자 확정사항

1. 공개 404는 숨김·권리 요청 등 원인을 구분하지 않는 일반 문구로 바꾼다.
2. 카카오톡 공유 UI는 실제 사용할 예정이므로 정적 검토물에서 유지한다.
   - 운영 key·Web domain·CSP 확인 전 runtime 활성화 차단 계약은 유지한다.
   - 정적 검토물의 버튼이 운영 활성화 증거가 아님을 문서 경계로 명시한다.
3. 현행 참고 wireframe의 `__SERVICE_DOMAIN__`은 `https://blariyo.com/`으로 정정한다.
   - `archive/`의 과거 상태는 소급 수정하지 않는다.
4. GA4·광고 UI는 광고 수익화 목적의 후속 활성 상태 시안이므로 유지한다.
   - 동의 전 요청 0건과 운영 gate 계약은 유지한다.
   - 현재 활성화 증거가 아니라는 시안 경계를 명시한다.
5. 이번 변경으로 갱신된 현행 Markdown의 기준일·정합성 검토일을 2026-09-03으로 맞춘다.

## 작업 분담

1. 현재 publishing·wireframe의 일반 404, 현행 도메인, Kakao·GA4·광고 시안 경계 정정
2. 현재 working tree에서 내용이 변경된 Markdown의 stale 검토일 정정
3. 변경 완료 후 별도 에이전트의 읽기 전용 전체 재감사
4. 오케스트레이터의 Git·정본·링크·정적 문법 직접 재검증

## 완료 조건

- 공개 404에서 숨김 원인·권리 요청 사유 노출 0건
- 비-archive 현행 wireframe의 `__SERVICE_DOMAIN__` 0건
- Kakao·GA4·광고 시안 유지와 운영 활성화 차단의 역할 구분
- 이번 변경 대상 Markdown의 2026-09-02 stale 메타데이터 0건
- Markdown 링크, HTML/JavaScript/CSS 정적 검사와 `git diff --check` 통과
- 추가 제품 결정 없이 남은 차단·미검증 항목을 정확히 보고

## 반영 결과

1. responsive publishing·wireframe의 비공개 404를 원인을 드러내지 않는
   `볼 수 없는 게시글입니다` / `요청한 게시글을 볼 수 없습니다.`로 통일했다.
2. 카카오톡 공유 UI는 유지했다. 다만 정적 검토물의 노출은 운영 key·Web domain·CSP
   확인을 완료했다는 증거가 아니며, runtime 활성화 gate는 유지했다.
3. `archive/`를 제외한 현행 wireframe의 `__SERVICE_DOMAIN__`을 `https://blariyo.com/`으로
   교체했다.
4. GA4·광고 UI는 광고 수익화 후속 활성 상태 시안으로 유지했다. publishing 안내와
   법무·광고 wireframe에 `현재 운영 활성화 증거가 아님`을 명시했고, 동의 전 요청
   0건·운영 값·법무 고지 gate는 유지했다.
5. 이번 변경으로 본문이 달라진 현행 Markdown 14개의 stale 메타데이터 17건을
   2026-09-03으로 맞췄다. 과거 이력·예시 날짜는 바꾸지 않았다.

## 재검수 결과

- Critical·High·Medium·Low 확정 오류: 0건
- 일반 404 문구에 숨김·권리 요청 원인 노출: 0건
- 비-archive `__SERVICE_DOMAIN__`: 0건
- 카카오톡·GA4·광고 UI 유지와 runtime gate 간 역할 충돌: 0건
- 변경 대상 Markdown의 2026-09-02 stale 헤더: 0건
- `git diff --check`: 통과
- Markdown 77개의 상대 링크 410건: 누락 0건
- HTML5 parse 5개, JavaScript 문법, inline CSS 괄호 균형: 통과
- 삭제한 제안·후보 문서에 대한 현행 참조: 0건
- 추가된 diff의 secret·credential 패턴: 0건
- 범위 밖 `worklog/` 변경: 0건

## 남은 미검증·Git 경계

- 실제 browser 시각 표시, clipboard, mail client, Kakao SDK, GA4·광고 network 요청은
  browser plugin 의존성 경로 오류로 이번 작업에서 실행 검증하지 못했다.
- 새 정본 `docs/planning/06-copy-contract.md`는 untracked이며, 이전 제안·후보 문서는
  삭제 상태다. 향후 commit에서는 이 추가·삭제를 같은 범위로 포함해야 한다.
- 요청에 따라 stage, commit, push는 수행하지 않았다.
- 이번 정정을 위해 추가로 필요한 제품 결정은 없다.
