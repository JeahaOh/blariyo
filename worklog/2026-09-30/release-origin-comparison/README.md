# 원격·로컬 release 내용 비교

- 요청: origin/release와 local release가 다른 이유와 파일 내용 동일 여부 확인.
- 담당: Codex / 상태: 종료 / 갱신: 2026-09-30T21:14:10+09:00.
- 작업 폴더·브랜치: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / `feature/m0-design-completion@578c0581ae7db6207a5f864dcca6485ad3eb47d6`.
- 범위: read-only Git 조회·diff와 이 기록. 이전 main 조회 기록 1개를 보존했다.
- 원격 직접 조회 `git ls-remote --heads origin release main`: release=`6b91402f11df5c08c0147bab14fd2df7c681cbd8`, main=`8af72449a7d56c9701efd0d73dc7d430a66f9610`. 로컬 추적 ref와 일치.
- 로컬 release=`054575928df7bd7e8f8a630c1234d7b3d054969c`. 원격 release와 내용도 다르며 99파일, +5570/-554줄 차이다. 앱26·배포2·계약3·스크립트6·테스트6·문서39·작업기록11·hook4·루트2파일이다.
- 원인1: 재구성 전부터 로컬 release에는 원격에 없는 `7788ac6`(hook), `bb19c48`(M0 계획·운영 결정) 두 커밋이 있었다.
- 원인2: 사용자 요청에 따라 옛 로컬 main의 9/25 고유 변경8개를 local release에 포함하고 날짜순 cherry-pick으로 커밋 ID를 재작성했다. 원격 push는 수행하지 않았다.
- 실제 내용 차이는 GA4 v1·관리자 로그인/검수 UX·로컬 Git hook·M0 계획과 운영 문서 등이다. SHA만 다른 상태가 아니다.
- Git 이력상 origin만4/local만14개라는 수치는 재작성된 ID의 차이이며 원격 기능4개가 누락됐다는 뜻이 아니다.
- 앞서 전체 내용 동일이라고 확인한 비교는 **재구성 전 local release 2126c05 ↔ 재구성 후 local release 0545759**다. 두 tree는 `5d9cc2679e12fc580fee10d7e128281725303207`로 같다. 원격 release의 tree는 다르다.
- 직전 작업 단위7커밋은 feature에 반영했으며 release 통합과는 별개다.
- [전체 파일 비교](COMPARISON.json). 이번 작업에서 테스트·빌드·원격 쓰기·브랜치 변경은 실행하지 않았다. 이 조회 기록은 미커밋이다.
