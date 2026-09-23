# 관리자 재검토와 후속 계획·GitHub 오류 확인 — 2026-09-23

## 요청과 수행 범위

사용자 요청 순서대로 현재 상태의 커밋 메시지 작성, 전체 잔여 과정 Markdown 작성,
GitHub 실패 실행 확인을 수행했다. 기존 source·test·미추적 파일은 보존했다.
실제 commit·push·배포·GitHub job 재실행은 하지 않았다. 이번 후속 작업은 문서 작성과 읽기 전용 조사다.

- [커밋 메시지 초안](COMMIT-MESSAGE.txt)
- [전체 잔여 과정과 재개 계획](../../../../../docs/implementation/m0-interim-2026-09-23/remaining-process.md)
- [기존 결과](RESULTS.md)는 당시 실행 기록으로 보존한다. 아래 정정이 현재 판정이다.

## 재검토 판정 정정

P0-01/02는 기존 로컬 계약·검사 범위를 유지한다. **P0-03/04는 부분 완료**다.
이전 goal 완료 선언과 로컬 마감 완료 판정은 범위가 과했다. 과거 PASS를 삭제하거나 실패로
소급 변경하지 않고 검증하지 못한 경로와 추가 발견을 분리한다.

| 발견 | 증거·영향 | 필요한 조치 |
| --- | --- | --- |
| 저장 결과 불확실 후 인증 오류에서 요청 키 제거 | `admin.vue`의 execute는 호출마다 confirmed=false로 시작하며 401/403 시 pending/recovery를 제거한다. 앞선 브라우저 mock 재현에서 최초 재시도 key 동일=true, 401 뒤 새 저장 key 동일=false, 복구 UI0, 제목 보존=true. intercepted mutation3·실제 서버 mutation0 | 이전 요청의 불확실 상태·본문·key를 인증 회복까지 보존하고 DB1건을 검증 |
| 로컬 예약/outbox 실행 연결 없음 | `start-development.mjs`는 API/Web만 기동. 관리 업무 검사는 fixture.flush(), 예약 검사는 posts.publishDue()를 직접 호출 | 실제 로컬 실행 구성에서 주기 실행·회수·예약·재시작·중복 방지를 검증 |
| 기존 DB 대기 작업 보호 필요 | 앞선 읽기 전용 확인에서 outbox PENDING47, public 삭제 대기 image0, 지난 예약0. 47건을 모두 실패나 삭제로 단정하지 않음 | 격리 환경 우선. 기존 대기 작업을 무조건 실행하지 않음 |
| 운영자 인수 없음 | 12건 자동 검사와 localhost3000 읽기 확인은 수동 업무 검증을 대신하지 않음 | 운영자 10~20건 수동 처리·시간·클릭 반복·복구 실패 측정 |

이 표의 mock/DB 관측은 바로 앞 재검토의 기록이며 이번 문서 작성 중 다시 실행한 결과가 아니다.
이번에는 현재 execute·로컬 실행기·테스트 worker 호출 source를 다시 대조했다.

## GitHub CI 오류 — 직접 확인

2026-09-23 KST, 로그인된 Chrome의 저장소 Actions와 실패 로그를 읽었다.
로컬 `gh` CLI가 없어 브라우저로 확인했으며 token·쿠키를 추출하지 않았다.

