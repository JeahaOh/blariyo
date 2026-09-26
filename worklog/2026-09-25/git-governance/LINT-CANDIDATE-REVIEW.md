# Lint baseline candidate 검토 자료

- 작성일: 2026-09-25 KST
- 상태: 아래 현황은 최초 candidate 검토 시점 기록이다. 후속 처리 결과는 다음과 같다.

## 후속 조치 결과 (2026-09-25)

- SQLFluff scope를 migration 전용 17개에서 저장소 전체 추적 SQL 27개로 넓혔다.
- 최초 migration 434건과 배포 SQL 28건을 모두 정리했고, 현재 SQLFluff 위반은 0건이다.
- API·Collector·콘텐츠 migration 17개의 이전·현재 SHA-256을 계약에 기록했다. API·Collector migration runner와 콘텐츠 migration 검사는 기존 ledger에 저장된 과거 해시만 전환 호환으로 허용하며, 알 수 없는 해시는 계속 거부한다.
- `deploy/postgresql/create-roles.sql`과 `create-batch-role.sql`의 `:'password'`는 psql 입력 치환 문법이라 SQLFluff PostgreSQL parser가 해당 행을 파싱하지 못한다. 비밀번호 구문은 유지하고 해당 네 행에만 `noqa: PRS`를 붙였다. 나머지 파일 lint는 계속 적용한다.
- 위 검토 snapshot과 권고는 이 후속 정리 전 기록으로 보존한다.

## 최초 candidate 검토 snapshot

- 당시 기준: `.quality/baseline.candidate.json`, 비보호 파일 Prettier/CSS whitespace 포맷과 Markdown 중복 heading 형제 범위 정책 적용 뒤 생성.
- 당시 상태: 검토 자료. 승인·면제 목록이 아니다.
- 당시 검증: `npm run lint:all`은 미승인 SQL 후보에서 차단됐다.

## 현황

| 도구 | 위반 수 | 분포 | 검토 관점 |
| --- | ---: | --- | --- |
| SQLFluff | 434 | LT02 들여쓰기 321, LT05 줄 길이 71, CP05 자료형 표기 28, CP02 키워드 표기 8, CP04 함수 표기 6 | SQL formatter의 공백·대소문자 수정이 migration checksum 17개를 바꿔 `migration-contracts.test.ts`를 실패시켰다. 전부 원복했고 hash 검증을 통과시켰다. 이 migration에는 자동 포맷을 다시 적용하지 않는다. |
| Stylelint | 0 | 수정 후 0건 | whitespace 240건, media feature range 8건, specificity 순서 17건을 모두 정리했다. specificity 순서 문제는 화면·컴포넌트별 규칙을 cascade 우선순위대로 배치해 해결했고 규칙은 유지했다. |
| markdownlint | 0 | 수정 후 0건 | Collector 검토 보고서 세 행의 블록 수·미디어/SNS 셀을 열에 맞게 복구했다. |
| **합계** | **434** | SQL 434 + CSS 0 + Markdown 0 | Prettier 미포맷은 0건. SHA-256 계약 파일은 `.prettierignore`의 정확한 경로로 제외했다. |

## 검토 후 정리

- SQL 434건은 `apps/api/migrations/`, `apps/collector/src/main/resources/db/`, `scripts/content/migrations/`의 17개 migration 파일에 분포한다. 항목은 LT02 들여쓰기 321, LT05 줄 길이 71, CP05 자료형 표기 28, CP02 식별자 표기 8, CP04 함수 표기 6이다. 자동 수정 시 migration checksum 계약 17개가 깨져 변경을 되돌렸다. 승인은 lint 허용을 뜻할 뿐 migration 변경 허가가 아니며, 각 항목에 유지보수 owner·사유·만료일을 지정하기 전까지 gate를 열지 않는다.
- CSS media feature range 8건은 구간 의미를 유지하는 CSS range context 표기로 고쳤다. specificity 순서 17건은 component의 기본 selector 뒤에 더 구체적인 hover/focus 규칙을 배치해 해결했다. Stylelint 규칙은 유지했고, CSS 변경 뒤 Web production build와 전체 browser suite 43/43를 통과했다. 관리자 recovery 회귀의 잘못된 메뉴 selector도 실제 공개 사이트 링크에 맞게 수정했다.
- Markdown 24건을 정리했다. API 명세 강조문·heading 단계·H1·명세 표·설계 비교표를 수정했고, Collector 검토 자료 세 행은 원문 결과 필드와 대조해 열 정렬을 복구했다.
- draft는 487건에서 434건으로 줄었다. 434개 SQL 항목은 모두 `draft-needs-review`이며 owner/reason/expiry 승인값이 없다.

