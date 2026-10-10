import json
from pathlib import Path
root=Path('/opt/blariyo/collector')
sources=json.loads((root/'sources.json').read_text())
print(json.dumps(sources,ensure_ascii=False,indent=2))
keys={line.split('=',1)[0]:line.split('=',1)[1] for line in (root/'collector.env').read_text().splitlines() if '=' in line and not line.startswith('#')}
assert keys.get('COLLECTOR_SOURCE_CONFIG',keys.get('COLLECTOR_SOURCES_FILE'))=='/app/sources.json'
print('PASS sources-sync uses the production source catalogue')
