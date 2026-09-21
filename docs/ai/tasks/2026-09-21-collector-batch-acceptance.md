# Collector·Batch 수용 체크리스트

이 문서는 `2026-09-21-collector-batch-architecture-reset.md`의 독립 검증 기준이다.

## 아키텍처

- [ ] API와 batch가 별도 프로세스·별도 실행 컴퓨터에서 실행됨
- [ ] batch가 글마다 API를 호출하지 않음
- [ ] batch DB role·API DB role이 분리됨
- [ ] `collect`와 `content`의 테이블·상태 소유권이 문서·migration·코드에서 일치함
- [ ] S3/R2 prefix별 쓰기·삭제 권한이 분리됨
- [ ] batch 장애가 API 공개 서비스와 기존 게시글을 중단시키지 않음
- [ ] API 장애가 batch의 로컬 queue·재시작을 막지 않음

## 저장·정합성

- [ ] canonical URL hash unique 검증
- [ ] source post key unique 검증
- [ ] S3 upload 후 DB 기록 검증
- [ ] DB 실패 시 orphan object 정리 또는 재처리 상태 검증
- [ ] 같은 행의 동시 수정·stale lock 거부 검증
- [ ] batch 재시작 뒤 중복 저장·무한 재시도 없음

## Batch CLI

- [ ] `--dry-run`이 DB와 S3를 변경하지 않음
- [ ] `--write-db`가 batch DB와 S3에 직접 저장함
- [ ] `--max-pages`, `--max-items`, `--since`, `--interval`이 적용됨
- [ ] 403·429·robots·timeout·5xx·parser 실패별 처리가 구분됨
- [ ] site-level stop/skip이 전체 batch 무한 반복을 막음
- [ ] JSON/JSONL report에 secret·cookie·본문·원문 URL·절대 경로가 없음
- [ ] macOS·Windows PowerShell·Docker Linux 명령 형식이 제공됨

## Parser

- [ ] 21개 source가 registry에 존재함
- [ ] 목록 parser와 상세 parser가 분리됨
- [ ] 본문·이미지·첨부·SNS URL 추출 규칙이 source별로 기록됨
- [ ] 삭제·비공개·로그인 필요·접근 차단·빈 본문·이미지 없음 fixture가 있음
- [ ] SNS-only와 외부 링크-only 사례가 있음
- [ ] 실제 HTML을 확인하지 않은 selector가 성공으로 표시되지 않음
- [ ] 차단 출처는 generic parser가 아닌 `blocked`로 기록됨

## API·검수

- [ ] API가 외부 사이트를 직접 fetch하지 않음
- [ ] API가 collect 결과를 조회함
- [ ] 운영자가 검수 상태를 변경할 수 있음
- [ ] 승인된 결과만 content 게시글 초안으로 승격됨
- [ ] 자동 공개·자동 발행이 발생하지 않음
- [ ] 게시글 승격 시 본문 순서·이미지·첨부 reference가 보존됨

## Discord

- [ ] `/collect url` 권한 검증
- [ ] 확인 interaction 전 queue·DB·S3 변경 없음
- [ ] 확인 뒤 batch queue에 등록됨
- [ ] Gateway 실제 연결 결과가 별도 기록됨
- [ ] Gateway 미연결 상태를 완료로 표시하지 않음

## 최종 증거

- [ ] Java/Node lint 또는 compile
- [ ] 단위·fixture·batch·DB migration 테스트
- [ ] 개발 DB readback
- [ ] S3 object readback
- [ ] 실제 공개 URL read-only 검증
- [ ] `git diff --check`
- [ ] `git status --short --branch`
