# 블라리요 Discord 서버 입력 템플릿·준비 안내

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/collection-schedule-0430-1530` / 기준 HEAD: `d2139f3`
- 상태: 종료 — 입력 템플릿 작성·정적 검사 완료, 실연동 미실행 / 작성: 2026-10-07 21:18 KST / 갱신: 21:20 KST
- 요청: 블라리요 전용 서버의 입력 템플릿과 필요한 정보 안내. 앞선 검수 대화에 따라 **Discord 서버(guild)**로 해석했다. 호스팅 VM 접속 정보를 수집하는 양식이 아니다.
- 변경 경로: 이 안내와 `discord-server.template.json`만. [상세 설계](DETAILED-DESIGN.md) 기준이며 앱 설정·봇 초대·권한 변경·전송·토큰 발급을 실행하지 않는다.

## 1. 입력할 파일

**환경별 입력 파일의 null을 실제 값으로 채운다.** 템플릿은 양식 원본으로 보존한다.

| 파일 | 입력 범위 |
| --- | --- |
| [discord-server.production.json](discord-server.production.json) | 운영 서버·채널·봇·검수자: `production` 항목 |
| [discord-server.local.json](discord-server.local.json) | 로컬 테스트 서버·채널·봇·검수자: `local_test` 항목 |
| [discord-server.template.json](discord-server.template.json) | 두 환경을 담은 양식 원본 |

환경별 파일은 해당 환경 정보만 포함하며 확정 정책 참조값은 동일하다. 이 파일들은 정보 전달용 양식이며 아직 실행 프로그램이 읽는 설정 파일이 아니다. 작성만으로 봇이나 발행 기능이 활성화되지 않는다.

각 항목 바로 앞의 **`_help_항목명`은 의미·확인 위치·입력 방법 안내**다. 예를 들어 `_help_guild_id`를 읽고 그 아래 `guild_id`에 값을 입력한다. `_help_` 안내문은 실제 값으로 바꾸지 않는다. JSON 주석 대신 안내용 속성을 사용해 표준 JSON 문법을 유지했다.

- ID는 문자열로 입력한다. JSON 숫자로 입력하면 긴 Discord ID의 정밀도를 잃을 수 있다.
- 모르는 값은 `null`로 남긴다. 서버/채널 이름이나 초대 링크로 ID를 대신하지 않는다.
- true/false 항목은 확인 후 입력하며 미확인 상태는 null이다.
- `agreed_policy_reference`는 이미 확정한 시간·정책의 참고값이다. 이번에 다시 입력하거나 결정할 항목이 아니다.
- 사용자 ID도 운영 설정 정보이므로 공개 문서/저장소에 옮기지 않는다. **Bot Token, Client Secret, 비밀번호, 인증 코드는 이 JSON이나 채팅에 넣지 않는다.**

## 2. 필요한 정보

| 항목 | 필요 시점 | 어디서 확인/무엇을 입력하는가 |
| --- | --- | --- |
| `production.guild_id` | 지금 | 만든 블라리요 Discord 서버의 ID |
| `production.review_channel_id` | 지금 | 운영 게시물이 올라갈 일반 텍스트 채널 ID. 이름 제안: `수집-검수` |
| `production.reviewers[].discord_user_id` | 지금 | 실제 승인·반려할 본인의 Discord 사용자 ID. 닉네임 아님 |
| `bot.application_id` | 봇 준비 시 | Developer Portal에서 선택한 Application의 General Information → Application ID |
| `bot.bot_user_id` | 봇 준비 시 | 서버에 들어온 봇 사용자 ID. 복사한 실제 값 입력 |
| `bot.installed_in_guild` | 봇 초대 후 | 해당 환경 봇이 해당 guild에 설치됐는지 확인 |
| `bot.channel_permissions_checked` | 권한 설정 후 | 지정 채널에서 아래 권한을 확인했는지. 실제 동작 시험과는 별도 |
| `reviewers[].internal_admin_reference` | 구현·연결 시 | 기존 블라리요 관리자와 연결할 내부 계정 참조. 개발자가 실제 인증 설정과 대조하며 값을 추측하지 않음 |
| `optional_reviewer_role_id` | 선택 | 채널 접근 관리용 역할을 만들었다면 역할 ID. 비워도 개인 ID 등록 방식으로 구성 가능 |
| `secret_readiness.bot_token_stored_privately` | 연동 직전 | 해당 환경 bot token을 비공개 저장했는지만 true/false로 표시 |
| `secret_readiness.bot_token_secret_location` | 연동 직전 | 개발자가 참조할 비공개 파일 경로 또는 secret 항목명만. 값·토큰이 들어간 URL은 금지 |
| `local_test.*` | 테스트 연동 전 | 같은 종류의 로컬 테스트 서버/채널/봇/검수자 정보 |

**지금은 서버 ID·운영 채널 ID·본인 사용자 ID 3개부터 채우면 된다.** 봇이 아직 없으면 봇 관련 값은 null로 둬도 된다. 실행 시에는 해당 환경의 필수 ID·봇 토큰·관리자 매핑·권한 검증이 모두 갖춰져야 한다.

## 3. ID 복사 방법

1. Discord PC 앱 → **사용자 설정 → 고급 → 개발자 모드**를 켠다.
2. 서버 아이콘 우클릭 → **서버 ID 복사** → `guild_id`.
3. 검수 채널 우클릭 → **채널 ID 복사** → `review_channel_id`.
4. 본인 프로필/메시지 작성자 우클릭 → **사용자 ID 복사** → `discord_user_id`.
5. [Discord Developer Portal](https://discord.com/developers/applications)에서 봇 앱을 선택하고 Application ID를 확인한다. 봇 사용자 ID는 봇 프로필에서 복사한다.

공식 안내: [서버·채널·사용자 ID 찾기](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID), [Application ID 찾기](https://support-dev.discord.com/hc/en-us/articles/360028717192-Where-can-I-find-my-Application-Team-Server-ID).

## 4. 서버·채널 구성

- 서버를 추가로 만들 필요는 없다. 같은 블라리요 서버에 **운영 `수집-검수` / 로컬 `수집-검수-테스트`** 채널을 각각 두는 구성을 권고한다. 채널명은 제안이며 실제 생성 여부는 미확인이다.
- **일반 텍스트 채널(GUILD_TEXT)**을 사용한다. 현재 설계는 텍스트 채널에 헤드를 쓰고 그 메시지의 스레드를 생성하는 방식이며 포럼/공지/음성 채널을 입력하지 않는다.
- 운영/로컬의 channel ID·봇 앱/credential·API/DB는 분리한다. guild ID와 검수자 ID는 같아도 된다. 각 봇은 자기 환경 채널만 볼 수 있게 한다.
- 검수 채널은 검수자와 해당 봇이 볼 수 있게 설정한다. 다른 역할/개별 권한에서 다시 허용돼 있지 않은지도 확인한다. 채널 아래 PUBLIC_THREAD는 부모 채널 접근 권한을 따르며 전체 인터넷에 공개하는 설정을 뜻하지 않는다.
- 검수자는 채널 보기·메시지 기록 보기·반응 추가 권한을 갖게 한다. 역할 보유 자체가 발행 권한은 아니며 내부 관리자에 연결된 사용자 ID만 승인자로 인정한다.
- 봇은 [공식 봇 생성 안내](https://docs.discord.com/developers/quick-start/getting-started)에 따라 Developer Portal에서 앱을 만들고 서버 설치(Guild Install)로 초대한다. 현재 기능은 bot 권한을 사용하는 REST 방식이며 수정용 slash command/입력창은 범위 밖이다.
- 현재 설계는 Gateway 상시 연결을 쓰지 않으므로 온라인 표시만으로 연결 성공/실패를 판단하지 않는다. Presence/Server Members/Message Content 등 privileged intent를 일괄 켜는 것을 준비 조건으로 요구하지 않는다.

## 5. 봇 권한 — 검수 채널 범위

| Discord 권한 | 목적 |
| --- | --- |
| `VIEW_CHANNEL` | 지정 검수 채널 접근 |
| `SEND_MESSAGES` | 헤드 작성 |
| `SEND_MESSAGES_IN_THREADS` | 본문과 삭제 실패 안내 작성 |
| `READ_MESSAGE_HISTORY` | 저장한 메시지 확인·반응 조회·전송 복구 |
| `ADD_REACTIONS` | 👍·❌ 기본 반응 추가 |
| `ATTACH_FILES` | 검수 이미지 첨부 |
| `CREATE_PUBLIC_THREADS` | 헤드 아래 본문 스레드 생성 |
| `MANAGE_THREADS` | 스레드 삭제·보관/잠금 상태 처리 |
| `MANAGE_MESSAGES` | 준비 완료 전 잘못 붙은 사람의 헤드 반응 제거. 봇 자기 메시지 삭제만을 위한 요구는 아님 |

- `ADMINISTRATOR`는 필요하지 않다. 역할 편집·서버 관리·Webhook 관리·음성 권한도 이번 기능의 필수 권한이 아니다.
- `EMBED_LINKS`는 링크 자동 미리보기를 사용하기로 할 때 선택이다. 기본 제목·출처 텍스트/이미지 첨부만으로는 필수로 두지 않는다.
- 채널의 deny가 역할 allow를 덮을 수 있으므로 봇 역할 목록만 보지 말고 실제 대상 채널의 유효 권한을 확인한다.
- 공식 근거: [권한 목록](https://docs.discord.com/developers/topics/permissions), [스레드 접근·관리](https://docs.discord.com/developers/topics/threads), [다른 사용자의 반응 제거](https://docs.discord.com/developers/resources/message#delete-user-reaction).

### Developer Portal에서 체크할 항목

현재 봇이 직접 작성한 검수 메시지를 정기 REST 조회하는 설계 기준이다. 다른 봇/사용자의 일반 채팅을 읽거나 실시간 Gateway 기능을 붙이는 설정으로 확대하지 않는다.

| 메뉴 | 항목 | 설정 |
| --- | --- | --- |
| Bot → Authorization Flow | Public Bot | OFF: 앱 소유자가 자기 서버에만 설치하는 전용 봇 |
| Bot → Authorization Flow | Requires OAuth2 Code Grant | OFF: 사용자 OAuth 로그인 절차를 사용하지 않음 |
| Bot → Privileged Gateway Intents | Presence Intent | OFF |
| Bot → Privileged Gateway Intents | Server Members Intent | OFF |
| Bot → Privileged Gateway Intents | Message Content Intent | OFF: 현재 범위에서는 필요 없음 |
| Installation → Installation Contexts | Guild Install | ON |
| Installation → Installation Contexts | User Install | OFF |
| Installation → Install Link | None | 공개 설치 버튼 대신 아래 OAuth2 URL Generator로 직접 초대 |
| OAuth2 → URL Generator → Scopes | bot | 선택 |

- OAuth2 URL Generator의 Bot Permissions에서 위 표의 9개 권한을 선택한다. 화면 표기는 View Channels, Send Messages, Send Messages in Threads, Read Message History, Add Reactions, Attach Files, Create Public Threads, Manage Threads, Manage Messages다.
- `applications.commands`는 현재 반응 검수 기능에서 별도로 사용할 필요가 없다. Discord가 bot scope와 함께 기본 포함하는 경우 그것만으로 오류는 아니며 slash command를 등록/활성화하지 않는다. `identify`, `email`, `guilds`, `webhook.incoming` 등 사용자 인증 scope는 추가하지 않는다.
- 생성된 bot 설치 링크를 앱 소유자 계정으로 열고 블라리요 서버를 선택한다. Public Bot OFF이므로 다른 계정에 공개 설치를 맡기는 흐름이 아니다. 채널 권한은 설치 후 해당 채널에서도 확인한다.
- 전용 봇은 Installation의 Install Link를 None으로 저장한 뒤 Public Bot을 OFF로 설정하고 OAuth2 URL Generator 링크를 사용한다. None은 앱 프로필의 공개 ‘Add App’ 버튼을 숨기는 선택이다. [설치 링크 종류](https://docs.discord.com/developers/resources/application#install-links)
- Bot 페이지의 권한 계산기 체크만으로 이미 설치된 서버/채널 권한이 자동 변경됐다고 간주하지 않는다. 설치 권한 요청과 실제 채널 권한은 구분한다.
- Public Bot의 의미와 code grant는 [공식 OAuth2 안내](https://docs.discord.com/developers/topics/oauth2), 설치 종류/의도는 [공식 봇 설정 안내](https://docs.discord.com/developers/quick-start/getting-started)를 확인했다. 실제 계정의 체크 상태는 아직 조회하지 않았다.

## 6. 비밀값·개발자 준비 항목

- **필요한 비밀값:** 운영 bot token, 테스트 bot token. Developer Portal의 각 Bot 설정에서 관리하며 실제 값은 기존 비공개 secret 관리 경로에 저장한다. 폴더·파일이 아직 없으면 임의 경로를 존재하는 것처럼 적지 않는다.
- **지금 필요하지 않은 값:** 사용자 계정 token/비밀번호, Discord OAuth Client Secret, 공개 interaction endpoint, webhook URL, SSH 비밀번호. 현재 검수는 bot REST이며 사용자 로그인/OAuth 수정 UI는 개발하지 않는다.
- 개발자가 준비할 것: 전용 BATCH→API 인증키와 scope, 내부 API origin/공개 경로 차단, Discord 사용자→기존 관리자 매핑, 환경 검증, 기능 flag, bot token의 API 비동기 삭제 실행기/BATCH 비공개 주입. 이 인증키는 사용자가 Discord에서 찾아오는 값이 아니다.
- 템플릿에는 토큰 저장 여부와 참조 위치만 남긴다. 값을 채워 넣은 뒤에도 문서/로그/커밋에 비밀이 포함되지 않아야 한다.

## 7. 입력 이후 확인·통과 기준

실제 연결/시험은 이 템플릿 작성과 별도 작업이다. 현재 값도 연결 결과도 확인하지 않았다.

1. 입력 검토: ID가 따옴표 문자열인지, 운영/로컬 channel과 bot이 분리됐는지, 채널 종류·검수자와 내부 관리자 연결이 맞는지 확인한다.
2. 연동 조회: token의 실제 bot 신원, guild 가입, 채널 소속/권한을 대조한다. 서버를 만들었다는 사실만으로 봇 설치 완료로 기록하지 않는다.
3. 테스트 채널 검증: 테스트 헤드/스레드·이미지·각 👍/❌, 사람/봇 구분, 혼합 헤드 무승인, 본문 제외, 삭제를 확인한다. 운영 실제 게시글의 발행 시험으로 대체하지 않는다.
4. 복구 검증: 관리자 commit 후 TX 밖 비동기 삭제, rollback 시 삭제 없음, 삭제 실패 2회 안내, 스레드 권한 오류, API/BATCH 재시도와 중복 발행 방지를 확인한다.
5. 중단 기준: 환경/채널/검수자 불일치나 권한 부족이면 해당 자동화 시작을 막는다. 임의로 ADMINISTRATOR를 부여해 통과시키지 않는다.

## 8. 이번 작성 기록

- 산출물: JSON 입력 양식 1개와 설명/확인 기준 1개. 확정 일정·관리자 우선·TX 밖 비동기 정리 정책을 포함한다.
- 미실행: Discord 서버/채널 조회, 봇 생성·초대·권한 수정, token 발급/읽기, 메시지 전송/삭제, 구현·설정·DB·운영 변경.
- 검증: JSON 파싱, ID/secret 미입력 상태, 확정 정책 참조값, 로컬 링크 2개 존재·공백 검사, `git diff --check` 통과. 전후 Git 상태를 확인했으며 이번 변경은 위 2개 새 파일뿐이다. placeholder는 미정이며 실행 가능한 환경으로 보고하지 않는다.

## 9. 후속 요청 — 운영·로컬 입력 파일 분리

- 담당: Codex / 동일 작업 폴더·브랜치. 요청: 템플릿 외에 운영/로컬 파일도 생성.
- 변경 경로: `discord-server.production.json`, `discord-server.local.json` 생성과 이 안내 갱신. 원본 템플릿은 수정하지 않는다.
- 결과: 운영 파일은 production, 로컬 파일은 local_test 정보만 보존하고 environment를 명시했다. 현재 템플릿에 실제 ID/비밀값이 없음을 확인했으며 임의 값을 채우지 않았다. 정책 참조값은 원본과 동일하다.
- 상태: 종료 / 갱신: 2026-10-07 21:22 KST. JSON 파싱·환경 분리·원본 항목/정책 일치·로컬 링크·공백 검사와 `git diff --check` 통과. 전후 Git 상태 확인·기존 변경 보존. 외부 호출·실행 설정 변경 없음.

## 10. 후속 요청 — 항목별 확인 위치 표시

- 담당: Codex / 동일 폴더·브랜치 / 갱신: 2026-10-07 21:25 KST
- 요청: guild_id의 의미와 각 항목을 어디에서 가져오는지 파일에 표시.
- 변경: 운영·로컬·템플릿 JSON의 각 키 앞에 `_help_` 안내를 추가했다. 사용자 입력값·null·확정 정책값은 전부 보존했다. 이 안내에 입력 방법을 추가했다.
- 확인: 수정 전후 안내 속성을 제외한 JSON 값을 비교해 동일함을 검증했다. 운영 `production.bot.bot_user_id`에는 숫자 ID 형식이 아닌 값이 있음을 확인했으며 값을 출력/복제하거나 임의 교체하지 않았다. 사용자가 봇 프로필의 ‘사용자 ID 복사’ 값으로 교체해야 한다.
- 상태: 종료 — JSON 3개 파싱·120개 안내 속성의 인접 배치/내용 존재·기존 값 보존·로컬 링크·공백 및 `git diff --check` 통과. 전후 Git 상태 확인. Discord 실연동·설정 변경 없음.

## 11. 후속 안내 — 봇 설정 체크 항목

- 담당: Codex / 동일 폴더·브랜치 / 갱신: 2026-10-07 21:32 KST
- 요청: 봇 설정에서 체크할 항목 안내. 5절에 Bot/Installation/OAuth2 설정과 권한 선택 위치를 추가했다. 현재 REST·자체 메시지·등록 사용자 방식에 맞춰 privileged intent는 OFF로 안내한다.
- 상태: 종료 — 공식 문서·기존 설계 대조 및 안내 작성. 로컬 링크·공백 검사와 `git diff --check` 통과, 기존 변경 보존 확인. 실제 Discord 설정/사용자 JSON/토큰은 변경하지 않았다.

## 12. 후속 안내 — 설정 화면 확인과 비공개 앱 저장 오류

- 담당: Codex / 동일 폴더·브랜치 / 갱신: 2026-10-07 21:39 KST / 상태: 종료.
- 화면 확인: 필수 권한 9개는 체크되어 있다. 추가 체크된 메시지 고정·모두 멘션하기·외부 이모지 사용·외부 스티커 사용·투표 만들기 5개는 해제를 안내한다. 화면의 권한 선택은 실제 서버 권한 적용 증거가 아니다.
- 사용자 오류: 비공개 애플리케이션은 기본 승인 링크를 가질 수 없다는 저장 오류. Installation의 Install Link를 None으로 먼저 저장하고 Bot에서 Public Bot을 OFF로 저장하는 순서를 안내한다. 저장되지 않은 Bot 변경 때문에 이동이 막히면 해당 미저장 변경을 취소하고 설치 탭부터 처리한다.
- 근거: Discord 공식 Application 문서의 Install Links 설명을 다시 확인했다. 실제 설정 변경·오류 해소·서버 설치는 미확인이다. 작업 기록만 추가하며 사용자 입력 JSON은 변경하지 않는다.

## 13. 후속 안내 — 설정 저장 후 서버 초대

- 담당: Codex / 동일 폴더·브랜치 / 갱신: 2026-10-07 21:42 KST / 상태: 종료.
- 사용자 보고: 설정 저장 완료. 다음 단계로 OAuth2 URL 생성기의 bot 범위·기존 필수 권한 9개를 선택하고 소유자 계정으로 블라리요 서버에 초대하도록 안내한다.
- 초대 후 확인: 서버 멤버 목록에서 봇 확인, 숫자 사용자 ID를 bot_user_id에 입력, 설치 확인 후 installed_in_guild를 true로 입력. 실제 채널 권한 확인 전 channel_permissions_checked를 true로 바꾸지 않는다.
- 검증 범위: Discord 공식 OAuth2 문서 재확인과 안내 기록만 수행. 초대·권한 적용·사용자 JSON 변경·실연동은 수행하지 않았다.

## 14. 후속 안내 — 서버 추가 후 검수 채널 접근

- 담당: Codex / 동일 폴더·브랜치 / 갱신: 2026-10-07 21:45 KST / 상태: 종료.
- 사용자 보고: 봇은 서버에 추가했으나 원하는 채널에 보이지 않음. 텍스트 채널은 별도 입장이 아니라 채널별 권한으로 접근하며, 채널 편집의 권한에서 봇 멤버에 필수 9개 권한을 허용하도록 안내한다.
- 다음 입력: 대상 채널 ID를 review_channel_id에 기록. 초대만으로 자동 메시지를 보내지는 않으며 검수 자동화 구현·연동 확인은 별도다.
- 검증: 공식 Permissions 문서 확인, 작업 기록 공백 검사. 실제 Discord 권한 조회·수정·전송 및 사용자 JSON 변경은 하지 않았다.

## 15. 입력값 정적 검토 — 사용자 입력 후

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/collection-schedule-0430-1530` / 갱신: 2026-10-07 21:53 KST / 상태: 종료.
- 범위: 운영·로컬·원본 템플릿의 JSON 파싱, 중복 키, ID 형식, 환경 분리, 정책 일치와 준비 누락 검토. 입력 파일은 변경하지 않았다.
- High: `discord-server.production.json:25`의 bot_user_id는 숫자 ID 대신 인증 부분이 있는 Discord 웹훅 URL이다. 원문을 출력·복제·호출하지 않았다. 봇 프로필에서 복사한 숫자 사용자 ID로 교체해야 하며 이 URL을 Git/채팅에 공유하지 않는다. 외부 유출은 확인하지 않았으며, 외부에 공유했다면 해당 웹훅 폐기·재생성이 필요하다.
- Medium: 두 환경 `:23`의 application_id가 동일하다. 채널은 다르지만 봇 앱·credential 분리라는 준비 안내 4절 기준에는 미달한다. 로컬 전용 앱/봇 생성 후 로컬 ID 교체가 권장 경로다. 동일 봇 공유는 기술적 불가능이 아닌 설계 변경 사항이다.
- Medium: 로컬 `:25`의 bot_user_id는 null. 두 파일 `:27` 설치 확인, `:29` 채널 권한 확인도 null이며 사용자 서버 추가 보고와 파일 상태를 구분한다. 해당 봇·채널을 확인한 환경만 true로 입력한다.
- 연동 전 잔여: 두 파일 `:39` 내부 관리자 매핑, `:47` 토큰 비공개 보관 확인, `:49` 보관 위치가 null. 개발자 연결/연동 직전 항목이며 토큰 자체를 입력하지 않는다. `:43` 검수자 역할 ID는 선택 항목이므로 null 허용.
- 정상: JSON 3개 파싱·중복 키 없음. 두 환경 서버/채널/앱/검수자 ID 8개는 숫자 문자열 형식, 서버·검수자는 동일하고 채널 ID는 분리. GUILD_TEXT 및 일정·48시간·반응·관리자 우선·비동기 삭제 정책은 템플릿과 일치. 숫자 형식은 실제 리소스 존재·소속 증거가 아니다.
- 검증: 입력 JSON 3개 SHA-256 전후 일치, 기록의 공백 검사. 실제 Discord API/웹훅 호출·메시지 전송·토큰 접근·외부 변경은 없음. 공식 Webhook 문서에서 URL/토큰 성격을 확인했다.

