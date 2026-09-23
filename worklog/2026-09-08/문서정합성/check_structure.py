#!/usr/bin/env python3
"""Check local Markdown links, anchors, fences, and conventional pipe tables.

This intentionally skips fenced code blocks. A line is treated as a table only
when it participates in a header/separator pair, so shell pipes and prose are
not reported as table rows. It does not judge a link target's semantic accuracy.
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path.cwd()
DOC_ROOTS = [ROOT / "docs/planning", ROOT / "docs/legal", ROOT / "docs/system-design", ROOT / "docs/development-specs"]
FILES = sorted(p for base in DOC_ROOTS for p in base.rglob("*.md"))
LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
HEADING = re.compile(r"^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$")
EXPLICIT_ANCHOR = re.compile(r'<a\s+[^>]*\bid=["\']([^"\']+)["\']', re.I)
SEPARATOR_CELL = re.compile(r"^:?-{3,}:?$")


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def without_fences(text: str) -> tuple[list[str], list[int]]:
    lines, kept, in_fence = text.splitlines(), [], False
    for number, line in enumerate(lines, 1):
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            continue
        if not in_fence:
            kept.append(line)
    return kept, [len(re.findall(r"^\s*(```|~~~)", text, re.M))]


def slug(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"`([^`]*)`", r"\1", value).lower()
    value = "".join(
        c for c in value
        if c in " -_" or unicodedata.category(c)[0] in {"L", "N", "M"}
    )
    return re.sub(r"[ -]+", "-", value).strip("-")


def anchors(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8")
    lines, _ = without_fences(text)
    found = set(EXPLICIT_ANCHOR.findall("\n".join(lines)))
    counts: dict[str, int] = defaultdict(int)
    for line in lines:
        match = HEADING.match(line)
        if not match:
            continue
        base = slug(match.group(1))
        suffix = counts[base]
        counts[base] += 1
        found.add(base if suffix == 0 else f"{base}-{suffix}")
    return found


def split_cells(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith("\\|"):
        line = line[:-1]
    cells, current, escaped = [], [], False
    for char in line:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            current.append(char)
            escaped = True
        elif char == "|":
            cells.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    cells.append("".join(current).strip())
    return cells


def is_separator(line: str) -> bool:
    cells = split_cells(line)
    return bool(cells) and all(SEPARATOR_CELL.fullmatch(cell.replace(" ", "")) for cell in cells)


issues: list[tuple[str, int, str, str]] = []
link_count = table_count = 0
anchor_cache: dict[Path, set[str]] = {}

for path in FILES:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    fence_count = len(re.findall(r"^\s*(```|~~~)", raw, re.M))
    if fence_count % 2:
        issues.append((rel(path), 0, "fence", "닫히지 않은 fenced code block"))
    visible, _ = without_fences(raw)
    visible_numbers = [n for n, line in enumerate(lines, 1) if not any(False for _ in [])]
    # Link inspection uses the original line numbers while omitting fenced ranges.
    in_fence = False
    for line_no, line in enumerate(lines, 1):
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK.findall(line):
            target = target.strip().strip("<>")
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("//"):
                continue
            link_count += 1
            file_part, sep, fragment = target.partition("#")
            target_path = (path.parent / file_part).resolve() if file_part else path.resolve()
            if not target_path.exists():
                issues.append((rel(path), line_no, "link", f"대상 파일 없음: {target}"))
            elif sep and target_path.suffix.lower() == ".md":
                if target_path not in anchor_cache:
                    anchor_cache[target_path] = anchors(target_path)
                if fragment not in anchor_cache[target_path]:
                    issues.append((rel(path), line_no, "anchor", f"대상 앵커 없음: {target}"))

    # Table checks only begin at an actual header + delimiter pair outside fences.
    in_fence = False
    index = 0
    while index < len(lines) - 1:
        if re.match(r"^\s*(```|~~~)", lines[index]):
            in_fence = not in_fence
            index += 1
            continue
        if in_fence or "|" not in lines[index] or not is_separator(lines[index + 1]):
            index += 1
            continue
        expected = len(split_cells(lines[index]))
        if len(split_cells(lines[index + 1])) != expected:
            issues.append((rel(path), index + 2, "table", "헤더와 구분선 열 수 불일치"))
        table_count += 1
        index += 2
        while index < len(lines) and lines[index].strip() and "|" in lines[index] and not re.match(r"^\s*(```|~~~)", lines[index]):
            if len(split_cells(lines[index])) != expected:
                issues.append((rel(path), index + 1, "table", f"행 열 수 {len(split_cells(lines[index]))}, 헤더 {expected}"))
            index += 1

print(f"markdown_files={len(FILES)} local_links_checked={link_count} tables_checked={table_count} issues={len(issues)}")
for file_name, line, kind, detail in issues:
    print(f"{file_name}:{line}: {kind}: {detail}")
