# 07 Spring collector 초안 교차 검토

- 검토일: 2026-09-08
- 범위: `docs/system-design/07-spring-collector-design.md`의 신규 Core API와 Job·quota·lease 흐름을 읽고, 상위 `02-data-model`, `03-api-design`, `05-security-operations`, M0 수집 명세와 대조했다.
- 방법: 문서 원문·상대 참조를 직접 읽은 오프라인 설계 검토다. source, migration, OpenAPI, Spring 코드, fault/integration test, 외부 출처·robots·runtime은 아직 없으므로 실행 증거가 아니다.
- 제외: 주 검수에서 이미 수정 요청한 preview lease `NULL`, Quartz claim 뒤 candidate 확정, `NEW` preview 재업로드 mode·권한·quota, claim URL replay 암호화, 자정 quota/permit 시각, legacy fencing 분리는 다시 세지 않았다.

## 추가 설계 차단 1건

### C01 — redirect/CDN 허용 경계가 데이터 계약과 보안 규칙에 없다

- **근거:** [07-spring-collector-design.md](../../../../system-design/07-spring-collector-design.md) 295행은 “source가 허용한 CDN·redirect host” 요청을 허용한다. 그러나 `collect.source`에는 기준 `host`만 있고 CDN/redirect host allowlist 필드가 없다([02-data-model.md](../../../../system-design/02-data-model.md) 634~652행). 상위 보안 계약과 개발 명세는 redirect를 등록 출처와 **같은 host**로 한정한다([05-security-operations.md](../../../../system-design/05-security-operations.md#수집) 173~178행, [collection-assist.dev.md](../../../../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md) 69~76행).
- **영향:** 구현자가 07의 문구를 따르면 어떤 CDN/redirect host가 “허용”되었는지 저장·검증할 기준이 없다. URL gate가 출처 host 이탈을 허용하거나, 반대로 유효한 이미지 host를 임의로 막는 두 구현으로 갈린다. SSRF·출처 요청 경계와 quota 판단도 일관되게 만들 수 없다.
- **최소 수정:** M0 계약을 유지한다면 07의 CDN/redirect host 허용 문구를 같은 등록 host만 허용한다고 바로잡는다. 별도 host 허용이 제품 요구라면 source별 정규화 HTTPS host allowlist의 소유자·변경 권한·DNS/redirect 재검증·quota 귀속을 상위 데이터/API/보안 계약부터 함께 확정해야 한다.
- **판정:** **설계 확정 차단.** 외부 fetch를 구현하거나 Quartz를 켜기 전에 한쪽 계약으로 통일해야 한다. 출시 검증 단계의 단순 테스트 누락은 아니다.

## C01 재검수 — 해결

2026-09-08 보완 뒤 [07-spring-collector-design.md](../../../../system-design/07-spring-collector-design.md) 298행이 redirect를 “원래 source와 같은 host만 허용”한다고 명시한다. 이는 [02-data-model.md](../../../../system-design/02-data-model.md)의 단일 `host` 모델과 [05-security-operations.md](../../../../system-design/05-security-operations.md#수집) 173~178행, [collection-assist.dev.md](../../../../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md) 69~76행의 same-host 규칙에 맞는다. 별도 CDN/redirect allowlist를 설계하지 않는 M0 범위에서는 C01의 구현자 선택 공백이 해소됐다.

## 그 밖의 판정

주 검수에서 이미 다룬 여섯 경계를 제외하면, Job 재시작·response loss·quota reservation·stale fencing·spool 수명·stop·legacy cutover는 07의 step/checkpoint, Core API, 수용 시험에서 서로 참조되어 있다. 이번 빠른 교차 검토에서 위 C01 외에 구현자를 독자 결정으로 몰아 안전성을 바꾸는 추가 큰 공백은 확정하지 않았다. 이는 구현·migration·OpenAPI·fault test가 통과했다는 뜻이 아니며, 07의 541~549행 미검증 항목과 512~539행 수용 시험은 실제 구현 단계에서 별도로 충족해야 한다.

## 개발 명세 동기화 최종 기록

주 검수 승인 범위에서 [collection-assist.dev.md](../../../../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md) 한 파일만 07의 Spring 추가 계약에 맞췄다. 정본 07과 기존 개발 명세의 역할은 다음처럼 분리했다.

- 기존 개발 명세에만 있던 DTO·validation은 보존했다. claim의 `maxItems` 1~5·candidateId일 때 1·빈 items, result의 title 1~300·parserVersion 1~100·warnings 0~20·imageCandidates 1~20·canonical URL 중복/갱신·실패 응답, preview 10MiB/형식/성공 응답, 기존 오류 코드를 다시 확인했다.
- 07의 추가 계약만 연결했다. `SPRING_V2` 2xx receipt 7일, `collectorExecutionId` fencing, `COLLECT`/`PREVIEW_REFRESH`, NEW preview의 lease 비요구, `execution-state`·quota reservation·operational event, loopback local REST, 여섯 Step·single active Job, disabled Quartz, local PostgreSQL 18·AES-GCM spool을 반영했다.
- local metadata·Batch ExecutionContext·Quartz JobDataMap은 최소 참조만 저장한다. 동일 bytes replay에 필요한 title·remote image URL이 든 result payload와 image temp는 07의 보존 기간 안에서 암호화 spool에 둘 수 있음을 분명히 했다.
- 새 수동 `PREVIEW_REFRESH`는 관리자 검수 응답의 candidateId와 current lockVersion을 받고, 같은 execution 자동 restart는 `execution-state`에서 재확인한 version을 쓴다.

수정 전 사본은 `/private/tmp/blariyo-collector-dev-before-sync.md`이며 SHA-256은 `cd64b11b8fef1da83f755a93e5a98ce2d4eb38aae6e98d6279cd0ec2d7b88620`이다. 최종 파일 SHA-256은 `0517a0a8650006aff9632e851ceebb524b16c187a2b208f283ed7a38f9e8e05b`이며 snapshot 대비 `+62/-151`행이다. 감소분은 중복된 구 API 설명을 없앤 것이며, 위 DTO·validation 항목을 삭제한 결과가 아니다.

재현 명령과 결과:

```sh
git diff --check
python3 docs/task_list/09/08/문서정합성/check_structure.py
```

2026-09-08 실행 결과 `git diff --check` 오류 없음, `markdown_files=73`, `local_links_checked=699`, `tables_checked=358`, `issues=0`이다. 이는 Markdown 구조·상대 링크·표 검사 결과이며 source, migration, OpenAPI, Spring 코드, contract/fault test, runtime 또는 실제 출처 검증 결과가 아니다.
