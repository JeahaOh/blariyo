# Discord 검수 후 운영 발행 수량 점검

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 02:07 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: 아침·오후에 여러 글을 검수했는데 운영에 일부만 보이는 이유 확인.
- 범위: 운영 DB 읽기 전용 조회, systemd 실행 기록, Discord GET 및 공개 목록 GET, 이 작업 기록 작성. 업무 명령·반응·상태·예약·소스 변경은 실행하지 않는다.
- 한국 시간 현재10/9 새벽이므로 최근 완료된10/8 오전·오후 회차를 대조했다. 기존10/6·10/8 untracked 기록은 보존했다.

## 확인 결과

| 회차 | 실제 실행 | 판정 결과 |
| --- | --- | --- |
| 10/8 07:30 | 07:30:09~07:32:41 | 승인8·반려16·무승인52 |
| 10/8 17:00 | 17:01:11~17:08:51 | 승인0·반려1·무승인122 |

- 승인 명령8개 모두 PUBLISHED, last_error 없음. 반려17개 모두 REJECTED. 접수된 승인 명령의 발행 실패·중간 정체는 없다.
- 승인된 검수번호 #57/#58/#61/#62/#64/#65/#69/#63은 각각 게시글121~128에 연결된다. 실제 board_post 모두 PUBLISHED, 발행 시각10/8 07:32:44~07:33:17 KST.
- 운영 서버에서 공개 `https://blariyo.com/api/v1/boards/meme/posts` GET: HTTP200/success=true, 목록 상단에 게시글128~121 모두 존재. #63은128, #69는127이다. 로컬 Python GET은403이었으므로 그 실패로 공개 목록 장애를 판단하지 않았다.
- 10/9 02:03 DB 집계: READY/UNAPPROVED122, 승인 후정리8·반려 후정리17(cleanup DONE), EXPORTING3, BLOCKED1.
- scan/maintenance service Result=success/exit0. scan timer active, 다음 실행10/9 07:30 KST.

## Discord 현재 반응과 차이

- 삭제되지 않은 DB head126개를 Discord 채널 메시지 조회와 전수 대조했다. 메시지126개 일치.
- 봇 seed 외 반응이 있는 헤드19개: 👍단독14, ❌단독5. 사용자 목록 GET으로 모두 등록 검수자1명·미등록 사람0명임을 확인했다. 봇의 기본 반응 수를 승인으로 세지 않았다.
- 👍14: #127, #128, #129, #130, #131, #133, #134, #135, #136, #137, #139, #140, #141, #150.
- ❌5: #132, #142, #143, #145, #148.
- 위19개는 READY이며 마지막 last_scan_result는UNAPPROVED, 마지막 확인 시각10/8 17:08:07~17:08:49 KST. 지금 반응과 최종 저장 결과가 다른 것이 확인됐다.
- 본문 전체 제외·원본 변경 등을 이 점검에서 다시 판정하지 않았다. 👍14개가 다음 실행에서 반드시14개 발행된다고 보증하지 않는다.
- 반응 사용자 조회 중429가 발생했다. 후속 읽기 전용 조회에서는 Retry-After를 존중해 재조회했고 명령·상태 변경 없이 확인을 마쳤다.

## 원인 판정 범위

- [정책](../../../docs/planning/content-collection/README.md#8-discord-보고실행-연동)과 [기술 계약](../../../docs/system-design/10-discord-review.md)에 따라 반응 판정은07:30/17:00이다.
- [scan claim](../../../apps/api/src/persistence/discord-review.repository.ts)은 완료된 slot을 다시 열지 않는다. [worker](../../../apps/collector/src/main/java/com/blariyo/collector/discordreview/DiscordReviewWorker.java)의 maintain도 이 claim을 사용하므로1분 maintenance가 완료 회차 이후의 새 반응을 재판정하지 않는다.
- 따라서 마지막 항목별 판정 뒤 누른 반응은 다음07:30까지 대기하는 구조다. 현재19개가 발행/반려 명령으로 접수되지 않은 상태와 일치한다.
- 단, 반응의 실제 클릭 시각은 이번 GET 결과 및 영속 관찰 기록으로 확인할 수 없다. [관찰 종료](../../../apps/api/src/persistence/discord-review.repository.ts)에서 원시반응은 지워지고 최신 결과만 남는다. 사용자가17시 이전에 눌렀다고 확인하면 당시 판정 누락/상충 등 추가 조사가 필요하며, 사용자 조작이 늦었다고 단정하지 않는다.
- 오후 검수 시각을 비동기 질문으로 확인 요청했으며 이 기록 시점에는 답변이 없다.
- 자동 발행 중 오류라고 확정할 증거는 없다. 확정된 사실은 승인8개 정상 발행, 현재 사람 반응19개 미접수, 하루2회 판정 후 다음 slot 대기다.

## 별도 전송 장애

- #89/#102/#103은 DISCORD_IMAGE_UNAVAILABLE로 EXPORTING, #44는 DISCORD_EXPORT_UNCERTAIN으로 BLOCKED다.
- 이4개는 위19개 READY 대기와 별개다. 원인 상세·복구는 이번 발행 수량 점검에서 실행하지 않았다.

## 후속 선택지

- 현재 정책 유지: 다음10/9 07:30 회차에서 현재 반응을 재판정한다. 지금 수동 판정은 실행하지 않았다.
- 긴 대기 해소를 원하면 정시 회차와 별도로 준비 완료된 미결정 글의 반응을 짧은 간격으로 재판정하는 정책·설계 변경을 검토한다. 정시slot 완료 상태를 임의 초기화하는 방식은 사용하지 않는다.
- 개발·운영 수정, 강제 발행/반려, 반응 삭제, commit/push는 하지 않았다. 상대 링크·Git diff whitespace·작업 전후 상태를 확인했다. 실행 코드 변경이 없어 build/test는 실행하지 않았다.