## 16. 브라우저 실조회 후 입력 보완

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/collection-schedule-0430-1530` / 갱신: 2026-10-07 21:57 KST / 상태: 종료.
- 요청: 브라우저로 실제 값을 확인해 직접 입력. 기존 Chrome Discord 서버와 Developer Portal 탭에서 읽기 조회를 수행했다.
- 실조회: Blariyo 서버의 수집-운영·수집-개발 채널 이름/ID/일반 텍스트·비공개 여부가 입력과 일치. 양쪽 접근 멤버에 같은 Blariyo 봇이 있으며 봇 프로필 사용자 ID 복사와 Developer Portal Application ID가 일치. 검수자 프로필 ID도 두 파일 입력과 일치. 식별값 원문은 이 기록에 복제하지 않는다.
- 권한 확인: 서버 Blariyo 연동 역할의 필수 9개 권한이 모두 ON, Administrator OFF. 양쪽 채널 @everyone은 채널 보기 거부, 봇 개별 채널 보기는 허용, 나머지 필수 권한은 통과로 서버 역할을 상속한다. 권한 변경 없이 현재 UI 설정을 확인했다.
- 변경: 운영·로컬 각각 bot_user_id를 확인한 숫자 문자열로 입력하고 installed_in_guild와 channel_permissions_checked를 true로 기록했다. 운영 필드의 웹훅 URL은 숫자 ID로 교체되어 입력 파일에서 제거됐다. 실제 웹훅 삭제/호출/credential 초기화는 하지 않았다. 다른 입력값·도움말·템플릿은 보존했다.
- 환경 분리 잔여: 현재 실제 구성은 같은 서버·같은 앱/봇·서로 다른 채널이다. 관측값을 입력했으며 기존 별도 봇/credential 권고를 변경하는 사용자 결정으로 해석하지 않는다. 별도 로컬 봇 생성은 미수행.
- 미검증/미입력: 토큰 보관 여부/위치, 내부 관리자 매핑. 봇 token 읽기·발급·저장, 메시지 전송·반응·삭제, batch 실연동은 수행하지 않았다. channel_permissions_checked는 UI 권한 확인이며 동작 시험 성공을 의미하지 않는다.
- 검증: 입력 파일 변경 전 기준 SHA 확인, 실제 변경 경로 각3개(총6개) allowlist 대조, 저장 후 JSON 재파싱·값 일치, 공백 검사. 작업 기록 외 변경은 위 두 JSON뿐이다.

## 17. 토큰 보관 준비와 관리자 연결 조사

- 담당: Codex / 동일 작업 폴더·브랜치 / 갱신: 2026-10-07 22:00 KST / 상태: 인계 — 사용자 토큰 발급·저장 대기.
- 사용자 확인: 봇 토큰은 아직 보관하지 않음. 두 환경 bot_token_stored_privately=false로 반영. 로컬 보관 예정 경로는 `/Users/zeaha/task_list/blariyo-discord-secrets/local/discord-token`; 상위 전용 폴더 2개를 0700으로 준비했으며 토큰 파일은 아직 없다. 운영 서버 보관 위치는 실제 배치 주입 경로 확정 전 null 유지.
- 로컬 입력 도구: `store-discord-token.py`는 사용자가 연 터미널의 getpass로만 입력하며 0600 새 파일로 저장한다. 기존 파일/심볼릭 링크 덮어쓰기·URL 입력을 거부하고 네트워크 호출·토큰 출력은 없다. 합성값으로 저장 권한/덮어쓰기 거부/URL 거부 검증 완료. 최초 시험은 macOS 임시 경로의 심볼릭 링크를 거부했으며 실제 경로를 사용한 재검사 통과. 토큰 형식 검사는 유효 인증 증거가 아니다.
- 수집기 소스 확인: Secrets는 COLLECTOR_SECRETS_DIRECTORY의 discord-token 또는 macOS Keychain account discord-token을 읽는다. 새 검수 배치 런타임 연결·배포는 미구현이며 기존 Gateway 활성화로 대체하지 않는다.
- 관리자 연결: Web은 NUXT_ADMIN_OPERATORS_FILE의 active·role·operatorId와 Cloudflare subject를 검증한다. 알려진 로컬 준비본 ~/.config/blariyo/admin-operators.json은 존재하고0600이나 active OWNER/EDITOR 조건을 만족하는 항목이 없었다. 실제 운영 레지스트리 상태로 단정하지 않으며 임의 계정/권한 수정이나 매핑 입력은 하지 않았다. local-fixture-operator는 로컬 인증 모드의 테스트 식별자로 운영에 사용하지 않는다.
- 사용자 다음 단계: Developer Portal의 Blariyo Bot 탭을 열어 두었다. 토큰 초기화·인증을 직접 완료한 뒤 저장 도구를 직접 실행한다. 브라우저 도구의 인증 자격 증명 변경은 사용자 직접 수행 규칙 때문에 에이전트가 초기화하지 않는다. 보관 완료 후 파일 존재·권한과 봇 인증은 별도 확인한다.

## 18. 비공개 파일 관리 위치 통일 후속

- 사용자 요청에 따라 새 토큰 보관 위치를 `~/.config/blariyo/discord/local/discord-token`으로 정렬했다. 17절의 task_list 경로는 당시 준비 위치이며 현재 사용하지 않는다. 기존 빈 폴더는 삭제하지 않았다.
- 운영·로컬 실제 입력 JSON은 Git 제외·0600 처리했다. template·도구·문서는 Git 관리 대상으로 남긴다. 비공개 파일 전체 위치와 포맷 전 절차는 [운영 복구 안내](../../../docs/operations/private-files-and-recovery.md)를 따른다.
- 토큰 초기화/발급·저장은 사용자 직접 수행 대기. 준비 완료와 실제 token 저장을 구분한다.

## 19. 사용자 토큰 저장 후 실제 읽기 검증

- 담당: Codex / 동일 작업 폴더·브랜치 / 갱신: 2026-10-07 22:06 KST / 상태: 종료 — 로컬 토큰·Discord 읽기 검증 완료, 운영 배치·관리자 매핑은 잔여.
- 로컬 ~/.config/blariyo/discord/local/discord-token의 정규 파일·현재 사용자 소유·0600·비어 있지 않음을 확인했다. token은 로그/문서/명령행 인자로 출력하지 않았다.
- Discord 공식 API에 token을 Authorization 헤더로 전달하는 GET만 수행했다. users/@me 봇 여부·기대 bot ID, guild member/roles, 운영·개발 채널 ID/소속/type/name, 역할 및 채널 overwrite 합산 필수9권한과 관리자 권한OFF, 채널별 messages?limit=1 성공을 확인했다. 메시지 내용과 사용자 ID 원문은 결과 파일에 남기지 않았다.
- 결과: [읽기 검증 결과](discord-readonly-verification.json) PASS. 로컬 입력 bot_token_stored_privately=true 반영. 운영 입력은 실제 서버 credential 저장·주입이 미확인이므로 false/null 유지한다. 같은 token으로 운영 채널을 조회한 사실은 운영 배치 설치 증거가 아니다.
- 미실행: 메시지 전송·반응 생성·스레드 생성/삭제·승인/발행, 운영 서버 token 배치, 내부 관리자 매핑, 외부 백업/복원. 상기 쓰기 동작은 권한 보유만 확인했으며 성공 시험으로 보고하지 않는다.
