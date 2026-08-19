# Task List

작업 기록과 검증 산출물은 다음 구조로 관리한다.

```text
worklog/task-list/MM/DD/<업무>/
├── TASK.md
├── TASK-02.md        # 추가 검수 기록이 있을 때
└── artifacts/        # 패치, 핸드오프, 검토 초안 등 보조 산출물
```

`staging`, 저장소 이름, `worklog/task-list`를 다시 포함한 중첩 디렉터리는 만들지 않는다.
제품·법무·아키텍처 정본은 각각 해당 문서 영역에 두며, 이 디렉터리는 작업 범위와
검증 결과를 보관하는 비정본 작업 기록이다.

## 2026-08-13

- [AI 협업 체계 검토](08/13/ai-governance/TASK.md)
- [AI 협업 체계 독립 재검수](08/13/ai-governance/TASK-02.md)
- [문서 정보 중립화](08/13/document-sanitization/TASK.md)
- [민감 로그 긴급 차단](08/13/security-hotfix/TASK.md)
