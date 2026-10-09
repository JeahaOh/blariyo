# 공개 이미지 수집 정책 변경

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST / 갱신: 17:20 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / 시작 HEAD: `0bf9533` / release 공통 기준: `7df63de`.
- 요청: HTTP 정상 이미지·외부 CDN 허용, 출처별 이미지 도메인 제한 제거, 이미지 실패의 출처 전체 중단 방지, 정책 수정.
- 담당 경로: 수집 planning/system-design/spec, Collector 정책/전송/runner/회귀 테스트, 이 기록 및 status/roadmap 요약.
- 기존 untracked 전부 보존. 개발 배치 자동 실행은 중지 유지. commit/push/운영 배포는 이번 권한에 포함하지 않음.
- 변경 전: HTTPS와 출처별 imageOrigins 제한, 이미지 PARSE/MEDIA의403/429/503이 출처 중단 및 공통 cooldown에 영향.
- 새 기준: 공개 이미지 HTTP/HTTPS·외부 호스트·이미지 redirect 허용, 매 hop 공개 IP/DNS 고정 및 형식/크기 검증 유지. 이미지 오류는 해당 글 실패로 남기고 후속 글 진행. 출처 본문·일반 첨부의 기존 허용 계약은 유지.
- 검증 계획: 정책·HTTP 실제 로컬 전송·redirect/내부 IP 차단·이미지 실패 후 다음 글 DB/object 저장·영속 이미지 호스트 cooldown·Collector 전체 격리DB 회귀.

## 구현 결과

- 이미지 URL은 출처별 `imageOrigins` 없이 공개 HTTP·HTTPS를 허용한다. 다른 CDN으로의 redirect도 최대3회 허용하며 각 요청마다 DNS 공개 IP 검사·연결 IP 고정·용량 제한을 유지한다. HTTPS 인증서 검증은 유지한다.
- 일반 파일 첨부는 분리한 `attachmentPolicy`에서 기존 허용 목록을 사용한다. 목록·본문 허용 범위를 이미지와 함께 넓히지 않았다.
- 이미지 URL/파싱/전송/형식 오류는 해당 글 실패로 기록하고 후속 글을 진행한다. 이미지 오류는 출처 중단이나 출처 실패3회 누적에 포함하지 않는다. DB·예산·소유권 오류는 기존 중단 경계를 유지한다.
- 이미지429/503의 Retry-After는 이미지 호스트별 해시 키로 DB에 보관한다. 출처 본문 전체를 대기시키지 않으며 새 프로세스도 동일 호스트 대기를 적용한다. 기존 제한 함수와2초 전송 permit을 재사용했고 migration/권한을 추가하지 않았다.
- planning·system-design·개발 명세와 status/roadmap에 정책 및 적용 범위를 반영했다. 비활성 legacy Core 후보 API는 수용 대상에서 제외했다.

## 검증 결과

- [Collector 전체 회귀](collector-tests.log): **85 suites / 312 tests / failure0 / error0 / skipped0**, DB readback21개 포함. 개발 업무 DB와 분리된 임시 DB를 생성·삭제하는 `scripts/test-collector-readback.mjs`를 Node24.18.0/JDK25로 실행했다.
- 회귀 시나리오: 이미지403 → 내부IP URL 거부 → 이미지503 → 이미지429 → 다음 글 HTTP 외부CDN PNG 저장. 실패4건·성공1건을 확인했고 DB remote_url, 파일 bytes, SHA-256을 대조했다. 같은 이미지 서버의 대기 영속성과 다른 CDN·수동 URL 수집 진행도 확인했다.
- HTTP 실제 전송은 로컬 HTTP 서버와 고정 IP 연결 테스트로 검증했다. HTTP·HTTPS의 내부IP/DNS 재바인딩 차단, 외부CDN redirect, 원래 출처의 본문 허용 제한도 검사했다. 실제 운영 원문이나 외부 이미지를 재요청한 검증은 아니다.
- 잘못된 이미지 태그4개를 포함한 글이 연속 실패해도5번째 글을 수집하는 회귀를 추가했다.
- [bootJar·fixtureClasspath 빌드](collector-build.log) 통과. [migration 계약 검사](migration-contract-tests.log)1개 통과. 변경 Java 입력 및 JAR SHA-256은 [verification.json](verification.json)에 보관했다.
- 변경 정본 문서의 상대 파일 링크299개 중 누락0, `git diff --check` 통과. [review-guards](review-guards.json)는 `no_candidates`이나 Java/Markdown 미지원이므로 의미 검증 통과로 해석하지 않는다.
- 최초 전체 회귀의5개 실패는 기존 테스트가 시간 대기를 생략하는데 새 이미지 호스트의2초 permit은 실제 DB 시간을 사용해 발생했다. 저장/복구 테스트의 시간 제어 fixture를 보완하고, 별도 readback에서는 실제 호스트 제한 함수를 다시 활성화해 검증했다. assertion 삭제·skip·실운영 제한 완화 없이 전체312개를 재실행했다.
- 기본 Node20 실행은 TypeScript 확장자 오류로 시작하지 못했다. 프로젝트용 Node24로 재실행했다. 빌드의 구형 JDK 자동 탐지/FSEvents 경고는 있었으나 테스트·빌드는 exit0이었다.

## 적용 상태와 잔여 사항

- **로컬 소스·정책·검증 완료 / commit·push·운영 배포 미실행.** 운영에서 HTTP 이미지 수집이 정상화됐다는 결과는 아직 없다.
- 개발 자동 실행4개(`local-collection`, `discord-review.scan`, `discord-review.maintenance`, `local-collection.awake`) 모두 `disabled`, 미로드 상태를 재확인했다. 개발 Web/API/DB의 설정·프로세스는 변경하지 않았다.
- HTTP는 전송 중 변조 방지를 제공하지 않는다. 허용하되 이미지 형식/용량 및 내부망 차단 검사를 유지하며 원본을 직접 핫링크하지 않는다. 잘못된 이미지가 있는 글은 성공 처리하지 않고 실패 기록과 기존 재시도 대상으로 남는다.
- 후속 작업은 요청 시 Git 반영·운영 배포 후 동일 실패 사례의 실제 수집 결과 확인이다. 기존 다른 작업의 untracked 기록은 보존했다.
