# 과거 기록·검증·복구 자료

[현재 안내](../README.md) · [분야별 결과](../session-tasks/README.md)

여기의 구현 상태·승인 조건·CI 결과는 각 기록 시점의 사실이다. 최신 선택은 설계 보관과 로컬 폐기이며, 과거 계획을 자동 실행하지 않는다.

| 시점·묶음 | 보관 내용 | 시작 문서 |
| --- | --- | --- |
| 2026-09-25 초기 구현 | 최초 요청, 구현·검증 결과, 당시 진행 상태, 브랜치·develop 결정, lint 검토 | [구현 기록 안내](2026-09-25-implementation/README.md) |
| 2026-09-26 T0/T1 취소 | 통합 계획·요청·임시 변경과 취소 증거 | [취소 기록](2026-09-26-t0-t1-cancelled/README.md) |
| 2026-09-26 전체 조사 | 32개 issue, 495개 경로, 당시 Git·CI 관측 | [issue 목록](2026-09-26-full-inventory/README.md) |
| 2026-09-26 S01 백업 | Git bundle, 변경 원문, fixture, 설정과 복원 검사 | [백업 안내](2026-09-26-s01-a-backup-145815/README.md), [복원 방법](2026-09-26-s01-a-backup-145815/RESTORE.md) |
| 2026-09-26 로컬 폐기 | 삭제 목록·원문 대조·보존 검증, 삭제 직전 메타데이터 백업 | [폐기 기록](2026-09-26-local-cleanup/README.md) |
| 2026-09-26 문서 재구성 | 이전→현재 경로와 링크 수정, 원본 보존·체크섬 검증 | [이동 목록](2026-09-26-document-layout/manifest.json), [검증 결과](2026-09-26-document-layout/verification.json) |

세션 요청서는 [requests](../session-tasks/requests/README.md), 실제 실행 결과는 [세션 안내](../session-tasks/README.md)에서 찾는다.
기존 백업·증거 묶음의 경로와 체크섬을 유지했다. `private/`의 원문 설정·메타데이터는 로컬 백업이며 Git 제외 상태를 유지한다.
