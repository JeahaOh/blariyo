#!/usr/bin/env python3
"""Isolated gateway routing test with a synthetic Web server; no production input or SSH."""
import http.client
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
APP_IMAGES = Path.home() / 'task_list/blariyo-app-images-20260920T005324Z-rhn14v8g/manifest.json'


def run(args, allowed=False):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
    if result.returncode and not allowed:
        raise RuntimeError('GATEWAY_TEST_COMMAND_FAILED')
    return result.stdout


def main():
    image = json.loads(APP_IMAGES.read_text())['images']['api']['id']
    project = 'blariyo-gateway-test-' + secrets.token_hex(5)
    network = project + '-edge'
    names = [project + '-web1', project + '-reserve', project + '-web2']
    fixture = """const http=require('http');const revision=process.argv[1];http.createServer((q,s)=>{let n=0;q.on('data',b=>n+=b.length);q.on('end',()=>{if(q.url.startsWith('/api/v1/admin/')&&!q.headers['cf-access-jwt-assertion'])s.statusCode=401;s.setHeader('Content-Type','application/json');s.end(JSON.stringify({revision,url:q.url,method:q.method,headers:q.headers,bytes:n}))})}).listen(3000,'0.0.0.0')"""
    def web(name, revision):
        run(['docker','run','-d','--name',name,'--network',network,'--network-alias','web','--platform','linux/amd64',
             '--user','1000:1000','--read-only','--cap-drop','ALL','--entrypoint','node',image,'-e',fixture,revision])
    with tempfile.TemporaryDirectory(prefix=project) as temp:
        override = Path(temp) / 'test.json'
        override.write_text(json.dumps({'services':{'nginx':{'ports':['127.0.0.1::8080']}},'networks':{'edge':{'name':network}}}))
        compose = ['docker','compose','-p',project,'-f',str(HERE/'compose.yaml'),'-f',str(override)]
        run(['docker','network','create',network])
        try:
            web(names[0], 'v1')
            run(compose + ['config','--quiet'])
            run(compose + ['up','-d'])
            cid = run(compose + ['ps','-q','nginx']).decode().strip()
            info = json.loads(run(['docker','inspect',cid]))[0]
            assert info['Config']['User']=='101:101' and info['HostConfig']['ReadonlyRootfs']
            assert info['HostConfig']['Memory']==64*1024**2 and set(info['NetworkSettings']['Networks'])=={network}
            port = int(info['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort'])
            def request(path, host='blariyo.com', headers=None, data=None):
                req = urllib.request.Request('http://127.0.0.1:'+str(port)+path, data=data, headers={'Host':host,**(headers or {})})
                try:
                    with urllib.request.urlopen(req, timeout=3) as r:return r.status,r.read()
                except urllib.error.HTTPError as e:return e.code,e.read()
            def ready(revision):
                limit=time.monotonic()+30
                while time.monotonic()<limit:
                    try:
                        status,body=request('/echo')
                        if status==200 and json.loads(body)['revision']==revision:return
                    except (OSError,ValueError):pass
                    time.sleep(0.25)
                raise AssertionError('WEB_DNS_RECOVERY_FAILED')
            ready('v1')
            run(['docker','exec',cid,'nginx','-t'])
            for path in ['/','/meme','/terms','/privacy','/cookie-settings','/health/live','/admin','/api/v1/admin/posts']:
                status,_=request(path,headers={'CF-Access-Jwt-Assertion':'fixture-jwt-only'})
                assert status==200,path
            assert request('/api/v1/admin/posts')[0]==401
            assert request('/internal/health/ready')[0]==404
            assert request('/internal')[0]==404
            assert request('/echo',host='unrelated.invalid')[0]==421
            path='/echo/a%20b?probe=private-query-fixture'
            status,body=request(path,headers={'Cookie':'private-cookie-fixture','CF-Access-Jwt-Assertion':'fixture-jwt-only',
              'CF-Connecting-IP':'198.51.100.7','X-Forwarded-For':'spoof-ip','Forwarded':'for=spoof-ip','X-Forwarded-Proto':'http'})
            value=json.loads(body)
            assert status==200 and value['url']==path
            headers=value['headers']
            assert headers['host']=='blariyo.com' and headers['x-forwarded-proto']=='https'
            assert headers['cf-access-jwt-assertion']=='fixture-jwt-only' and headers['cookie']=='private-cookie-fixture'
            assert headers['cf-connecting-ip']=='198.51.100.7'
            assert 'x-forwarded-for' not in headers and 'forwarded' not in headers and 'x-real-ip' not in headers
            status,body=request('/echo',data=b'x'*1024*1024)
            assert status==200 and json.loads(body)['bytes']==1024*1024 and json.loads(body)['method']=='POST'
            c=http.client.HTTPConnection('127.0.0.1',port,timeout=5)
            c.putrequest('POST','/echo',skip_host=True);c.putheader('Host','blariyo.com');c.putheader('Content-Length',str(102*1024**2));c.endheaders()
            assert c.getresponse().status==413;c.close()
            # Occupy the removed Web address so replacement really has a different IP.
            old_web=json.loads(run(['docker','inspect',names[0]]))[0]['NetworkSettings']['Networks'][network]['IPAddress']
            run(['docker','rm','-f',names[0]])
            run(['docker','run','-d','--name',names[1],'--network',network,'--entrypoint','node',image,'-e','setInterval(()=>{},1000)'])
            request('/echo?probe=private-query-fixture')
            web(names[2], 'v2')
            new_ip=json.loads(run(['docker','inspect',names[2]]))[0]['NetworkSettings']['Networks'][network]['IPAddress']
            assert new_ip!=old_web
            ready('v2')
            assert json.loads(run(['docker','inspect',cid]))[0]['RestartCount']==0
            logs=run(['docker','logs',cid]).decode()
            for forbidden in ['private-query-fixture','private-cookie-fixture','fixture-jwt-only','198.51.100.7','spoof-ip','/echo/a']:
                assert forbidden not in logs,'UNSAFE_GATEWAY_LOG'
            assert '"status":' in logs
            print('PASS Nginx configuration · UID 101 · read-only filesystem · 64MiB · edge network only')
            print('PASS Web routes · synthetic auth status/headers · internal path denied · Host restriction · upload limits')
            print('PASS replacement Web IP resolved without Nginx restart · raw query/cookie/JWT/IP excluded from access logs')
        finally:
            run(compose+['down','--remove-orphans'],allowed=True)
            for name in names:run(['docker','rm','-f',name],allowed=True)
            run(['docker','network','rm',network],allowed=True)
            leftovers=run(['docker','ps','-aq','--filter','name='+project]).strip()
            remaining=run(['docker','network','ls','-q','--filter','name='+network]).strip()
            assert not leftovers and not remaining,'TEST_CLEANUP_FAILED'
            print('PASS isolated gateway resources cleaned up')


if __name__=='__main__':main()
