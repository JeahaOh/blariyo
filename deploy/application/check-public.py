#!/usr/bin/env python3
"""Anonymous production smoke. No credentials; no content mutation; no redirect tokens printed."""
import subprocess,json,urllib.parse,tempfile
from pathlib import Path

def get(url,headers=()):
 with tempfile.TemporaryDirectory(prefix='blariyo-http-') as d:
  body=Path(d)/'body';head=Path(d)/'headers'
  cmd=['curl','-sS','--max-time','20','-D',str(head),'-o',str(body),'-w','%{http_code}',url]
  for h in headers:cmd+=['-H',h]
  r=subprocess.run(cmd,capture_output=True);assert r.returncode==0,'HTTP_CONNECTION_FAILED'
  parsed={}
  for line in head.read_text().splitlines():
   if ':' in line:
    k,v=line.split(':',1);parsed[k.lower()]=v.strip()
  return int(r.stdout),parsed,body.read_bytes()
for path in ['/meme','/terms','/privacy','/cookie-settings','/health/live']:
 code,headers,body=get('https://blariyo.com'+path);assert code==200,(path,code)
 assert b'[\xec\xb6\x9c\xec\x8b\x9c \xec\xb0\xa8\xeb\x8b\xa8' not in body
 print('PASS HTTPS 200',path)
for typ in ['terms','privacy']:
 code,h,b=get('https://blariyo.com/api/v1/policies/'+typ);assert code==200
 p=json.loads(b)['data']['policy'];assert p['version']=='v0.1' and p['effectiveAt'].startswith('2026-09-20')
 assert not any(x in p['bodyHtml'] for x in ['[출시 차단','[입력 필요','{{'])
 print('PASS 공개 정책 API',typ,'v0.1 · 시행일 · placeholder 없음')
for path in ['/admin','/api/v1/admin/posts']:
 for spoof in [(),('CF-Access-Jwt-Assertion: invalid.synthetic.token',)]:
  code,h,b=get('https://blariyo.com'+path,spoof);assert code==302
  u=urllib.parse.urlsplit(h['location']);assert u.hostname=='patient-water-1af4.cloudflareaccess.com'
 print('PASS 익명·위조 헤더 관리자 요청 → Access 인증',path)
code,h,b=get('https://blariyo.com/internal/health/ready');assert code==404
print('PASS Core internal 경로 공개 차단')
code,h,b=get('http://blariyo.com/meme');assert code in [301,308] and h['location']=='https://blariyo.com/meme'
print('PASS HTTP → HTTPS')
code,h,b=get('https://www.blariyo.com/admin');assert code==308 and h['location']=='https://blariyo.com/admin'
print('PASS www → 대표 도메인 (관리자 경로도 본 도메인 인증 적용)')
print('범위: 실제 공개 HTTPS·정책 API·익명 인증 경계. 로그인 이후 기능·부하·전체 CDN 전파는 별도.')
