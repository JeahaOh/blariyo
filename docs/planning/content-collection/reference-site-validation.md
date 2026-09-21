# 출처별 수집 검증표

이 표는 source registry의 실행 상태와 별개로, 실제 HTML·정책·readback 증거를 기록한다. `blocked`는 generic parser를 사용하지 않는다는 뜻이며, `unverified`는 selector 또는 공개 범위를 확인하지 못한 상태다. `implemented`와 `verified`는 각각 코드 존재와 실제 공개 URL·DB/S3 readback을 모두 확인해야 한다.

목록 가능 여부는 [출처별 수집 정책](source-collection-policy.md)의 `HOT_LIST`, `DETAIL_ONLY`, `BLOCKED`, `UNVERIFIED`를 따른다. 모든 사이트에 Hot 목록을 강제하지 않는다.

| source key | host | chart/list | 목록·상세 parser | 본문·이미지·첨부·SNS | canonical / post key | pagination·limits | robots·약관 | fixture / 공개 URL | DB/S3 readback | 상태 |
|---|---|---|---|---|---|---|---|---|---|---|
| arcalive | arca.live | `/b/live` | ARCALIVE / ARCALIVE | `.article-view .article-content`; `img`; LINK SNS; file LINK | `/b/{board}/{id}` / numeric id | observed `p`; 2p/20/10s | robots 200; policy review 필요 | sanitized fixture; 183667641 | DB fixture + live HTML DB, S3 미검증 | implemented, unverified |
| bobaedream | www.bobaedream.co.kr | `/list?code=best` | BOBAEDREAM / BOBAEDREAM | `.bodyCont[itemprop=articleBody]`; image attrs; LINK | `/view?code=&No=` / code:id | page link 미확정; 2p/20/10s | robots 200; terms review 필요 | sanitized fixture; 1033744 | DB fixture + live HTML DB, S3 미검증 | implemented, unverified |
| dogdrip | www.dogdrip.net | `/dogdrip?sort_index=popular` | DOGDRIP / DOGDRIP | `document_*_0.xe_content`; image attrs; LINK | `/{id}` / numeric id | observed page; 2p/20/10s | crawl-delay 10; policy review 필요 | sanitized fixture; 725820115 | DB fixture + live HTML DB, S3 미검증 | implemented, unverified |
| inven | www.inven.co.kr | `/best/issue` | INVEN / INVEN | `#powerbbsContent`; image attrs; LINK | `/board/{game}/{board}/{id}` / game:board:id | observed page; 2p/20/10s | robots 200; terms review 필요 | sanitized fixture; 2730613 | DB fixture + live HTML DB, S3 미검증 | implemented, unverified |
| theqoo | theqoo.net | (미확인) | existing detail only / 목록 미구현 | documented existing article selector; SNS LINK | existing parser rule / (미확인) | 미확인 | robots 404, fail closed | 기존 fixture 없음 | 미검증 | unverified |
| clien | www.clien.net | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots가 AI agent 차단 | 없음 | 미검증 | blocked |
| dcinside | gall.dcinside.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 정책 승인 필요 | 없음 | 미검증 | blocked |
| dmitory | www.dmitory.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 정책 승인 필요 | 없음 | 미검증 | blocked |
| etoland | etoland.co.kr | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots가 AI agent 차단 | 없음 | 미검증 | blocked |
| fmkorea | www.fmkorea.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 상세 경로 robots 제한 | 없음 | 미검증 | blocked |
| goodgag | www.goodgag.net | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots가 AI agent 차단 | 없음 | 미검증 | blocked |
| humoruniv | www.humoruniv.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots 선택 경로 제한 | 없음 | 미검증 | blocked |
| instiz | www.instiz.net | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 공개 요청 403 | 없음 | 미검증 | blocked |
| mlbpark | mlbpark.donga.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots wildcard 금지 | 없음 | 미검증 | blocked |
| natepann | pann.nate.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots wildcard 금지 | 없음 | 미검증 | blocked |
| pgr21 | pgr21.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | Anubis challenge | 없음 | 미검증 | blocked |
| ppomppu | www.ppomppu.co.kr | `/hot.php` (403) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 공개 요청 403 | 없음 | 미검증 | blocked |
| ruliweb | bbs.ruliweb.com | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 인기 목록 query robots 제한 | 없음 | 미검증 | blocked |
| todayhumor | www.todayhumor.co.kr | (미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | robots 미확인 | 없음 | 미검증 | blocked |
| yuldo | yul-do.com | `/` (chart 미확인) | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 다운로드 경로 제한; chart 미확인 | 없음 | 미검증 | blocked |
| youtube-community | www.youtube.com | community chart 미확인 | 없음 / 없음 | 미확인 | 미확인 | 미확인 | 플랫폼 권한·약관 검토 필요 | 없음 | 미검증 | blocked |

공통 규칙은 목록과 상세 parser를 분리하고, 본문 순서의 `TEXT`, `IMAGE`, `LINK`를 보존한다. SNS URL은 원문 링크이며 화면 임베드는 기존 공식 allowlist가 결정한다. 첨부 파일 binary 업로드와 S3 object readback은 현재 미완료이므로 위 표에서 성공으로 표시하지 않는다.
