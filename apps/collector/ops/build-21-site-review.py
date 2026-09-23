#!/usr/bin/env python3
"""Build a reviewer-facing 21-site collector readback report from success/failure readback JSON files.

This script does not connect to DB or object storage. It makes the review artifact
reproducible after separate readback verifiers have produced their JSON files.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCES = [
    'arcalive', 'bobaedream', 'clien', 'dcinside', 'dmitory', 'dogdrip', 'etoland',
    'fmkorea', 'goodgag', 'humoruniv', 'instiz', 'inven', 'mlbpark', 'natepann',
    'pgr21', 'ppomppu', 'ruliweb', 'theqoo', 'todayhumor', 'yuldo', 'youtube-community',
]


def read_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise SystemExit(f'{path}: expected JSON array')
    return data


def clipped(value: object, limit: int = 80) -> str:
    text = '' if value is None else str(value)
    return text if len(text) <= limit else text[: limit - 3] + '...'


def build(success_rows: list[dict], failed_rows: list[dict]) -> list[dict]:
    by: dict[str, dict] = {}
    for row in success_rows:
        source = row.get('sourceKey')
        if source not in SOURCES:
            continue
        by[source] = {
            'sourceKey': source,
            'reviewState': 'FETCHED_DEV_READBACK',
            'runId': row.get('runId'),
            'itemId': row.get('itemId'),
            'sourcePostKey': row.get('sourcePostKey'),
            'canonicalUrl': row.get('canonicalUrl'),
            'title': row.get('title'),
            'blockCount': row.get('blockCount', 0),
            'attachmentCount': row.get('attachmentCount', 0),
            'snsCount': row.get('snsCount', 0),
            'mediaCount': row.get('mediaCount', 0),
            'mediaBytes': row.get('mediaBytes', 0),
            'rawObjectKey': row.get('rawObjectKey'),
            'reportObjectKey': row.get('reportObjectKey'),
            'rawObjectExists': row.get('rawObjectExists'),
            'reportObjectExists': row.get('reportObjectExists'),
            'mediaObjectsExist': row.get('mediaObjectsExist'),
            'failureCode': None,
            'failurePhase': None,
        }
    for row in failed_rows:
        source = row.get('sourceKey')
        if source not in SOURCES:
            continue
        by[source] = {
            'sourceKey': source,
            'reviewState': 'FAILED_DEV_READBACK',
            'runId': row.get('runId'),
            'itemId': None,
            'sourcePostKey': row.get('sourcePostKey'),
            'canonicalUrl': row.get('canonicalUrl') or row.get('detailUrl'),
            'title': None,
            'blockCount': 0,
            'attachmentCount': 0,
            'snsCount': 0,
            'mediaCount': 0,
            'mediaBytes': 0,
            'rawObjectKey': None,
            'reportObjectKey': row.get('reportObjectKey'),
            'rawObjectExists': False,
            'reportObjectExists': row.get('reportObjectExists'),
            'mediaObjectsExist': True,
            'failureCode': row.get('failureCode'),
            'failurePhase': row.get('phase'),
        }
    return [by.get(source, {'sourceKey': source, 'reviewState': 'MISSING_DEV_READBACK'}) for source in SOURCES]


def write_markdown(rows: list[dict], path: Path) -> None:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row['reviewState']] = counts.get(row['reviewState'], 0) + 1
    lines = [
        '# Collector 21개 사이트 개발 DB 검토 자료',
        '',
        '범위: 임시 Docker 개발 DB `blariyo-collector-readback`와 로컬 object store readback. 운영 DB/S3/R2 검증이 아니다.',
        '',
        f"요약: FETCHED_DEV_READBACK {counts.get('FETCHED_DEV_READBACK', 0)}개, FAILED_DEV_READBACK {counts.get('FAILED_DEV_READBACK', 0)}개, MISSING_DEV_READBACK {counts.get('MISSING_DEV_READBACK', 0)}개.",
        '',
        '| source | review state | run id | post key | title/failure | blocks | media | sns | report |',
        '|---|---|---|---|---|---:|---:|---:|---|',
    ]
    for row in rows:
        title_or_failure = clipped(row.get('title') or row.get('failureCode') or '')
        lines.append(
            f"| {row['sourceKey']} | {row['reviewState']} | `{row.get('runId', '') or ''}` | "
            f"`{row.get('sourcePostKey', '') or ''}` | {title_or_failure} | {row.get('blockCount') or 0} | "
            f"{row.get('mediaCount') or 0} | {row.get('snsCount') or 0} | "
            f"`{row.get('reportObjectKey', '') or ''}` exists={str(bool(row.get('reportObjectExists'))).lower()} |"
        )
    lines += [
        '',
        '검토 기준:',
        '',
        '- `FETCHED_DEV_READBACK`은 실제 공개 URL 또는 hot list batch에서 상세 fetch/parser/DB/object 저장/readback을 확인한 상태다.',
        '- `FAILED_DEV_READBACK`은 실제 live URL을 시도했지만 접근 차단 또는 renderer 부재로 실패했고, 실패 상태와 report object 저장/readback을 확인한 상태다.',
        '- 이 파일은 운영 DB/S3/R2 검증이나 Discord Gateway E2E 완료 증거가 아니다.',
    ]
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--success-json', type=Path, default=Path('apps/collector/ops/reports/dev-readback-review-2026-09-23.json'))
    parser.add_argument('--failure-json', type=Path, default=Path('apps/collector/ops/reports/dev-blocked-readback-2026-09-23.json'))
    parser.add_argument('--out-json', type=Path, default=Path('apps/collector/ops/reports/dev-21-site-review-2026-09-23.json'))
    parser.add_argument('--out-md', type=Path, default=Path('apps/collector/ops/reports/dev-21-site-review-2026-09-23.md'))
    args = parser.parse_args()
    rows = build(read_json(args.success_json), read_json(args.failure_json))
    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_md.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    write_markdown(rows, args.out_md)
    missing = [row['sourceKey'] for row in rows if row['reviewState'] == 'MISSING_DEV_READBACK']
    print(json.dumps({'rows': len(rows), 'missing': missing}, ensure_ascii=False))
    if missing:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
