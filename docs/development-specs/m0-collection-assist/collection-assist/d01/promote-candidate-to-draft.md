# 후보 초안 승격 D01

## 1. 프로세스 목적과 범위

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-03
- 입력 근거: [수집 보조 개발 보강서](../collection-assist.dev.md)
- 미검증: source, R2 runtime, transaction/orphan cleanup test, browser

운영자가 검수한 후보를 기존 게시글 초안으로 승격한다.

## 2. 행위자·시작 조건·선행 조건

- 행위자: 인증된 운영자
- 시작 조건: `NEW` 후보 상세에서 `초안으로 승격` 선택
- 선행 조건: 선택 이미지 1~20건 또는 TEXT block 기준 충족, M0 Core 초안 생성 경로 구현

## 3. 정상 흐름

1. 운영자가 제목, 출처, 사용할 이미지 후보와 선택 본문을 확인한다.
2. 중복 게시글이 있으면 기존 게시글을 확인하고 승격 의사를 다시 확인한다.
3. 화면은 `POST /api/v1/admin/collect/candidates/{candidateId}/draft`를 호출한다.
4. Core는 후보 상태, lockVersion, 중복 확인, 게시판을 검증한다.
5. Core는 선택 이미지를 fetch하고 관리자 업로드와 같은 검증·재인코딩을 적용한다.
6. Core는 private 원본 bucket에 저장한다.
7. Core는 기존 초안 생성 command를 재사용해 게시글과 block을 만든다.
8. Core는 후보를 `APPROVED`로 바꾸고 생성 `postId`를 연결한다.
9. 화면은 생성된 `/admin/posts/{postId}` 편집기로 이동한다.

## 4. 대안·실패 흐름

- 중복 확인 누락: 기존 게시글 확인을 요구한다.
- 이미지 fetch 실패: 후보를 `NEW`로 유지하고 오류를 표시한다.
- transaction 실패: 후보를 `NEW`로 유지하고 저장된 이미지는 orphan 정리 대상으로 둔다.
- terminal 후보: 승격 버튼을 노출하지 않는다.

## 5. 단계별 호출 API 매핑

| 단계 | API |
| --- | --- |
| 3~8 | [후보 초안 승격](../api/promote-candidate-to-draft.md) |

## 6. 데이터·상태 전이

- `NEW` -> `APPROVED`
- `collect.candidate.post_id`에 생성된 `content.board_post.id` 연결
- 선택 이미지 후보는 저장 성공 후 `STORED`와 `image_id`를 가진다.

## 7. 권한·트랜잭션·멱등성·재시도

- 관리자 인증과 `Idempotency-Key`가 필요하다.
- 후보와 게시글 생성은 단일 논리 command로 처리한다.
- DB transaction 실패와 R2 object 보상 정리는 기존 이미지 cleanup 원칙을 따른다.

## 8. 완료 조건과 수용 기준

- 초안이 생성되고 기존 관리자 편집기로 이동한다.
- 후보는 `APPROVED` terminal 상태가 된다.
- 자동 발행하지 않는다.
- 외부 이미지 원본 URL이나 storage key를 공개 화면에 노출하지 않는다.

## 9. 미정·차단·미검증 항목

- 미검증: source, R2, transaction rollback, browser

