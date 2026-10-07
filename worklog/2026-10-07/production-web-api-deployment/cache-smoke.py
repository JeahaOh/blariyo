import importlib.util,re,hashlib,json
spec=importlib.util.spec_from_file_location('public','deploy/application/check-public.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
results=[]
for path,headers in [('/not-found-deploy-20261007',()),('/api/v1/boards/nonexistent/posts',())]:
 code,h,b=m.get('https://blariyo.com'+path,headers);assert code==404 and 'no-store' in h.get('cache-control','');results.append({'path':path,'status':code,'cache':h['cache-control']})
code,h,b=m.get('https://blariyo.com/api/v1/boards/meme/posts');assert code==200
post=json.loads(b)['data']['items'][0]
code,h,b=m.get('https://blariyo.com/meme/posts/'+str(post['postId']));assert code==200
results.append({'publicDetailStatus':code,'postId':post['postId']})
code,h,b=m.get('https://blariyo.com/meme')
assets=list(dict.fromkeys(re.findall(r'(?:src|href)="(/_nuxt/[^"?]+\.(?:js|css))"',b.decode())))[:4]
assert assets
for path in assets:
 a,ha,ba=m.get('https://blariyo.com'+path);c,hc,bc=m.get('https://blariyo.com'+path+'?deployment=20261007');assert a==c==200 and ba==bc and 'immutable' in ha.get('cache-control','') and 'immutable' in hc.get('cache-control','')
 results.append({'asset':path,'sha256':hashlib.sha256(ba).hexdigest(),'cache':ha['cache-control']})
print(json.dumps(results))
