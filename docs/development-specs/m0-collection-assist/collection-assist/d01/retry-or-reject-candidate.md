# 후보 재시도와 반려 D01

## 1. 프로세스 목적과 범위

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-03
- 입력 근거: [수집 보조 개발 보강서](../collection-assist.dev.md)
- 미검증: source, test, browser

운영자가 실패 또는 미사용 후보를 재시도하거나 반려한다.

## 2. 행위자·시작 조건·선행 조건

- 행위자: 인증된 운영자
- 시작 조건: 후보 상세 또는 목록의 재시도·반려 선택
- 선행 조건: 후보가 `FETCH_FAILED` 또는 `NEW` 상태

## 3. 정상 흐름

1. 운영자가 `FETCH_FAILED` 후보에서 재시도를 선택한다.
2. 화면은 현재 `lockVersion`으로 retry API를 호출한다.
3. 성공하면 후보가 `NEW` 또는 갱신된 `FETCH_FAILED`로 표시된다.
4. 운영자가 `NEW` 또는 `FETCH_FAILED` 후보에서 반려를 선택한다.
5. 화면은 반려 사유를 선택하게 한다.
6. Core는 `REJECTED`와 `reviewedAt`을 기록한다.

## 4. 대안·실패 흐름

- lockVersion 충돌: 최신 후보를 다시 불러오도록 안내한다.
- terminal 상태: 재시도·반려 버튼을 숨기거나 비활성화한다.
- 출처 비활성·robots 변경: retry를 거부하고 사유를 표시한다.

## 5. 단계별 호출 API 매핑

| 단계 | API |
| --- | --- |
| 2~3 | [후보 재시도](../api/retry-candidate.md) |
| 4~6 | [후보 반려](../api/reject-candidate.md) |

## 6. 데이터·상태 전이

- `FETCH_FAILED` -> `NEW`
- `FETCH_FAILED` -> `FETCH_FAILED`
- `NEW` -> `REJECTED`
- `FETCH_FAILED` -> `REJECTED`

## 7. 권한·트랜잭션·멱등성·재시도

- 관리자 인증 필수.
- retry는 외부 fetch를 다시 수행하므로 출처 상한과 robots를 재확인한다.
- reject는 외부 fetch를 수행하지 않는다.

## 8. 완료 조건과 수용 기준

- 재시도 결과와 반려 사유가 화면에 반영된다.
- 반려된 후보는 승격할 수 없다.
- 실패 사유는 일반화하고 내부 stack·HTML 원문은 노출하지 않는다.

## 9. 미정·차단·미검증 항목

- 미검증: source, contract test, browser

