# Spring 수집 서버 전환 결정 — 설계 에이전트 전달 문서

- 작성일: 2026-09-08
- 작성 위치: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-m0-core`
- 작성 브랜치: `feature/m0-core`
- 목적: 대화에서 합의한 수집기 전환 방향을 다른 작업 중인 설계 에이전트에게 전달한다.
- 상태: **전환 방향 합의 / 설계 정본 반영 대기 / Spring 구현 미착수**
- 문서 성격: 인계용 결정 기록이다. 설계 브랜치의 정본을 수정한 결과물이 아니다.

## 1. 요청 배경과 이번 작업 경계

사용자는 `/Users/zeaha/workspace/s2b_batch`처럼 서버가 상시 실행되고, cron·API·Discord로
수집 작업을 실행하는 구조를 요청했다. Python으로 운영 기능을 직접 관리하는 대신
Spring 기반 배치 서버로 전환하고 기존 BE·FE는 유지하는 방향으로 정리했다.

설계 브랜치에서는 다른 작업이 진행 중이므로 이번에는 이 문서만 작성한다.
설계 브랜치에 파일을 복사하거나 수정하지 않으며, 코드 전환·commit·push·merge도 수행하지 않는다.
수신 에이전트는 자신의 현재 작업과 기존 변경을 보존하면서, 설계 반영 작업을 수행할 때 이 문서를 입력으로 사용한다.

## 2. 확정한 설계 방향

| 항목 | 결정 |
| --- | --- |
| 수집 서버 | 별도 Spring Boot 상시 실행 애플리케이션 |
| 작업 처리 | Spring Batch |
| 예약 실행 | Quartz cron |
| 수동 실행 | REST API와 Discord 명령이 공통 배치 실행 경로를 호출 |
| 실행 위치 | 운영자 로컬 컴퓨터. 공개 BE·FE와 별도 프로세스·장애 경계 유지 |
| 추출 구현 | 현재 Python 중심 수집기를 Java/Spring 기반으로 전환하는 방향. Python 병행 운영은 기본안에 포함하지 않음 |
| 서비스 데이터 저장 | 수집 서버가 기존 수집 API로 요청하고, BE가 서비스 DB와 이미지 저장소를 관리 |
| 배치 실행 이력 | Spring Batch 메타데이터 저장소로 관리. 물리 DB·스키마 위치는 미정 |
| 기존 BE·FE | 수집 API 계약, 후보 검수, 이미지 처리, 초안 생성·편집·발행 기능 유지 |

Spring Boot는 서버/API, Quartz는 실행 시각, Spring Batch는 작업 실행·단계·이력·재시작을 담당한다.
`s2b_batch`는 동작 구조의 참고 대상이다. 해당 저장소의 업무 코드·인증·설정·DB 정보를 복사하거나
Blariyo를 S2B 시스템에 연결하라는 요청이 아니다.

## 3. 목표 처리 흐름과 데이터 소유권

```text
운영자 로컬 Spring 수집 서버
  Quartz cron ─┐
  REST API ────┼─> 공통 배치 실행 경로 ─> Spring Batch 수집 Job
  Discord ─────┘                            │
                                  후보 선점·원문/이미지 추출
                                            │
                              기존 Web/BFF collector 전용 중계
                                            │
                                       기존 Core API
                                            │
                               후보 DB + 비공개 이미지 저장소
                                            │
                                기존 FE 검수 → 초안 → 별도 발행
