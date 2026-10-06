"""Observe five real changes against the recorded pre-adoption baseline; no app edits."""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[3]
base = '12df6aedce57d41993d49060793656870c5c318f'
paths = [
    'apps/api/src/features/collection/collector-quota.service.ts',
    'apps/api/src/features/collection/collector-result.service.ts',
    'apps/web/shared/admin-return.ts',
    'apps/web/app/pages/admin.vue',
    'apps/collector/src/main/java/com/blariyo/collector/run/SourceRequests.java',
]
sha = lambda data: hashlib.sha256(data).hexdigest()

def inspect(args):
    started = time.monotonic()
    child = subprocess.run(args, cwd=root, capture_output=True, text=True)
    if child.returncode not in [0, 1]:
        raise RuntimeError('Inspection incomplete')
    return json.loads(child.stdout), round(time.monotonic() - started, 4), child.returncode

result = {'kind': 'retrospective-real-change-observation', 'baseline': base,
          'current_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
          'records': [], 'limits': ['Five existing real changes, not five future development cycles',
                                  'Static pattern coverage only; absent findings do not prove semantic correctness']}
with tempfile.TemporaryDirectory(prefix='blariyo-observation-') as directory:
    for index, name in enumerate(paths):
        previous = subprocess.run(['git', 'show', f'{base}:{name}'], cwd=root, capture_output=True)
        old = previous.stdout if previous.returncode == 0 else b''
        new = (root / name).read_bytes()
        if old == new:
            raise RuntimeError(f'Not a real change: {name}')
        item = {'path': name, 'before_exists': previous.returncode == 0,
                'before_hash': sha(old), 'after_hash': sha(new),
                'before_lines': len(old.splitlines()), 'after_lines': len(new.splitlines()), 'runs': []}
        for state, data in [('before', old), ('after', new)]:
            if state == 'before' and previous.returncode != 0:
                item['runs'].append({'state': state, 'status': 'not_applicable_added_file'}); continue
            folder = Path(directory) / str(index) / state
            folder.mkdir(parents=True)
            target = folder / Path(name).name
            target.write_bytes(data)
            if not name.endswith('.java'):
                output, duration, code = inspect([str(root/'node_modules/.bin/oxlint'), '--config', str(root/'oxlint.config.ts'), '--format', 'json', str(target)])
                item['runs'].append({'state': state, 'tool': 'selected-oxlint', 'seconds': duration, 'exit': code,
                    'findings': [{'rule': x.get('code'), 'line': x.get('labels', [{}])[0].get('span', {}).get('line')} for x in output['diagnostics']]})
            else:
                item['runs'].append({'state': state, 'tool': 'selected-oxlint', 'status': 'unsupported_java'})
            if not name.endswith('.vue'):
                output, duration, code = inspect([str(root/'tools/iron-laws/.venv/bin/iron-laws'), 'audit', str(folder), '--config', str(root/'tools/iron-laws/config.yml'), '--format', 'json'])
                if output['summary']['scan_status'] != 'complete':
                    raise RuntimeError('Incomplete audit')
                item['runs'].append({'state': state, 'tool': 'iron-laws', 'seconds': duration, 'exit': code,
                    'findings': [{'rule': x['rule_id'], 'line': x['line_number'], 'confidence': x['confidence']} for x in output['violations']],
                    'unverified_rule_language_rate': output['summary']['unverified_rule_language_rate']})
            else:
                item['runs'].append({'state': state, 'tool': 'iron-laws', 'status': 'unsupported_vue'})
        result['records'].append(item)
file = Path(__file__).parent / 'verification/real-change-observation.json'
file.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'observed_real_changes': len(result['records']), 'file': str(file)}))
