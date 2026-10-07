# iron-laws 검토 보조 검사

- source SHA: `fd746b425dd566569b6bd4009ab04efef8afb0f6`, 표시 버전 `1.4.0`, MIT.
- 역할: 예외 은폐·비밀 문자열·AI 지침 파일의 위험 지시·반복 I/O 검토 후보. 자동 통과/보안 인증과 필수 CI 검사를 대신하지 않는다.
- 유지보수 담당: Blariyo 품질 도구 담당 개발자. 환경 lock 변경 시 정상/결함 표본과 대표 파일을 다시 평가한다.

```sh
python3 -m venv tools/iron-laws/.venv
tools/iron-laws/.venv/bin/python -m pip install -r tools/iron-laws/requirements.lock
npm run quality:audit -- --task worklog/YYYY-MM-DD/<주제>
```

Python `>=3.12`가 필요하며 최초 평가/설치는 macOS arm64의 Python3.14.4다. 앱 runtime과 분리된 환경이고 의존성 버전을 `requirements.lock`으로 고정한다. 설치 없이 전역 Python에 패키지를 추가하지 않는다. Windows는 가상환경의 `Scripts/python.exe`를 사용한다. 지원 OS별 실제 실행은 별도 확인한다.

실행기는 명시한 source 디렉터리와 AGENTS/CLAUDE/GEMINI만 임시 사본으로 검사하고 원문을 실행하지 않는다. 결과에는 규칙·파일·행·심각도·신뢰 분류만 남기고 snippet/비밀 후보 원문을 제거한다. 원본은 수정하지 않는다. 종료0은 검사한 범위에서 후보 없음, 1은 검토 필요, 2는 도구/결과 불완전이다.

Vue 파일은 별도 미지원으로 표시하며 Collector Java의 기본 정적 패턴 검사와 Gradle 의존성 검사를 혼동하지 않는다. 파일 간 의미 분석과 실제 업무 안전성은 보장하지 않는다. 설정에는 선택한4개 규칙만 있으며 기존 도구의 규칙을 비활성화한 것이 아니다.

의도적 URL 파싱 실패 복구와 Retry-After 오류 처리도 후보가 될 수 있다. 도구 출력만으로 코드 수정·ignore 추가·자동 승인하지 말고 처리 의도를 대조한다. [도입 근거](../../worklog/2026-10-06/ai-quality-adoption/README.md).
