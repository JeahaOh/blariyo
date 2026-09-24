#!/usr/bin/env python3
"""Repository document inventory; local references only, no runtime/network actions."""
from pathlib import Path
from collections import Counter
from html.parser import HTMLParser
import hashlib
import html
import json
import re
import subprocess
import unicodedata
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[3]
DEST = Path(__file__).with_name('inventory.json')
DECISIONS = Path(__file__).with_name('reference-decisions.json')
EXTENSIONS = {'.md', '.mdx', '.rst', '.txt', '.adoc', '.html', '.pdf', '.docx', '.pptx', '.xlsx', '.drawio', '.mmd'}
STRUCTURED = {'.json', '.yaml', '.yml'}


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if not value:
                continue
            if key == 'id' or (tag == 'a' and key == 'name'):
                self.ids.add(value)
            if key in ('href', 'src'):
                self.links.append((self.getpos()[0], value))


def role(name):
    if name.startswith('docs/') and Path(name).suffix in STRUCTURED:
        if '/openapi/' in name:
            return 'machine-contract'
        if '/security-evidence/' in name or '/migration/' in name:
            return 'dated-machine-evidence'
        return 'agent-configuration'
    if name.startswith('worklog/codex-session-'):
        return 'conversation-transcript'
    if name == 'worklog/2026-09-24/full-document-refresh/README.md':
        return 'current-document'
    if '/src/test/resources/' in name and not name.endswith('.md'):
        return 'test-fixture'
    if Path(name).name == 'requirements.txt':
        return 'dependency-input'
    if name.startswith('worklog/') and name != 'worklog/README.md':
        return 'historical-record'
    if '/ops/reports/' in name or '/decisions/검수/' in name or '/validation/' in name:
        return 'dated-review'
    if '/draft-2/' in name or '/wireframes/archive/' in name:
        return 'archived-artifact'
    if name.endswith('.html'):
        return 'reference-artifact'
    return 'current-document'


def prose(text):
    text = re.sub(r'^ {0,3}(`{3,}|~{3,})[^\n]*\n.*?^ {0,3}\1\s*$',
                  lambda m: '\n' * m[0].count('\n'), text, flags=re.M | re.S)
    return text


def anchors(text, suffix):
    parser = Tags()
    parser.feed(text)
    result = parser.ids | set(re.findall(r'<[A-Za-z][^>]*?\b(?:id|name)=["\']([^"\']+)["\']', text))
    if suffix != '.md':
        return result
    used = Counter()
    for line in prose(text).splitlines():
        match = re.match(r'^ {0,3}#{1,6}\s+(.+?)\s*#*$', line)
        if not match:
            continue
        title = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', match[1])
        title = re.sub(r'<[^>]+>', '', html.unescape(title)).lower()
        key = ''.join(c for c in title if c in '-_ ' or unicodedata.category(c)[0] in 'LNM').replace(' ', '-')
        count = used[key]
        used[key] += 1
        result.add(key if count == 0 else f'{key}-{count}')
    return result


def references(text, suffix):
    if suffix in STRUCTURED:
        # JSON Pointer and schema references require their own contract validation.
        return []
    if suffix == '.html':
        parser = Tags()
        parser.feed(text)
        return parser.links
    body = prose(text)
    found = []
    pattern = r'\[[^\n]*?\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)'
    for match in re.finditer(pattern, body):
        found.append((body.count('\n', 0, match.start()) + 1, match[1].strip('<>')))
    for match in re.finditer(r'^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)', body, re.M):
        label, destination = match[1], match[2]
        without_definition = body[:match.start()] + body[match.end():]
        if re.search(r'\[' + re.escape(label) + r'\](?!:)', without_definition, re.I):
            found.append((body.count('\n', 0, match.start()) + 1, destination.strip('<>')))
    return found