- 대상: [CI #9 / run 35852208616](https://github.com/JeahaOh/blariyo/actions/runs/35852208616)
- commit: `ce25abc8cad1331257479a6ab8c44260eb6bdb68` (`main`), 로컬 HEAD와 동일.
- 시작: 2026-09-23 20:02 KST. 전체 1분30초, verify 1분26초 후 실패.
- 실패 job: [verify 107152288218](https://github.com/JeahaOh/blariyo/actions/runs/35852208616/job/107152288218#step:11:192)
- 실패 step: `node scripts/test-nest-integration.ts --exclude-schema-restore`.
- 영향: 후속 Chromium 실행과 images 게시가 진행되지 않았다. workflow에는 운영 서버 배포 job이 없다.
  **이번 확인 대상은 운영 서버 교체 실패가 아니라 CI 통합 검사 실패다.** 운영 서버 상태는 조회하지 않았다.

### 원인과 현재 로컬 대응

| 오류 | 원인 | 현재 상태 |
| --- | --- | --- |
| ENOENT: `apps/collector/build/fixture-classpath.txt` 없음 | discovery 통합 검사가 Java FixtureParserMain을 실행하지만 CI는 Node build만 수행한다. Collector testClasses/fixtureClasspath 생성 단계가 없으며 해당 build 파일은 Git 제외 대상 | **미수정**. Java 25 설정과 Gradle fixture 준비를 CI의 통합 검사 앞에 추가해야 함 |
| `AssertionError: Missing expected rejection` | V008이 추가된 상태에서 첫 migrate down은 빈 검수 테이블을 정상 제거할 수 있는데 즉시 거부를 기대함 | **로컬 미커밋 수정 존재**. V008 down 성공→V007 down SQLSTATE23514 거부·기존 데이터 보존 검사로 정정. 기존 로컬 해당 suite5건 통과 기록 있음 |

근거 source: [CI](../../../../../.github/workflows/ci.yml),
[discovery test](../../../../../apps/api/test/collection-discovery.integration.test.ts),
[Gradle task](../../../../../apps/collector/build.gradle.kts).
기존 로컬 증거: `test-results/admin-core/integration-complete.log`의 Discovery 5건 pass·0 fail.
현재 로컬 성공은 기존 Java 빌드 파일이 준비된 환경의 결과다. 깨끗한 CI checkout에서 자동 준비되는
것까지 확인하지 못했으므로 **현재 변경을 push하면 CI가 반드시 통과한다는 보장은 없다**.

추가로 `actions/upload-artifact` Node20 대상 action을 Node24에서 실행한다는 warning이 표시됐다.
실패 원인은 위 통합 검사이며 이 warning과 구분한다. action 갱신은 별도 검토 항목이다.
최신 목록의 Backup and restore verification #3(run 35786436064)은 성공으로 표시됐다.
그 결과가 실패한 CI #9 또는 현재 변경의 전체 통과를 의미하지 않는다.

### 다음 수정·검증 순서

1. CI에 Java 25를 명시적으로 준비하고 통합 검사 전에 아래 Gradle task를 실행한다.
   setup action을 추가한다면 저장소의 전체 SHA 고정 원칙을 유지한다.
2. 로컬 `test:nest` 진입점도 fixture 준비 의존성을 명확히 한다. 빈 classpath 파일을 넣거나
   discovery 검사를 제외해 통과시키지 않는다. Collector 운영 이미지/신규 기능 활성화는 필요 없다.
3. 기존 로컬 migration/attachment 계약 정정과 통합해 **기존 build 산출물이 없는 별도 작업 디렉터리**에서
   Java fixture 준비→API compile→격리 PostgreSQL discovery 검사→CI 동등 검사를 수행한다.
4. 이후 명시된 commit/push 권한으로 반영한 새 SHA에서 CI verify·Chromium·API/Web images 결과를 확인한다.
   같은 옛 SHA job 재실행만으로 누락된 준비 단계는 생기지 않는다.

```sh
# Java 25가 설정된 환경, 저장소 루트
apps/collector/gradlew -p apps/collector testClasses fixtureClasspath
```

이번 요청의 '확인' 범위에서 workflow·제품 source는 추가 수정하지 않았다.
CI 수정과 깨끗한 환경 재검증은 잔여 계획에 등록했다. 이 내부 구현 문제를 외부 권한 차단으로 분류하지 않는다.

## 문서·Git 검증

- 오늘 목차와 next-plan의 상태를 정정하고 관리자 개발 명세에 재검토 경계를 연결했다.
- 과거 RESULTS/PROGRESS와 중간 점검의 실행 결과·수치는 보존했다.
- 이번 변경의 상대 파일 링크 존재 검사, `git diff --check` 및 변경 범위 확인을 수행했다.
- build·unit·통합·브라우저 회귀는 이번 문서/읽기 전용 조사에서는 재실행하지 않았다.
- 시작/종료 브랜치: `main...origin/main`. remote fetch·commit·push·배포 없음.

최종 확인: 상대 파일 링크 105개·깨진 링크0, `git diff --check` 통과. 기존 변경을 포함해 tracked 수정15개·untracked 파일13개다. 이번 요청에서는 문서4개 갱신·문서/메시지3개 신설만 수행했다.
