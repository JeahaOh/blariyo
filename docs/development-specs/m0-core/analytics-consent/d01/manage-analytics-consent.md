# 분석 선택 저장·변경·철회 D01

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `analytics-consent`
- 기준일: 2026-09-03
- 입력 근거: [분석 계획 §5](../../../../planning/04-analytics-ad-plan.md), [쿠키 안내 §3~§5](../../../../legal/cookie-settings.md), [퍼블리싱 동의 저장 비교물](../../../../publishing/responsive/app.js)
- 미검증: browser storage·tag/network test

## 1. 프로세스 목적과 범위

활성 선택 기능 범위에 대해 이용자가 분석 허용 여부를 저장·변경·철회한다.

## 2. 행위자·시작·선행 조건

공개 이용자. flag false이면 이 프로세스는 자동 시작하지 않고 footer에서 비활성 상태만 확인한다.

## 3. 정상 흐름

1. client가 활성 선택 기능과 저장된 consent scope를 비교한다.
2. 활성 기능이 있고 저장값이 없거나 scope가 달라졌으면 비차단 banner를 표시한다.
3. `필수만 사용`은 analytics=false, `모두 허용`은 현재 활성 선택만 true로 저장한다.
4. `설정`은 modal을 열고 이용자가 분석 option을 고른 뒤 `선택 저장`한다.
5. 아래 schema로 `blariyo_consent`를 저장하고 banner/modal을 닫는다.
6. footer 설정에서 철회하면 Google 전송을 중단하고 `_ga`,`_ga_*`를 삭제한다.

## 4. 대안·실패 흐름

- localStorage 차단/오류·JSON parse 실패·schema/version 불일치: 저장값을 사용하지 않고 Google tag를
  로드하지 않는 거부 기본값으로 처리하며 선택을 기억할 수 없음을 알린다.
- 새 기능 추가: 기존 true를 확대 적용하지 않고 다시 선택한다.
- cookie 삭제 실패: 추가 전송은 즉시 중단하고 삭제 실패를 일반 안내한다.

## 5. 단계별 API 매핑

API 해당 없음. browser localStorage와 tag loader만 사용한다.

## 6. 데이터·상태 전이

저장 key는 `blariyo_consent`이며 값은 다음 JSON schema를 따른다.

```json
{
  "version": 2,
  "scope": "analytics",
  "analytics": true,
  "ads": false,
  "savedAt": "2026-09-02T05:00:00.000Z"
}
```

- `version`: 현재 퍼블리싱 비교물과 맞춘 storage schema version인 정수 `2`.
- `scope`: 현재 활성 선택 기능 slug를 `analytics`, `ads` 고정 순서로 선택해 쉼표로 연결한 문자열.
  M0 GA4만 활성화하면 `analytics`, 둘 다 활성화하면 `analytics,ads`다.
- `analytics`, `ads`: boolean. scope에 없는 기능은 항상 `false`이며 동의로 해석하지 않는다.
- `savedAt`: 저장 성공 시각의 UTC ISO 8601 문자열.
- 유효 기간: `savedAt`부터 12개월. 달력 기준 12개월이 지난 첫 확인에서 만료로 판정하고 재선택한다.

퍼블리싱 비교물의 `version=2`, 쉼표 구분 scope와 field 구조는 이 계약과 일치하지만 12개월 만료
판정은 구현돼 있지 않다. 정적 비교물을 실행 증거로 보지 않고 실제 source에서 별도 구현·검증한다.

미저장→analytics false/true; scope 변경·12개월 만료→재선택 필요; true→false 철회다.

## 7. 권한·트랜잭션·멱등성·재시도

인증·server transaction 없음. 같은 선택 저장은 같은 결과이며 tag load는 현재 consent를 재확인한다.

## 8. 완료 조건과 수용 기준

flag false·미저장·거부·철회에서 방문자 수·page open을 포함한 Google tag/request·cookieless ping과
`_ga*`가 0건이고 공개 기능이 유지되어야 한다. 깨진 JSON,
미지원 version, scope 순서 변경, 12개월 경계와 저장 실패도 거부 기본값으로 처리해야 한다.

## 9. 미정·차단·미검증

GA4 활성화 실값은 차단 상태지만 consent state machine 자체는 확정됐다. browser test는 미실행이다.
