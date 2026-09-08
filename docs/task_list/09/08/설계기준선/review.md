# 설계 기준선 manifest 독립 검수

- 검수일: 2026-09-08
- 대상: `docs/baselines/README.md`, `m0-core.md`, `m0-collection-assist.md`, `m1.md`, `m1-5.md`와 [task.md](task.md)
- 역할: `structure_review` — 범위·선행 관계·상대 링크·앵커·표·상태 표현 검수
- 판정: **통과 — Git 실행 전 manifest 범위와 상태 표현이 task 완료 조건에 맞는다.** 이 판정은 설계 기준선 문서에 한정하며 구현·법무·운영·production 공개 완료를 뜻하지 않는다.

## 검수 근거와 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 단계별 delta·선행 관계 | 통과 | [README.md](../../../../baselines/README.md)의 의존 그래프와 표, [task.md](task.md)의 산출물 표가 `M0 Core → (M0 수집 보조, M1) → M1.5`로 일치한다. M1·M1.5는 수집 보조 tag에 비의존임을 각 manifest가 명시한다. |
| M1/M1.5 기술 절 분리 | 통과 | [m1.md](../../../../baselines/m1.md)은 `06-member-community-design.md`의 M1 절과 §§11·12·14를 포함하고 M1.5 전용 §13을 제외한다. [m1-5.md](../../../../baselines/m1-5.md)은 community·moderation, §§13·15를 포함한다. 원문 heading은 [06-member-community-design.md](../../../../system-design/06-member-community-design.md)에서 대조했다. |
| M0 Core의 광고·제휴 경계 | 통과 (보완 후) | 최초 `m0-core.md:13`의 `§§3~7` 표기는 planning §6 전체를 포함하는 것으로 읽힐 수 있었다. 현재는 `§§3~5·§7`만 포함하고 §6은 “M0 비활성·후속” 경계 문장만 포함한다고 명시한다. 이는 [01-service-plan.md](../../../../planning/01-service-plan.md) 179행의 후속 광고·제휴 정의 및 task의 후속 기능 임의 포함 금지와 맞다. |
| M0 자동 수집 제외 | 통과 | [README.md](../../../../baselines/README.md)의 네 기준선 전체 제외, [m0-collection-assist.md](../../../../baselines/m0-collection-assist.md)의 목록·feed·pagination 자동 발견·scheduler·자동 발행·출처별 활성값 제외가 일치한다. 출처 문서 20개 모두에 ‘자동 수집 실행 시간’ 문구는 있으나, 표본 [arcalive.md](../../../../planning/content-collection/sources/arcalive.md) 101행, 같은 파일 110행, 같은 파일 133행은 각각 `사용하지 않음`, 목록 범위 밖, `자동 수집: 차단`이다. 따라서 출처 파일 전체를 수집 보조 입력으로 포함한 것이 자동 수집 활성화를 포함한다는 모순은 확인되지 않았다. |
| 출처 파일 범위 | 통과 | `sources/*.md` 실제 파일 수 20개와 `m0-collection-assist.md:20`의 명시 목록 20개가 일치한다. 각 파일은 단일 상세 페이지 설계 입력이며 사용 허용 승인은 아니라는 한계도 같은 행과 제외 범위에 남아 있다. |
| M0 Core 수집/Spring 확장 제외 | 통과 | [m0-core.md](../../../../baselines/m0-core.md)의 data model 범위는 수집 보조 resource type·nullable 확장, `SPRING_V2` receipt·보존 행을 명시적으로 제외한다. |
| 같은 commit의 4 tag와 release 분리 | 통과 | [README.md](../../../../baselines/README.md)의 manifest 해석 규칙과 Git/release 분리는 같은 commit의 네 annotated design tag를 허용하되, manifest 범위·선행 기준선으로 의미를 나누고 `app-vX.Y.Z` release metadata와 구현 gate를 별도로 두도록 한다. [task.md](task.md)의 완료 조건 3~4와도 일치한다. |
| Git 실행 상태 | 통과 | manifest의 `기준선 tag`는 식별자 표기다. 실제 생성 전 상태는 [task.md](task.md)의 Git 실행 상태와 `git tag -l 'design/*/v1'` read-only 결과 0개로 확인했다. 기준선 commit·main fast-forward·annotated tag·push를 실행했다는 문구는 검수 대상 파일에서 확인하지 못했다. |

## 기계 검사

명령은 저장소 루트에서 실행했다.

```sh
python3 /private/tmp/check_baselines.py
python3 docs/task_list/09/08/문서정합성/check_structure.py
git diff --check
git tag -l 'design/*/v1' | sort
```

- `/private/tmp/check_baselines.py`는 기존 `check_structure.py`의 Markdown anchor 처리 함수를 재사용해 검사 루트를 `docs/baselines/`와 `docs/task_list/09/08/설계기준선/`으로 바꾼 일회성 검증본이다. 보고서 작성 전 대상 Markdown 7개(기준선 5개, task, 기존 Git 사전검토)에 대해 `local_links_checked=85`, `tables_checked=9`, `issues=0`이었다.
- 기존 구조 검사기는 기준선 디렉터리를 기본 범위에 넣지 않으므로 별도 검사와 구분했다. 정본 네 영역에서는 `markdown_files=73`, `local_links_checked=702`, `tables_checked=358`, `issues=0`이었다.
- `git diff --check`는 출력이 없어 공백 오류가 없었다. tag 조회는 출력이 없어 아직 `design/*/v1` ref가 없음을 확인했다.
- 이 검사는 상대 파일 경로·heading anchor·표 형식·공백만 검증한다. 정본의 제품 결정 타당성, 법률 적정성, source·migration·test·runtime·browser·deployment 증거는 검증하지 않는다.

## Git 실행 전 유지할 조건

1. 기준선 commit과 main fast-forward 뒤에만 네 annotated design tag를 같은 검증된 commit에 생성하고, object type·target commit·annotation·manifest 존재를 readback한다.
2. release metadata에는 구현한 design tag와 미충족 gate를 적으며, design tag 자체를 구현 또는 production 공개 완료 증거로 사용하지 않는다.
3. M0 자동 수집은 별도 manifest와 새 design tag가 생기기 전까지 목록·feed·pagination 자동 발견, scheduler, 자동 발행, 출처별 활성값을 포함하지 않는다.