### SQL path breakdown

| 파일 | 건수 | 규칙 분포 |
| --- | ---: | --- |
| `apps/api/migrations/V001__core.sql` | 95 | LT02 68, LT05 25, CP05 1, CP02 1 |
| `apps/api/migrations/V002__meme.sql` | 1 | LT05 1 |
| `apps/api/migrations/V003__schedule_alert.sql` | 14 | LT02 14 |
| `apps/api/migrations/V004__collection_assist.sql` | 60 | LT02 44, LT05 14, CP04 2 |
| `apps/api/migrations/V005__spring_collection.down.sql` | 1 | LT05 1 |
| `apps/api/migrations/V005__spring_collection.sql` | 39 | LT02 25, LT05 11, CP05 3 |
| `apps/api/migrations/V006__collection_content.sql` | 4 | LT02 4 |
| `apps/api/migrations/V007__collection_discovery.down.sql` | 1 | LT02 1 |
| `apps/api/migrations/V007__collection_discovery.sql` | 9 | LT02 8, CP04 1 |
| `apps/api/migrations/V008__batch_review.sql` | 24 | LT02 20, LT05 2, CP05 1, CP02 1 |
| `apps/collector/src/main/resources/db/collector-v001.sql` | 42 | LT02 30, LT05 9, CP05 2, CP04 1 |
| `apps/collector/src/main/resources/db/collector-v002.sql` | 50 | LT02 41, CP05 6, LT05 1, CP04 2 |
| `apps/collector/src/main/resources/db/collector-v003.sql` | 14 | CP05 8, LT02 6 |
| `apps/collector/src/main/resources/db/collector-v004.sql` | 5 | LT02 3, LT05 1, CP05 1 |
| `apps/collector/src/main/resources/db/collector-v005.sql` | 32 | LT02 26, LT05 2, CP05 3, CP02 1 |
| `apps/collector/src/main/resources/db/collector-v006.sql` | 27 | LT02 17, CP02 3, LT05 4, CP05 3 |
| `scripts/content/migrations/001_source_capture.sql` | 16 | LT02 14, CP02 2 |

## 승인 전 처리 권고

1. **바로 승인하지 않는다.** candidate 전체에 공통 사유를 붙여 일괄 허용하면 의미가 다른 위반이 함께 면제된다.
2. **콘텐츠·동작 가능성이 있는 항목을 먼저 고친다.** Markdown 표 열 수와 emphasis-as-heading, CSS 수정 전 cascade 우선순위와 화면 경계를 확인한다.
3. **hash-locked SQL은 수정하지 않는다.** formatting-only diff도 migration immutability 계약 위반이므로 승인 baseline이 필요하면 해당 책임자·사유·만료일을 기록한다. 변경이 불가피하다면 SQL lint 완화가 아니라 별도 migration 재설계와 운영 계약 검토가 필요하다.
4. **화면 동작이 달라질 수 있는 CSS는 검토 후 수정한다.** CSS cascade 우선순위 순서를 정리하고 Stylelint 0건을 확인했다. table/heading 오류도 원문 의미와 링크를 대조했다.
5. **남은 legacy만 개별 승인한다.** 각 지문에 책임자, 구체적인 사유, 만료일을 지정하고 승인본을 별도 검토·보호한다. 새 위반은 계속 실패해야 한다.
6. 각 수정/승인 후 `npm run lint:all`, 영향 테스트와 `.quality/baseline.candidate.json` 재생성을 실행한다. 최종 candidate와 승인본의 fingerprint·tool/config policy가 일치해야 한다.

## 당시 gate 상태 (최초 후보 검토 시점)

- `.quality/baseline.json` 승인본이 없고 candidate 각 항목의 owner/reason/expiry는 비어 있다.
- `lint:all`은 434건을 모두 차단한다. 이번 자료는 gate를 완화하지 않는다.
- 승인 담당자·사유·만료일은 지정되지 않았다. 이 자료만으로 승인하지 않는다.