```

| 데이터 | 기록 경로 | 책임 |
| --- | --- | --- |
| 배치 작업·단계 실행 이력 | Spring 수집 서버 → Batch 메타데이터 저장소 | 배치 실행 상태·재시작 관리 |
| 수집 후보·이미지 메타데이터 | Spring 수집 서버 → 기존 수집 API → BE → 서비스 DB | 후보 상태·중복·버전·검수 관리 |
| 이미지 파일 | Spring 수집 서버 → 기존 preview 업로드 API → BE → 비공개 저장소 | 이미지 검증·재인코딩·저장·만료 |
| 게시글·발행 상태 | 기존 관리자 API → BE → 서비스 DB | 검수 후 초안 생성과 발행 |

**Spring 수집 서버는 `collect.*`·`content.*` 같은 서비스 테이블에 직접 INSERT/UPDATE하지 않는다.**
배치 메타데이터를 직접 기록하는 것과 서비스 후보 데이터를 저장하는 것은 다른 경로다.
동일 PostgreSQL 인스턴스 사용 여부는 아직 결정하지 않았다.

## 4. 유지할 API·기능 경계

현재 구현 브랜치의 계약은 [수집 API 설계](../../../docs/system-design/03-api-design.md)와
[수집 OpenAPI](../../../docs/development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml)를 참조한다.
설계 브랜치에 해당 파일이나 최신 내용이 없다면 이 작업 트리에서 읽기 전용으로 대조한다.

collector의 접속 경로는 `/api/collector/v1/*`이며 Web/BFF가 `/internal/collect/*`로 매핑한다.
Spring으로 전환한다는 이유로 Core 직접 접근이나 서비스 DB 직접 접근으로 바꾸지 않는다.

| 기존 Core 경로 | 유지할 동작 |
| --- | --- |
| `POST /internal/collect/candidates` | URL 후보 접수 |
| `POST /internal/collect/candidates/claim` | 대기 또는 lease가 만료된 작업 선점 |
| `POST /internal/collect/candidates/{candidateId}/heartbeat` | lease 연장·새 버전·출처 설정 확인 |
| `POST /internal/collect/candidates/{candidateId}/result` | 수집 성공/실패 결과 제출 |
| `POST /internal/collect/candidates/{candidateId}/images/{candidateImageId}/preview` | 검수용 이미지 업로드 |

- collector 인증, Idempotency-Key, collectorId, lockVersion, lease와 이미지 ID 매핑 계약을 유지한다.
- BE의 후보 검수·반려·재수집·초안 생성 API와 FE의 `/admin/collect`, `/admin/collect/sources`, `/admin`을 유지한다.
- Spring의 배치 실행 상태와 BE의 후보 상태를 별개로 관리하고 대응 관계를 명세한다.
- Batch 메타데이터 transaction이 외부 BE API 호출까지 원자적으로 보장하지는 않는다.
  결과 제출 후 응답 유실·프로세스 중단에도 기존 멱등성·후보 선점 계약으로 복구하도록 설계한다.
- 소스 host/CDN 제한, robots 확인, 요청 간격·일일 한도, DNS/SSRF·redirect·크기·timeout 제한을 유지한다.
- 수집기는 외부 원문을 읽고 후보를 제출한다. 검수와 발행은 기존 운영자 흐름을 따른다.

## 5. 변경하지 않은 제품 범위

- cron 도입은 사이트 목록에서 새 글을 자동 발견하는 기능의 승인과 다르다.
- 현재 수집 보조는 지정 URL·이미 접수된 후보를 처리한다. 목록 자동 수집은 기존 후속 범위다.
- 자동 발행, 회원·광고 기능, 전체 BE 기술 스택 전환은 이번 결정에 포함하지 않는다.
- 배치 관리 웹 화면 추가와 macOS 자동 기동 등록도 아직 결정하지 않았다.
- 실제 출처 활성화·Discord 계정 연결·운영 배포·법무 승인 완료를 의미하지 않는다.

## 6. 설계 반영 전에 구체화할 미정 항목

다음은 확정된 사실로 문서에 기입하지 말고 `(미정)` 또는 후속 설계 항목으로 남긴다.

| 항목 | 필요한 결정 |
| --- | --- |
| 코드 위치 | 별도 저장소인지, 현재 저장소 안의 별도 애플리케이션인지 |
| Batch DB | 별도 DB인지 기존 PostgreSQL의 별도 스키마인지, 계정·권한·백업 경계 |
| Quartz 저장소 | 메모리/JDBC 저장 여부, 스케줄 변경·재시작·중단 시각 처리 |
| 버전·라이브러리 | JDK/Spring Boot/Batch/Quartz 호환 버전, Discord·HTML 파서·HTTP client 선택 |
| Job/Step 구성 | 후보 처리 단위, 파라미터·작업 식별 기준, Tasklet/chunk 선택, 재시작 지점 |
| 실행 제어 | API 경로·포트·인증·권한, 동시 실행·중복 요청 정책, 종료·중지 동작 |
| cron 운영값 | 표현식 문법·시간대·기본 주기·처리량·오실행/누락 처리 |
| quota 저장 | Python SQLite의 요청 간격·일일 카운터를 대체할 지속 저장 방식 |
| 관측·알림 | 이력 보존, 상태 조회, Discord 실패·재연결·알림 실패 처리 |

기존 Python 구현의 포트 `8787`, 5필드 cron, SQLite, 대기 100건, 이력 30일 등은
현재 구현 선택값이다. 이번 대화에서 Spring 설계의 고정값으로 확정한 것은 아니다.

## 7. 설계 정본 반영 대상

대상 브랜치의 실제 문서 구조를 먼저 확인하고, 현재 진행 중인 변경과 충돌 없이 반영한다.

| 문서 | 반영할 내용 |
| --- | --- |
| [콘텐츠 수집 기획](../../../docs/planning/content-collection/README.md) | 기술·실행 방식에 남은 Python 전제를 수정. 수집 보조와 자동 수집 범위 구분 유지 |
| [서비스 기획](../../../docs/planning/01-service-plan.md) | 로컬 collector 관련 설명에 영향을 주는 부분만 대조 |
| [시스템 아키텍처](../../../docs/system-design/01-system-architecture.md) | Spring 수집 서버와 Boot/Batch/Quartz 역할, 프로세스·장애·접속 경계 |
| [데이터 모델](../../../docs/system-design/02-data-model.md) | Batch 메타데이터와 서비스 DB의 소유권 분리, 미정 저장 위치·quota 반영 |
| [API 설계](../../../docs/system-design/03-api-design.md) | 기존 수집 API 유지, 수집 서버 실행 API와 공개 BFF API 구분, SQLite/cron 전제 재검토 |
| [보안·운영](../../../docs/system-design/05-security-operations.md) | 인증·권한, 스케줄·중복 방지·재시작·종료·알림·요청 제한 |
| [수집 기능 명세](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md) | Python 실행 설명 교체, Spring Job 계약·기존 API 연동·검증 기준 |
| [설계 준비 상태](../../../docs/system-design/README.md) | 설계 결정/정본 반영/구현/검증 상태 분리 |

수신 에이전트는 `Python`, `aiohttp`, `croniter`, `SQLite`, `5필드`, `server.py`, `runtime.py`,
`collector`, `SourceFetcher`를 관련 정본에서 검색해 남은 전제를 확인한다.
과거 worklog는 새 설계에 맞춰 소급 수정하지 않는다. 법무 placeholder와 출시 차단 조건은 유지한다.

## 8. 기존 구현을 참고할 때의 주의점

현재 작업 트리에는 커밋되지 않은 Core·수집 보조 코드와 문서 변경이 함께 있다.
`tools/collector/`는 아직 Python 구현이며 Spring 구현 산출물은 없다.

- [Python 수집기 안내](../../../tools/collector/README.md)는 현재 구현의 참고 자료다.
- 기존 후보 상태, 이미지 검증, API 계약, FE 검수 동작은 전환 시 유지할 자산이다.
- Python의 실행 서버·runner·cron·Discord 코드는 교체 대상이며 지금 삭제하지 않는다.
- 이전 Python/Core 테스트 통과를 Spring 전환의 완료 증거로 승계하지 않는다.
- 이 문서를 반영하기 위해 구현 브랜치 전체 merge/cherry-pick, docs 전체 덮어쓰기를 하지 않는다.
  필요한 결정만 대상 정본에 반영하고 현재 설계 작업을 보존한다.

## 9. 후속 검증 기준과 보고

설계 반영 결과는 **“Spring 수집 서버 전환 설계 반영, 구현 미완료”**로 보고한다.
실제 구현 단계에서는 최소한 다음을 검증해야 한다.

1. cron·API·Discord가 동일 Job 실행 경로를 사용한다.
2. 중복 실행·중복 요청·lease 만료·응답 유실·중간 종료를 처리한다.
3. 실제 API 연동으로 후보 선점 → 결과 제출 → preview → 기존 FE 검수 → 초안 생성이 이어진다.
4. 작업·단계별 이력과 재시작 동작을 확인한다. HTTP 부수 효과의 중복도 별도로 확인한다.
5. 출처 접근 제한·quota·이미지 검증이 유지되고 수집 서버 중단이 공개 BE·FE를 멈추지 않는다.
6. 실제 출처와 Discord 연결 검증, 운영 배포 검증을 로컬 fixture 결과와 구분한다.

설계 문서 작업의 검증은 상대 링크·정본 간 모순·미정 항목 보존·완료 과장·`git diff --check`다.
이번 인계 문서 자체는 배치 구현 또는 런타임 검증 산출물이 아니다.
