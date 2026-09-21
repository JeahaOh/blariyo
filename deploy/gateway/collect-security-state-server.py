#!/usr/bin/env python3
"""Read-only inventory for public asset/cache checks; never read environment or credentials."""
import hashlib
import json
from pathlib import Path
import socket
import subprocess
from datetime import datetime, timezone


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('READ_ONLY_CHECK_FAILED')
    return result.stdout.strip()


def main():
    if socket.gethostname() != 'ip-172-26-1-91':
        raise RuntimeError('HOST_IDENTITY_MISMATCH')
    script = r'''
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('ASSET_SYMLINK');
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk('/app/public/_nuxt').sort();
if (files.length > 1000) throw new Error('INVENTORY_SCOPE_CHANGED');
console.log(JSON.stringify(files.map(file => ({
  path:file.replace('/app/public',''), bytes:fs.statSync(file).size,
  sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}))));
'''
    files = json.loads(run(['docker', 'exec', 'blariyo-app-web-1', 'node', '-e', script]))
    containers = [json.loads(line) for line in run([
        'docker', 'ps', '--format',
        '{"name":{{json .Names}},"image":{{json .Image}},"ports":{{json .Ports}},"status":{{json .Status}}}'
    ]).splitlines()]
    # ss columns: state, receive queue, send queue, local address:port, peer address:port.
    public_ports = sorted({int(row.split()[3].rsplit(':', 1)[1])
                           for row in run(['ss', '-H', '-lnt']).splitlines()
                           if row.split()[3].rsplit(':', 1)[0] in ('0.0.0.0', '[::]', '*')})
    state = {
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'scope': 'Read-only running server inventory; no secrets, request bodies, or user identifiers',
        'nginx_config_sha256': hashlib.sha256(Path('/opt/blariyo/gateway/nginx.conf').read_bytes()).hexdigest(),
        'gateway_health': run(['docker', 'exec', 'blariyo-gateway-nginx-1', 'wget', '-q', '-O', '-',
                               'http://127.0.0.1:8080/__gateway_health']),
        'public_wildcard_tcp_ports': public_ports,
        'containers': containers,
        'files': files,
    }
    print(json.dumps(state, indent=2))


if __name__ == '__main__':
    main()
