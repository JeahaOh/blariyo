# 2026-09-20 세션 커밋 분리

사용자 요청: 이 세션에서 수정한 파일·작업 기록만 커밋. push·운영 배포 제외.

- 전체 52개 경로: UI·정책 표시·푸터 문의 fallback·차콜 배경, GitHub CI와 배포 안내, 최초 HOT 25건 요약 묶음/적재 도구, 로컬 정책 등록/기동, 대응 명세·테스트·세션 기록·비교 캡처.
- 이 기록 자체를 포함하면 53개 경로다.
- 11개 혼합 파일은 이번 세션 부분만 별도 패치로 분리했다. 원본 작업 폴더는 변경하지 않았다.
- 제외: 다른 세션의 X/다른 SNS 임베드·CSP, 캐시/오류 처리, 보안·비용 보호, 원문·첨부 재수집/발행, DB host 포트 5439 변경, 로컬 빌드 사본 기동 보완.
- 혼합 파일: 루트 README, nuxt.config.ts, 게시글 상세, 화면 설계, 공개 탐색 명세, 운영 상태, worklog 색인, scripts/local 3개, scripts/content README.
- 커밋 사본의 로컬 도구는 이 세션 당시 55439를 사용한다. HEAD의 compose 포트와 맞추며, 작업 폴더의 후속 5439 변경은 그대로 남긴다. 이 커밋을 이유로 현재 DB/서버를 다시 설치하지 않는다.
- 격리 사본 `/tmp/blariyo-session-commit-check`에서 Web build 통과. 실행 중인 로컬 서버나 운영 서버를 재시작하지 않았다.
- 직접 `git add`는 허용됐지만 혼합 파일 선별 `git apply --cached`가 `.git/index.lock: Operation not permitted`로 거부됐다. 따라서 이 기록 작성 시점에는 commit 미생성이다. 일부 파일만 담긴 불완전 커밋을 만들지 않았다.
- 마무리 파일: `/Users/zeaha/task_list/blariyo-session-commit-20260920/`. `commit.py`는 HEAD·현재 staged diff·선별 패치·대상 경로를 확인한 뒤 패치를 index에만 반영하고 커밋한다. 조건이 달라졌으면 중단한다. 작업 파일 덮어쓰기·reset·push는 하지 않는다.
- 여러 세션은 포트뿐 아니라 빌드 산출물과 Git index를 공유한다. 로컬 공용 서버의 재시작/배포 담당을 하나로 두고, 나머지는 별도 포트·빌드 사본을 사용해야 한다. 스테이징과 커밋도 동시에 수행하지 않는다.
