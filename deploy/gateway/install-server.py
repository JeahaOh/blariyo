#!/usr/bin/env python3
"""Private gateway install; preserve staged release and the existing Cloudflare Tunnel."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import stat
import subprocess
import sys
import time

RELEASE = Path('/opt/blariyo/application/release-56351a45eea650c0f02e5043')
BASE = Path('/opt/blariyo/gateway')
MARKER = b'blariyo-private-gateway-v1\n'


def run(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=600)
    if p.returncode:raise ValueError('GATEWAY_COMMAND_FAILED')
    return p.stdout


def checked(path, mode=0o600, directory=False):
    info=path.lstat()
    if info.st_uid!=0 or stat.S_IMODE(info.st_mode)!=mode or not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
        raise ValueError('UNSAFE_SERVER_PATH')
    return None if directory else path.read_bytes()


def create(path,data,mode):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
    os.fchmod(fd,mode)
    with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())


def main():
    if os.geteuid()!=0 or os.uname().machine!='x86_64' or socket.gethostname()!='ip-172-26-1-91':raise ValueError('SERVER_IDENTITY_MISMATCH')
    p=json.loads(sys.stdin.buffer.read(100001))
    if p.get('release')!=str(RELEASE) or set(p.get('files',{}))!={'nginx.conf','compose.yaml'}:raise ValueError('INVALID_SCOPE')
    for name,data in p['files'].items():
        if hashlib.sha256(data.encode()).hexdigest()!=p['hashes'][name]:raise ValueError('FILE_HASH_MISMATCH')
    checked(RELEASE,0o700,True)
    stage=json.loads(checked(RELEASE/'stage.json'))
    if stage['status']!='STAGED_NO_SERVICES':raise ValueError('STAGED_APP_REQUIRED')
    for name in ['compose.yaml','images.env','api.env','web.env']:checked(RELEASE/name)
    dbids=run(['docker','ps','-q','--filter','label=com.docker.compose.project=blariyo-db',
               '--filter','label=com.docker.compose.service=postgresql']).decode().split()
    if len(dbids)!=1:raise ValueError('DATABASE_MISSING')
    db=json.loads(run(['docker','inspect',dbids[0]]))[0]
    if db['State'].get('Health',{}).get('Status')!='healthy':raise ValueError('DATABASE_UNHEALTHY')
    app=['docker','compose','-p','blariyo-app','--env-file',str(RELEASE/'images.env'),'-f',str(RELEASE/'compose.yaml')]
    run(app+['config','--quiet'])
    config=json.loads(run(app+['config','--format','json']))
    if set(config['services'])!={'api','web'}:raise ValueError('APP_SCOPE_CHANGED')
    for name,service in config['services'].items():
        if service.get('ports') or service['image']!=stage['images'][name]:raise ValueError('APP_BOUNDARY_CHANGED')
    active=run(['docker','ps','-q','--filter','label=com.docker.compose.project=blariyo-app']).strip()
    if active:raise ValueError('APP_ALREADY_RUNNING_REVIEW_REQUIRED')
    if not BASE.exists():
        BASE.mkdir(mode=0o700);create(BASE/'.managed',MARKER,0o600)
    checked(BASE,0o700,True)
    if checked(BASE/'.managed')!=MARKER:raise ValueError('UNMANAGED_GATEWAY')
    fd=os.open(BASE/'.install.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w'):
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        # Preflight all existing files before filling missing ones. Never overwrite.
        for name,data in p['files'].items():
            file=BASE/name;mode=0o644 if name=='nginx.conf' else 0o600
            if (file.exists() or file.is_symlink()) and checked(file,mode)!=data.encode():raise ValueError('GATEWAY_FILE_CHANGED')
        for name,data in p['files'].items():
            file=BASE/name
            if not file.exists():create(file,data.encode(),0o644 if name=='nginx.conf' else 0o600)
        compose=['docker','compose','-p','blariyo-gateway','-f',str(BASE/'compose.yaml')]
        cfg=json.loads(run(compose+['config','--format','json']))
        if set(cfg['services'])!={'nginx'} or cfg['services']['nginx'].get('ports') or set(cfg['services']['nginx']['networks'])!={'edge'}:
            raise ValueError('GATEWAY_BOUNDARY_INVALID')
        existing=run(['docker','ps','-aq','--filter','name=^/blariyo-gateway-nginx-1$']).strip()
        if existing:
            info=json.loads(run(['docker','inspect',existing.decode()]))[0]
            if info['Config'].get('Labels',{}).get('com.docker.compose.project')!='blariyo-gateway':raise ValueError('CONTAINER_OWNER_MISMATCH')
        print('PASS 서버·앱 image 참조·gateway 파일·비공개 network 구성 확인',flush=True)
        # Compose owns the app network; create only Web, without starting its process/dependencies.
        run(app+['up','--no-start','--no-build','--pull','never','--no-deps','web'])
        web=run(app+['ps','-aq','web']).decode().strip()
        web_info=json.loads(run(['docker','inspect',web]))[0]
        if web_info['State']['Running']:raise ValueError('UNEXPECTED_WEB_START')
        run(compose+['pull','nginx'])
        image=cfg['services']['nginx']['image']
        image_info=json.loads(run(['docker','image','inspect',image]))[0]
        if image_info['Architecture']!='amd64' or image_info['Os']!='linux':raise ValueError('NGINX_PLATFORM_MISMATCH')
        run(['docker','run','--rm','--platform','linux/amd64','--network','none','--user','101:101','--read-only',
             '--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:size=16m,mode=1777,noexec,nosuid',
             '--mount','type=bind,src='+str(BASE/'nginx.conf')+',dst=/etc/nginx/nginx.conf,readonly','--entrypoint','nginx',image,'-t'])
        run(compose+['up','-d','--no-build','--pull','never','nginx'])
        cid=run(compose+['ps','-q','nginx']).decode().strip()
        limit=time.monotonic()+60
        while True:
            info=json.loads(run(['docker','inspect',cid]))[0]
            if info['State'].get('Health',{}).get('Status')=='healthy':break
            if time.monotonic()>limit:raise ValueError('GATEWAY_NOT_HEALTHY')
            time.sleep(1)
        if info['HostConfig'].get('PortBindings') or set(info['NetworkSettings']['Networks'])!={'blariyo-app_edge'}:raise ValueError('RUNNING_GATEWAY_BOUNDARY_INVALID')
        if info['Config']['User']!='101:101' or info['HostConfig']['Memory']!=64*1024**2 or not info['HostConfig']['ReadonlyRootfs']:raise ValueError('GATEWAY_RUNTIME_INVALID')
        if run(['docker','exec',cid,'wget','-q','-O','-','http://127.0.0.1:8080/__gateway_health']).strip()!=b'UP':raise ValueError('GATEWAY_LIVENESS_FAILED')
        print('PASS 실제 Nginx healthy · UID 101 · 64MiB · host port 없음 · edge network만 연결',flush=True)
        print('PASS Web container 생성(미기동) · Core 미기동 · 기존 DB/Tunnel 유지',flush=True)
        print('완료: /opt/blariyo/gateway. 공개 Tunnel route는 변경하지 않았습니다.',flush=True)


if __name__=='__main__':
    try:main()
    except Exception as e:
        code=str(e) if isinstance(e,ValueError) and re.fullmatch('[A-Z_]+',str(e)) else 'GATEWAY_SERVER_FAILED'
        print('FAIL '+code+' — 비밀값·원문 비출력, 기존 DB/Tunnel 유지',file=sys.stderr);sys.exit(1)
