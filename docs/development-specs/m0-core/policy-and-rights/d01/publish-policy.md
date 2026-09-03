# 승인 정책 시행 D01

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-03
- 입력 근거: [데이터 모델 §4 정책 버전](../../../../system-design/02-data-model.md), [보안·운영 §12](../../../../system-design/05-security-operations.md)
- 미검증: 승인 artifact, command source, DB·cache runtime

## 1. 프로세스 목적과 범위

법무 승인 artifact를 고지된 시행 시각에 정책 version으로 원자 시행한다.

## 2. 행위자·시작·선행 조건

권한 있는 운영자, 유형·version·제목·원문·시행 시각·checksum이 든 승인 artifact, root `0600` 보관이
필요하다. 운영자 표시명·일반 문의·권리·개인정보 접수 이메일과 개인정보 보호책임자 또는 담당자
config 실값이 artifact에 반영돼야 하며 해당 placeholder가 남아 있으면 시행할 수 없다.

## 3. 정상 흐름

1. 시행 시각과 checksum을 확인한다.
2. artifact를 command container에 read-only로 mount한다.
3. `npm run policies:publish -- --artifact=<path>`를 시행 시각부터 5분 안에 한 번 실행한다.
4. command가 schema·checksum, 필수 법무·문의 실값과 placeholder 부재를 검증하고 body를 allowlist sanitize한다.
5. 유형 advisory lock transaction에서 기존 EFFECTIVE를 같은 경계 시각 RETIRED로 바꾸고 새 EFFECTIVE를 insert한다.
6. 정책 API와 직접 route cache purge outbox를 기록하고 commit한다.
7. current·history·cache purge 결과를 확인하고 mount·임시 파일을 제거한다.

## 4. 대안·실패 흐름

- 미래 시각 또는 5분 초과 과거: 거부. 새 시행 시각으로 법무 문서·artifact를 다시 승인한다.
- checksum/schema/필수 법무·문의 실값/sanitize/DB 실패: 전체 rollback, 기존 current 유지.
- purge 실패: DB 시행 유지, outbox 재시도.

## 5. 단계별 API 매핑

시행 HTTP API 해당 없음. 확인은 [정책 조회 API](../api/get-policy.md)를 사용한다.

## 6. 데이터·상태 전이

동일 유형 `EFFECTIVE→RETIRED`와 새 `EFFECTIVE`; 구간은 `[effectiveAt,endedAt)`다.

## 7. 권한·트랜잭션·멱등성·재시도

유형 advisory lock과 unique EFFECTIVE 제약을 사용한다. 실패 artifact를 과거 시각으로 강제 재실행하지 않는다.

## 8. 완료 조건과 수용 기준

API·route current version, 이력 경계, 필수 법무·문의 실값, placeholder 부재, sanitize 본문, purge와
artifact 제거를 확인해야 한다. 사업자 정보 placeholder는 사업자등록 또는 거래 기능 확정 전 보류값이므로
필수값 실패로 처리하지 않는다.

## 9. 미정·차단·미검증

승인된 production artifact와 법무 실값이 없어 차단이다.
