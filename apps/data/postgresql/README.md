# PostgreSQL local data

이 디렉터리는 로컬 PostgreSQL 18 bind mount 전용이다. 실제 데이터 파일은 Git에 포함하지 않는다.

기존 `apps/data/mysql` 데이터는 자동 변환하거나 삭제하지 않는다. 필요한 데이터가 있으면 논리 백업과 검증을 거쳐 별도로 이관한다.
