# 개발 환경 재개 전 안전 기준

- 문서 상태: 설계 전용 브랜치 기준 · 현행 실행 환경 없음
- 정합성 검토일: 2026-08-20

현재 브랜치에는 `apps/`, Docker Compose, 애플리케이션 source, migration, seed와 로컬 DB
초기화 파일이 없다. 따라서 이 저장소에서 실행할 수 있는 Docker 기동·초기화·migration 명령도
현재는 없다. 과거 `apps/` 경로와 명령을 현행 절차로 사용하지 않는다.

이 문서는 애플리케이션 개발을 다시 시작할 때 기존 로컬·운영 데이터를 훼손하지 않기 위한
안전 경계만 정의한다. 구체적인 파일 경로와 명령은 실제 구현 산출물이 생긴 뒤 그 구조를 직접
확인해 추가한다.

## 1. 설계 정본

개발 환경을 만들기 전에 다음 문서를 순서대로 확인한다.

1. [인프라 계획](./planning/02-infra-plan.md): PostgreSQL 18, Docker Compose와 저장소 방향
2. [데이터 모델](./system-design/02-data-model.md): schema, migration과 seed 계약
3. [인프라 설계](./system-design/04-infrastructure-design.md): container, network, volume과 수집 outbound 경계 계약
4. [보안·운영 설계](./system-design/05-security-operations.md): 권한, backup, restore와 배포 gate

위 문서는 구현 계약이며 실행 완료 증거가 아니다. 실제 Compose·migration·test 파일과 실행
결과가 생기기 전에는 개발 환경 준비 또는 DB 검증 완료로 표시하지 않는다.

## 2. 구현 재개 gate

사용자가 애플리케이션 개발 재개를 명시적으로 요청한 뒤 아래 항목을 확정한다.

- 애플리케이션과 인프라 파일의 실제 디렉터리 구조
- Compose project name, service 이름, port와 network
- PostgreSQL volume 또는 bind mount의 실제 호스트 경로
- migration runner, version 파일명, checksum과 동시 실행 방지 방식
- 개발·test·production 환경 변수와 credential 분리
- 빈 PostgreSQL 18에서 migration·seed를 검증할 명령
- backup 생성, 별도 보관과 실제 restore 검증 절차

경로나 명령을 예시만으로 먼저 고정하지 않는다. 구현 시점의 실제 파일과 package script를 읽고
이 문서를 갱신한 뒤 실행한다.

## 3. 실행 전 대상 확인

실행 환경이 만들어진 뒤에도 초기화나 migration 전에 다음을 확인한다.

1. 현재 경로가 이 저장소의 개발 checkout인지 확인한다.
2. 적용할 Compose 파일과 project name을 확인한다.
3. 실행 중인 service, volume과 bind mount의 실제 경로를 기록한다.
4. 연결 대상이 local·test인지 DB identity와 endpoint로 확인한다.
5. production credential이나 운영 endpoint가 연결돼 있으면 즉시 중단한다.

저장소와 브랜치 확인에는 다음 읽기 전용 명령만 현재도 사용할 수 있다.

```bash
pwd
git rev-parse --show-toplevel
git status --short --branch
```

Compose·DB 확인 명령은 실제 Compose 파일과 service가 만들어진 뒤 문서화한다.

## 4. 데이터 보존 원칙

- 보존 여부가 불명확하면 초기화하지 않는다.
- 데이터가 필요하면 DB logical backup과 업로드 파일 사본을 각각 만든다.
- backup은 원본과 다른 저장 위치에 두고 목록 조회만이 아니라 실제 restore로 검증한다.
- volume과 bind mount의 실제 절대경로를 확인하기 전에는 정리·이동하지 않는다.
- 기존 데이터는 삭제보다 날짜가 포함된 격리 경로로 이동하고 새 환경 검증까지 보존한다.
- 운영·공용·복구 불가능한 데이터에는 로컬 초기화 절차를 적용하지 않는다.

## 5. 구현 후 검증 순서

1. Compose 설정과 service·volume 목록 확인
2. 필요한 개발 service만 기동
3. 빈 PostgreSQL 18에 순번 migration과 seed 적용
4. 같은 migration 재실행과 checksum 변경 거부 검증
5. 목록·상세·운영자 발행·숨김 smoke test
6. backup 생성과 새 DB restore 검증
7. 실제 결과를 데이터·API 실행 준비 gate에 반영

## 금지 사항

- 현재 존재하지 않는 `apps/` 경로나 package script를 실행 가능한 절차처럼 안내
- 운영 서버에서 개발 초기화 수행
- 대상 확인 없이 volume 또는 bind mount 정리
- backup·restore 확인 전 기존 데이터 제거
- 경로 변수, wildcard 또는 넓은 상대 경로를 데이터 정리 대상으로 사용
- 설계 문서나 명령 예시만으로 migration·test·복구 완료 처리