def main():
    previous = json.loads(DEST.read_text()) if DEST.exists() else {'documents': []}
    previous = {entry['path']: entry for entry in previous['documents']}
    decisions = json.loads(DECISIONS.read_text()) if DECISIONS.exists() else []
    names = subprocess.check_output(['git', 'ls-files', '-c', '-o', '--exclude-standard'], cwd=ROOT, text=True).splitlines()
    names = sorted({name for name in names if Path(name).suffix.lower() in EXTENSIONS
                    or name.startswith('docs/') and Path(name).suffix.lower() in STRUCTURED})
    cache = {}
    documents = []
    issues = []
    totals = Counter()
    for name in names:
        path = ROOT / name
        data = path.read_bytes()
        kind = role(name)
        entry = {'path': name, 'role': kind, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
        old = previous.get(name, {})
        entry['content_review'] = old.get('content_review', 'pending')
        entry['evidence'] = old.get('evidence', [])
        if old.get('reviewed_sha256'):
            entry['reviewed_sha256'] = old['reviewed_sha256']
            if old['reviewed_sha256'] != entry['sha256']:
                entry['content_review'] = 'changed-since-review'
        if old.get('preserved_sha256'):
            entry['preserved_sha256'] = old['preserved_sha256']
            if old['preserved_sha256'] != entry['sha256']:
                entry['content_review'] = 'changed-since-preservation'
        if kind in ('test-fixture', 'dependency-input'):
            entry['content_review'] = 'preserved-data'
            entry['evidence'] = ['Test input or dependency declaration; not a current project guidance document.']
            documents.append(entry)
            continue
        if kind == 'conversation-transcript':
            entry['content_review'] = 'preserved-transcript'
            entry['evidence'] = ['Raw user/assistant/activity transcript; embedded source excerpts and historical relative paths retain their original context. Not current navigation.']
            documents.append(entry)
            continue
        text = data.decode('utf-8')
        entry['lines'] = len(text.splitlines())
        entry['relative_references'] = 0
        if path.suffix in STRUCTURED:
            entry['structured_validation'] = old.get('structured_validation', 'pending') if old.get('structured_validation_sha256') == entry['sha256'] else 'pending'
            if old.get('structured_validation_sha256'):
                entry['structured_validation_sha256'] = old['structured_validation_sha256']
        if kind == 'historical-record':
            entry['content_review'] = 'preserved-history'
            entry['preserved_sha256'] = entry['sha256']
            entry['evidence'] = ['Historical worklog: its recorded status, headings, path and local reference targets are in scope; the dated operational history is preserved, not reclassified as current truth. Current claims are checked against present canonical docs, source, and later evidence.']
        for line, target in references(text, path.suffix):
            if target.startswith(('/', '${', '{{')) or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target):
                continue
            url = urlsplit(target)
            dest = (path.parent / unquote(url.path)).resolve() if url.path else path
            entry['relative_references'] += 1
            totals['relative_references'] += 1
            reason = None
            if not dest.exists():
                reason = 'missing-target'
            elif url.fragment and dest.suffix in ('.md', '.html'):
                fragment = unquote(url.fragment)
                if dest not in cache:
                    contents = dest.read_text()
                    cache[dest] = (anchors(contents, dest.suffix), len(contents.splitlines()))
                line_ref = re.fullmatch(r'L(\d+)(?:-L(\d+))?', fragment)
                if line_ref:
                    totals['line_references'] += 1
                    first = int(line_ref[1]); last = int(line_ref[2] or first)
                    if not 1 <= first <= last <= cache[dest][1]:
                        reason = 'missing-line-range'
                else:
                    totals['anchor_references'] += 1
                    if fragment not in cache[dest][0]:
                        reason = 'missing-anchor'
            if reason:
                issue = {'path': name, 'line': line, 'target': target, 'reason': reason, 'resolution': 'unresolved'}
                for decision in decisions:
                    if (decision['path'], decision['target'], decision['source_sha256']) == (name, target, entry['sha256']):
                        if 'target_sha256' in decision and (not dest.is_file() or hashlib.sha256(dest.read_bytes()).hexdigest() != decision['target_sha256']):
                            continue
                        issue['resolution'] = decision['resolution']
                        issue['evidence'] = decision['evidence']
                        break
                issues.append(issue)
        documents.append(entry)
    payload = {'scope': 'Git tracked and non-ignored untracked documentation/artifacts plus structured contracts/evidence under docs/',
               'counts': dict(totals), 'roles': dict(Counter(d['role'] for d in documents)),
               'documents': documents, 'reference_issues': issues}
    DEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'files': len(documents), 'roles': payload['roles'], **dict(totals),
                      'reference_issues': dict(Counter(i['resolution'] for i in issues)),
                      'review_states': dict(Counter(d['content_review'] for d in documents))}, ensure_ascii=False))
    for issue in issues[:50]:
        print(json.dumps(issue, ensure_ascii=False))
    if len(issues) > 50:
        print(f'Remaining issues are recorded in {DEST.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
