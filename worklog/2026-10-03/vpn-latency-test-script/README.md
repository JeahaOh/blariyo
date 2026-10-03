# VPN 지연 측정 스크립트

## 요청

- VPN 또는 고정 IP 사용 시 Codex·GitHub·네트워크 응답이 느려지는지 비교할 수 있는 `sh` 파일을 만든다.
- 테스트 차시마다 기록 파일을 남긴다.

## 변경

- `scripts/local/vpn-latency-test.sh` 추가.
- 기본 결과 경로는 `.tmp/vpn-tests/run-YYYYMMDD-HHMMSS-<label>/`이다.
- `codex` CLI가 있으면 `codex exec`로 `1+1` 응답 왕복 시간도 측정한다.
- 각 실행은 다음 파일을 남긴다.
  - `summary.tsv`: 차시별 요약.
  - `env.txt`: 시간, 호스트, 네트워크 인터페이스, 공개 IP.
  - `command/*.log`: `ping`, `curl`, `git ls-remote`, `git status`, `codex exec` 원시 출력.

## 사용 예

```sh
scripts/local/vpn-latency-test.sh --label vpn-off --runs 3
scripts/local/vpn-latency-test.sh --label vpn-on --runs 3
scripts/local/vpn-latency-test.sh --label vpn-on --runs 3 --no-codex
```

## 검증

- `bash -n scripts/local/vpn-latency-test.sh`: 통과.
- `scripts/local/vpn-latency-test.sh --label smoke --runs 1`: 통과.
- 샘플 결과: `.tmp/vpn-tests/run-20261003-120651-smoke/`.
- `.tmp/`는 Git 제외 상태라 측정 결과가 커밋 대상에 섞이지 않는다.
- 2026-10-03 추가 검증: `scripts/local/vpn-latency-test.sh --label codex-smoke --runs 1` 실행 시
  `codex-1plus1` 행은 생성됐지만, 현재 Codex 샌드박스에서는 `~/.codex/state_5.sqlite` 쓰기 제한으로
  `codex exec`가 status 1을 반환했다. 사용자의 일반 터미널에서는 재확인이 필요하다.

## 한계

- Codex 측정은 로컬 `codex exec`의 전체 왕복 시간이다.
- 이 채팅 화면의 렌더링 지연이나 사용자가 보는 인터랙티브 응답 시간과 완전히 같지는 않다.
