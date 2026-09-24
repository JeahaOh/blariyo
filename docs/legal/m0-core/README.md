# M0 Core 공개 정책 v0.1

- 작성일: 2026-09-20
- 상태: **2026-09-20 v0.1 정식 발행. 운영 DB EFFECTIVE·본문 SHA-256·공개 HTTPS 화면 확인**
- 검토일: 2026-09-24. 편집 HTML·생성 도구·배포 기록을 대조했으며 운영 DB/계정 재조회나 재발행은 하지 않았다.
- 상위 기준: [법무 정본](../README.md), [서비스 단계](../../planning/01-service-plan.md#출시-단계)

작은 무료 사이트에 맞춰 현재 사용하는 기능만 설명한다. 약관은 8개, 개인정보처리방침은
6개 항목으로 구성한다. 아래 HTML은 공개본을 준비하는 편집 원본이며 `{{...}}`는 기존
연락처 파일로 치환할 자리다. 실제 연락처를 이 폴더에 입력하지 않는다.

| 초안 | 상위 원문·역할 |
| --- | --- |
| [이용약관](terms.html) | [전체 약관 초안](../terms-of-service.md)의 M0 조항을 간결하게 구성 |
| [개인정보처리방침](privacy.html) | [전체 처리방침 초안](../privacy-policy.md)의 M0 처리와 실제 서비스 확인 사항 |
| [권리자 요청](rights.html) | [권리자 요청 안내](../rights-request.md)의 이메일 접수·우선 숨김·검토 절차 |
| [쿠키 안내](cookies.html) | [쿠키 설정](../cookie-settings.md)의 비활성 기능 경계·실제 저장소 확인 |

전체 초안은 후속 기능 설계도 보관한다. 이 묶음은 현재 M0 공개본의 편집 정본이며 전체 초안의 후속 기능을 자동으로
대체하거나 다른 단계의 공개 조건을 없애지 않는다. 향후 조건 변경은 상위 원문과 함께 갱신한다.

## 책임 문구의 기준

`draft-2/`는 초기 seed의 고정 본문 사본이다. 그 안의 `rights.html`·`cookies.html` 상대 주소는 당시
원문 표기를 보존하므로 해당 폴더에서 직접 열면 연결되지 않는다. 비교할 때는 위 표의
[권리자 요청](rights.html)·[쿠키 안내](cookies.html)를 사용한다. 링크 정리를 이유로 고정 초안 본문이나
이미 발행한 정책의 해시를 바꾸지 않는다. 새 공개 변경은 별도 버전의 검토·발행 절차를 따른다.

- 게시 횟수·목록 수 같은 UI 상세를 약관의 제공 보장으로 반복하지 않는다. 제품 기준은 유지한다.
- 영구 보관·특정 게시 일정·무중단 제공을 별도 약정 없이 보장하지 않는다.
- 운영자에게 귀책사유 없는 장애와 외부 사이트 자체 운영에 대한 책임을 구분한다.
- 특별손해는 법령의 예견 가능성 등 요건에 따르게 하며, 간접 손해 전부를 일괄 제외하지 않는다.
- 고의·중대한 과실, 법령상 책임, 운영자 자신의 위법행위를 면책하지 않는다. 손해배상 상한 0원,
  무조건적인 권리 포기, 신고만 받으면 저작권 책임이 없어지는 표현을 넣지 않는다.
- 출처 표시는 이용 허락을 대신하지 않는다. 운영자가 직접 게시물을 선별·발행하는 구조에서
  중개 플랫폼에 관한 책임 제한이 자동 적용된다고 가정하지 않는다.

이는 유효한 범위에서 책임을 명확히 하는 초안이며 개별 분쟁의 면책을 보장하지 않는다.

## 확인된 운영 정보와 남은 값

- 최초 시행일: **2026년 9월 20일**. 사용자가 9월 26일 지정을 철회하고 오늘부터 적용하도록 변경했다. 실제 `effective_at`은 2026-09-20 정식 발행 시각으로 기록됐고 운영 DB에서 확인했다.
- 메일: 2026-09-20 Cloudflare 대시보드에서 도메인 주소의 활성 전달 규칙과 Gmail 목적지를 확인했다. Cloudflare Email Routing → 일반 Gmail 구성이며 연락처 원문은 기록하지 않는다.
- 연락처 5개: 기존 `~/.config/blariyo/public-contact.json`을 재사용한다. 주소 재입력은 필요 없다.
- 문의·권리 요청: 종전 고정 1년·3년 보관을 없앴다. 요청 처리와 필요한 법정 절차가 끝나고 보존 필요가 없어지면 지체 없이 파기한다. 진행 중 분쟁·법령상 보존 대상만 근거·범위·종료 조건을 남겨 분리한다.
- 일반 진단 로그: 상한을 7일로 줄였다. 전용 rsyslog·일별 파일·매일 만료 timer를 설치했고 10일 된 합성 로그 삭제를 확인했다. Docker 이중 로그 cache도 껐다. UTC 당일과 이전 5일 파일만 유지하므로 매일 정상 실행 시 7일을 넘지 않는다.
- 개인정보처리시스템의 개인정보 접근 기록: 일반 HTTP 방문 로그와 구분하며, 안전성 확보조치 기준 제8조 적용 시 최소 1년, 2년 대상이면 최소 2년을 보관한다. 관리자 이력 전체가 이 요건을 충족한다고 가정하지 않는다.
- AWS 청구 화면에서 Amazon Web Services Korea LLC·서울 리전을 확인했다. Cloudflare Inc.의 CDN/R2/Access/메일 전달과 일반 Gmail의 Google LLC 처리를 현재 본문에 반영했다. 사업자 글로벌 처리와 개별 요청·메일의 실제 처리 국가를 구분하며 특정 국가만 쓴다고 단정하지 않는다.
- Cloudflare Access는 인증 앱 MFA·정책 세션 각 6시간이다. 제공자 보안·감사 로그의 보존과 자체 진단 로그 삭제는 별개다. 관리자 TOTP 입력 화면까지 실제 연결을 확인했다.
- DB는 전용 backup 역할로 하루 두 번 덤프하고 age로 암호화한 뒤 R2 전용 버킷에 7일 보관한다. R2에서 다시 내려받은 실파일을 격리 PostgreSQL 18에 복원하고 migration ledger·정책 본문 해시·게시글 수를 대조했다. 메일의 목적 종료 후 파기는 운영자의 수동 업무다.
- 정책 공개는 법률상 모든 쟁점의 외부 전문가 확인이나 개별 사건의 면책을 보장하는 의미가 아니다. 후속 기능·처리 변경 시 새 버전으로 검토한다.

## 검토본 생성

[로컬 생성 도구](../../../deploy/application/prepare-policy-review.cjs)는 기존 연락처를 HTML 문자로
이스케이프해 새 비공개 폴더에 넣는다. 입력 파일·기존 검토본을 덮어쓰지 않는다.

```sh
# 저장소 루트, Node.js 24.18.0 환경
node deploy/application/prepare-policy-review.cjs --open
```

편집 본문은 실제 `/terms`, `/privacy`, `/cookie-settings` 경로를 쓴다. 검토 도구에서만 로컬 HTML 링크로 바꾼다. 권리자 요청 절차는 공개 약관 본문에 포함한다. 이 도구는 서버 등록용
artifact, 체크섬, 시행 시각을 만들지 않으며 DB를 호출하지 않는다.

DB 보관과 새 DB 초기화에는 별도의 [정책 seed](../../../deploy/postgresql/README.md#정책-초기-데이터-등록)를
사용한다. 초기 seed의 `v0.1-draft.2`는 [당시 본문](draft-2/privacy.html)을 고정해 `DRAFT`로 재현한다. 기존 `draft.1`·`draft.2`는 덮어쓰지 않았다. 확정 본문은 별도 [정식 발행 도구](../../../deploy/application/publish-policies-from-mac.py)의 실제 앱 `policies:publish` command로 `v0.1`을 발행했다. 새 DB도 migration → draft seed → 확정 정책 발행 순서로 진행한다. 이미 공개한 `v0.1` 수정은 허용하지 않으며 변경은 새 버전으로 만든다.

## 확인한 공식 근거

9월 24일 추가 대조에서도 공개 HTML 6개(고정 draft.2 포함)의 원문을 유지했다. direct raw HTML·본문·media·report/queue의 처리/보존은 [개인정보 초안 추가안](../privacy-policy.md#direct-수집의-처리보존-추가안--qd-04-미확정)과 QD-04의 잔여다. 현재 v0.1을 고쳤다고 간주하거나 기존 발행 해시를 덮어쓰지 않는다. 담당자 표시와 필요한 연락 수단의 적정성도 단순 설정 주입·발행 성공만으로 확인됐다고 보지 않는다.

2026-09-20 조회. 구체적인 적용은 실제 운영·계약 사실과 함께 판단한다.

- [약관법 제6·7조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1025032405): 불공정 약관·과도한 면책을 피하는 기준.
- [민법 제393조](https://elaw.klri.re.kr/kor_service/lawViewMultiContent.do?hseq=74420): 특별한 사정에 따른 손해의 법정 판단 기준.
- [개인정보 보호법 제30조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1029331583): 필요한 처리방침 항목과 책임자·연락처 표시.
- [개인정보 보호법 제28조의8](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1020398611): 국외이전의 근거와 고지 항목.
- [개인정보 보호법 제30조의3 신설](https://law.go.kr/LSW/lsInfoP.do?lsiSeq=283839&viewCls=lsRvsDocInfoR): 사업주·대표자 책임 규정. 시행 전이라는 기존 문구를 갱신함.
- [저작권법 제103조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029423165): 적용 대상과 요건을 갖춘 중단·재개 절차.
- [Google 개인정보처리방침](https://policies.google.com/privacy?hl=ko): 실제 사용하는 Google 서비스·계약 검토의 출발점이며 사용자의 계약 유형 확인을 대체하지 않음.

- [개인정보 보호법 제21조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651): 목적 달성 등으로 불필요해진 정보의 지체 없는 파기와 다른 법령에 따른 보존 예외.
- [안전성 확보조치 기준 제8조](https://www.law.go.kr/LSW/admRulSideInfoP.do?admRulSeq=2100000281400&chrClsCd=010201&dashNo=&docCls=jo&joBrNo=00&joNo=0008&urlMode=admRulScJoRltInfoR): 개인정보처리시스템 접속기록의 1년·2년 구분. 일반 방문 로그 전체에 적용한 수치가 아님.
- [대한민국 Google 서비스 약관](https://policies.google.com/terms?hl=ko&gl=kr): 일반 Google 서비스 제공자는 Google LLC. Google Workspace 계약으로 추정하지 않음.
- [Google 삭제·보존 안내](https://policies.google.com/technologies/retention?hl=en-GB): 이용자의 삭제와 사업자 내부 백업 파기 완료는 별개.

- [Cloudflare 한국 부록](https://www.cloudflare.com/privacypolicy/southkorea-addendum/): 글로벌 처리 사업자·국가 안내. 개별 요청의 실제 처리 위치를 증명하지 않음.
- [Cloudflare 로그 보존](https://developers.cloudflare.com/cloudflare-one/insights/logs/): Free Access 로그 24시간, 관리자 감사 로그 18개월.
- [Access 인증 쿠키](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/): 앱·전역 인증 쿠키 구분.
- [운영 배포 기록](../../../worklog/2026-09-20/infrastructure-setup/TASK-19.md): 공개 연결·백업·복구·운영 적용 증거.
