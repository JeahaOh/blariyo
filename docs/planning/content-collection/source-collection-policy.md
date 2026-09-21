# 21개 출처별 수집 정책

모든 출처에 같은 `hot` 목록 정책을 적용하지 않는다. 출처별 정책은 다음 네 가지 중 하나다.

- `HOT_LIST`: 검증된 chart/list URL에서 목록을 발견하고 상세 parser로 이어간다.
- `DETAIL_ONLY`: 목록 자동 발견은 하지 않고, 검증된 공개 상세 URL만 수동·Discord 입력으로 처리한다.
- `BLOCKED`: robots, 접근 차단, 정책, challenge, 권한 문제로 fetch 자체를 실행하지 않는다.
- `UNVERIFIED`: URL 또는 selector가 확인되기 전까지 실행하지 않는다.

| source | 정책 | 목록 URL | 상세 | 현재 사유 |
|---|---|---|---|---|
| arcalive | HOT_LIST | `https://arca.live/b/live` | 승인 후 | POLICY_APPROVAL_REQUIRED |
| bobaedream | HOT_LIST | `https://www.bobaedream.co.kr/list?code=best` | 승인 후 | POLICY_APPROVAL_REQUIRED |
| clien | BLOCKED | 없음 | 차단 | ROBOTS_AGENT_BLOCKED |
| dcinside | BLOCKED | 없음 | 차단 | POLICY_APPROVAL_REQUIRED |
| dmitory | BLOCKED | 없음 | 차단 | POLICY_APPROVAL_REQUIRED |
| dogdrip | HOT_LIST | `https://www.dogdrip.net/dogdrip?sort_index=popular` | 승인 후 | POLICY_APPROVAL_REQUIRED |
| etoland | BLOCKED | 없음 | 차단 | ROBOTS_AGENT_BLOCKED |
| fmkorea | BLOCKED | 없음 | 차단 | ROBOTS_DETAIL_DISALLOWED |
| goodgag | BLOCKED | 없음 | 차단 | ROBOTS_AGENT_BLOCKED |
| humoruniv | BLOCKED | 없음 | 차단 | ROBOTS_DISALLOWED |
| instiz | BLOCKED | 없음 | 차단 | SOURCE_ACCESS_BLOCKED |
| inven | HOT_LIST | `https://www.inven.co.kr/best/issue` | 승인 후 | POLICY_APPROVAL_REQUIRED |
| mlbpark | BLOCKED | 없음 | 차단 | ROBOTS_DISALLOWED |
| natepann | BLOCKED | 없음 | 차단 | ROBOTS_DISALLOWED |
| pgr21 | BLOCKED | 없음 | 차단 | ROBOTS_CHALLENGE |
| ppomppu | BLOCKED | 없음 | 차단 | SOURCE_ACCESS_BLOCKED |
| ruliweb | BLOCKED | 없음 | 차단 | ROBOTS_LIST_DISALLOWED |
| theqoo | DETAIL_ONLY | 없음 | 기존 상세 parser만 | ROBOTS_UNVERIFIED |
| todayhumor | BLOCKED | 없음 | 차단 | ROBOTS_UNVERIFIED |
| yuldo | UNVERIFIED | 없음 | 미확인 | CHART_UNVERIFIED |
| youtube-community | BLOCKED | 없음 | 차단 | PLATFORM_PERMISSION_REQUIRED |

`HOT_LIST`라도 정책 승인 전에는 registry의 `approved=false`, `batchApproved=false`를 유지한다. 목록이 불가능한 출처는 억지로 chart URL을 만들지 않고 `DETAIL_ONLY`, `BLOCKED`, `UNVERIFIED`로 남긴다. 목록과 상세의 요청 간격·페이지 수·글 수는 source별 설정을 따른다.
