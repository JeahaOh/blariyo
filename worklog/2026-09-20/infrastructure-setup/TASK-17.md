# TASK-17 — 운영 DB 정책 초안 등록과 초기 데이터 SQL 연결

- 기록일: 2026-09-20, KST
- 요청: 기존 정책을 DB에 등록하고 초기화 SQL에도 포함
- 이전 작업: [실제 Nginx 기동](TASK-16.md)
- 상태: **운영 DB에 약관·개인정보처리방침 DRAFT 2개 등록 및 본문 해시 대조 완료. EFFECTIVE 발행은 미완료**

## 변경

- [정책 초기화 SQL](../../../deploy/postgresql/seed-policy-drafts.sql): V001–V005 이후에 실행.
  `TERMS`·`PRIVACY`, `v0.1-draft.1`, `DRAFT`, 시행일 NULL로 등록한다.
- [입력 생성](../../../deploy/postgresql/policy-seed-input.cjs): 기존 M0 HTML과 비공개 공개 연락처를
  재사용한다. 연락처는 HTML 이스케이프하며 원문·개인정보를 저장소에 추가하지 않는다.
- [로컬 실행](../../../deploy/postgresql/seed-policies-from-mac.py)과
  [서버 적용](../../../deploy/postgresql/seed-policies-server.py): trusted SSH·서버 hostname·관리 DB·health·schema
  준비 확인, root 전용 사본·입력 보관, migrator 역할로 transaction 실행, 별도 readback.
- [초기 구성 진입점](../../../deploy/postgresql/initialize-from-mac.py): DB·역할 설치 뒤 기존 migration과
  권한 적용, 정책 seed를 순서대로 실행한다. 기존 checksum이 고정된 migration 도구·SQL은 수정하지 않았다.
- [인프라 계약](../../../docs/system-design/04-infrastructure-design.md)과
  [운영 안내](../../../deploy/postgresql/README.md), [정책 안내](../../../docs/legal/m0-core/README.md)를 갱신했다.

Docker 빈 volume 초기화 hook은 앱 schema보다 먼저 실행되므로 사용하지 않는다. 앱 기동 때마다
초안을 주입하지도 않는다. 데이터 초기화는 migration 이후 명시적 단계로 관리한다.

## 검증

[격리 검사](../../../deploy/postgresql/test-policy-seed.py)를 실제 PostgreSQL 18에서 실행했다.

- V001–V005 SQL 적용 뒤 DRAFT 두 건, 실제 migrator 권한으로 등록 PASS.
- 연락처 HTML 이스케이프·미확정 문구 보존 PASS.
- 동일 입력 재실행 시 ID·본문·시각 무변경 PASS.
- 두 번째 정책 충돌 시 첫 번째 insert도 남기지 않고 transaction 전체 취소 PASS.
- EFFECTIVE 입력 거부, 기존 유효 정책 보존, 공개 조회 조건에서 DRAFT 제외 PASS.
- 검사 container와 임시 volume 정리 PASS.

처음 검사 fixture는 앱 migration ledger 생성 단계를 빠뜨려 실패했다. 실제 repository의 ledger DDL을
먼저 실행하도록 고쳐 재검사했다. 운영 migrator에는 TEMP 권한이 없으므로 임시 테이블 없이
transaction-local 입력을 쓰도록 구현하고, TEMP 없는 역할로 다시 전체 검사를 통과했다.

## 실제 서버 적용

```sh
python3 deploy/postgresql/seed-policies-from-mac.py --host 13.124.55.99 --apply
```

- 서버 `ip-172-26-1-91`의 `blariyo` DB에 TERMS·PRIVACY 각 1건 등록 PASS.
- 두 본문의 SHA-256·제목·버전·DRAFT 상태·NULL 시행일 독립 readback PASS.
- 별도 읽기 전용 transaction에서 `blariyo_app` 역할로 두 초안을 조회했고 공개 조회 행은 0건.
- 입력·SQL·변경 전 dump는 `/opt/blariyo/postgresql/policy-seeds/` 아래 내용 해시별 root 700/600으로 보관.
- 현재 유효 정책 종류 수는 **0**이다. 기존 본문의 미확정 표시를 지우거나 최종 발행으로 바꾸지 않았다.

## 남은 범위

정식 정책은 초안과 다른 버전으로 앱의 `policies:publish`를 통해 발행한다. 초안 상태만 직접 바꾸면
본문 검증·이전 버전 종료·캐시 삭제 작업을 빠뜨리므로 그렇게 처리하지 않는다.
신규 초기화 통합 진입점은 추가했지만 실제 서버에서 전체 초기화를 재실행하지 않았다.
현재 DB에 seed만 적용했다. 앱 기동·공개 연결·원격 백업·정책의 법률 적합성은 이번 완료 범위가 아니다.
기존 DB·Tunnel·Nginx·image·비밀번호와 migration ledger는 변경하지 않았다. commit/push 없음.
