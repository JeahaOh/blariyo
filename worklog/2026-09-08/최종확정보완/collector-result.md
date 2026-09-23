# Spring 수집 설계 보완 결과

- 작업일: 2026-09-08
- 담당: `collector_review`
- 판정: R03~R07 설계 보완 반영·주 검수 승인, `조건부 설계 확정 가능`
- 구현 상태: Spring source·Core/local migration·OpenAPI·test·build·runtime 미구현·미검증
- 수정 전 사본: `/private/tmp/blariyo-spring-finalize.JgdUTU`
- 04·05 위임 직전 사본: `/private/tmp/blariyo-final-policy-spring-sync-before-20260908/04-05-before.tar`

## 반영 결과

| 항목 | 닫은 계약 | 정본 |
| --- | --- | --- |
| R03 preview 응답 유실 | preview의 key·file digest·execution/version fencing, 2xx receipt 7일과 만료 뒤 execution-state 조정, 이미지별 순차 checkpoint와 `PREVIEW_REFRESH` | [Spring 상세 §5·§9·§10](../../../docs/system-design/07-spring-collector-design.md#5-core-api-확장) |
| R04 `/collect status` | local Job과 Core 후보 집계 분리, 기본 24시간·최대 7일, Core 장애 `partial=true`, 읽기 중 claim·Job 생성 금지 | [Spring 상세 §5·§11·§13](../../../docs/system-design/07-spring-collector-design.md#5-core-api-확장) |
| R05 quota 권위 | Core 원자 reservation, 모든 실제 HTTP별 차감, 10초 permit·날짜 경계·전역 `next_request_at`, 응답 유실 same-key·무환불·외부 exactly-once 비보장 | [Spring 상세 §6·§7](../../../docs/system-design/07-spring-collector-design.md#7-quota-권위와-http-계산) |
| R06 lease 회수 | Spring 기본 300초·heartbeat 60초, 실행별 Core mutation 직렬화, 3회·24시간 경계의 직접 재선점/실패 전환, 오래된 worker fencing | [Spring 상세 §8](../../../docs/system-design/07-spring-collector-design.md#8-leaseheartbeat재선점) |
| R07 Spring 전체 상세 계약 | `apps/collector`, 공식 버전, 전용 local PostgreSQL 18, 단건 Tasklet 6 Step·기본 동시 1, encrypted spool, loopback REST, Quartz·launchd·보안·관측·2단계 cutover·rollback | [Spring 상세 전체](../../../docs/system-design/07-spring-collector-design.md) |

기존 BFF `/api/collector/v1/*`와 후보 검수·초안 승격 API를 유지했다. Spring은 서비스 DB와 object
storage에 직접 쓰지 않는다. 기존 5개 collector endpoint에는 호환 가능한 멱등·execution field를 더하고,
읽기·quota·운영 event 4개 endpoint를 같은 중계 아래 추가했다. Python은 신규 claim 중지와 lease drain 뒤
Spring을 활성화하며 둘이 같은 후보를 동시에 소유하지 않는다.

## 선택과 남은 외부 입력

- 기술 기본값은 상세 설계에 선택 이유·대안·되돌리기 조건과 함께 기록했다. 실제 실행 PC·OS 계정·설치
  경로, JDK 배포판, Discord Application과 허용 ID, Core credential, 실제 출처 URL·허용 path·robots·이용
  조건·parser selector·User-Agent 연락처·출처별 interval/daily limit은 외부 사실 또는 운영 승인이라 남겼다.
- `M0 Core` 공개와 local collector 구현·활성화를 분리했다. collector 미구현·중단은 공개 읽기와 관리자 수동
  작성·발행을 차단하지 않는다.
- 같은 host redirect 제한을 유지했다. CDN host 모델을 새로 만들지 않아 기존 SSRF 계약과 충돌하지 않는다.
- Core 전환은 nullable 열·API를 먼저 배포하고 legacy 실행과 preview를 drain/TTL cleanup한 뒤 엄격 CHECK를
  ADD·VALIDATE하는 2단계다. `NOT VALID`도 신규 row에는 적용되므로 1차에 엄격 CHECK를 만들지 않으며,
  재인코딩된 기존 preview bytes로 업로드 원본 hash를 임의 backfill하지 않는다.
- patch 버전은 2026-09-08 공식 자료 확인값이다. JDA·jsoup·선택 JDK 배포판의 실제 조합은 source 작성 뒤
  build·fixture·Discord contract·runtime으로 다시 검증한다.

## 변경 파일

- `docs/planning/content-collection/README.md`
- `docs/system-design/01-system-architecture.md`
- `docs/system-design/02-data-model.md`
- `docs/system-design/03-api-design.md`
- `docs/system-design/04-infrastructure-design.md`
- `docs/system-design/05-security-operations.md`
- `docs/system-design/07-spring-collector-design.md` (신규)
- `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md`
- `docs/task_list/09/08/최종확정보완/check_spring_collector_model.py` (신규)
- 이 결과 문서

`docs/system-design/README.md`는 policy 담당 소유라 직접 수정하지 않았다. 04·05는 파일 소유권을 명시적으로
policy 담당에게 넘겨 07 계약만 최소 동기화했고, 기존 변경을 보존했다.

## 공식 근거

- [Spring Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Spring Boot managed dependencies](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)
- [Spring Batch JDBC JobRepository](https://docs.spring.io/spring-batch/reference/job/configuring-repository.html)
- [Spring Boot Quartz JDBC store](https://docs.spring.io/spring-boot/4.0/reference/io/quartz.html)
- [Oracle Java SE roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html)
- [Gradle releases](https://gradle.org/releases/)
- [jsoup releases](https://jsoup.org/news/)
- [JDA releases](https://github.com/discord-jda/JDA/releases)
- [PostgreSQL 18 ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)

## 검증

| 검사 | 결과 | 의미·한계 |
| --- | --- | --- |
| `check_spring_collector_model.py` | `spring_collector_model_checks=5 issues=0` | 중복 reservation 1회 차감, stale execution 거부, preview 응답 유실, attempt 3 경계, 7일 만료 경계의 문서 불변조건 모델. 앱 테스트 아님 |
| `check_structure.py` | `markdown_files=73 local_links_checked=699 tables_checked=358 issues=0` | Markdown 상대 링크·표 구조 검사 |
| `git diff --check` | 출력 없음 | 추적 파일 whitespace 오류 없음 |
| 신규 파일 `git diff --no-index --check` | whitespace 진단 출력 없음, 파일 차이로 exit 1 | 07·모델 검사·결과 파일에 whitespace 오류 없음 |

commit·push·merge·tag와 source·DB·브라우저·runtime 검증은 수행하지 않았다. 주 에이전트의 최종 계약
검수는 승인됐으며, policy 담당이 07 상태 header와 설계 상태 색인을 최종 반영한다.
