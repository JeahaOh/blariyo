import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {LocalCollectReader,S3CollectReader,collectReader} from '../dist/adapters/collect-reader.js';

await test('collect reader validates its configuration and cannot escape local collect/media',async t=>{
  const root=await mkdtemp('/private/tmp/blariyo-reader-');
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(root+'/collect/media',{recursive:true});
  await writeFile(root+'/collect/media/valid',Buffer.from('fixture'));
  await writeFile(root+'/outside',Buffer.from('private fixture'));
  await symlink(root+'/outside',root+'/collect/media/link');
  const reader=new LocalCollectReader(root+'/collect');
  await assert.rejects(reader.read('collect/media/valid',10));
  const all=new LocalCollectReader(root);
  assert.equal((await all.read('collect/media/valid',10)).toString(),'fixture');
  await assert.rejects(all.read('collect/media/valid',2),/TOO_LARGE/);
  for(const path of ['../outside','collect/media/../outside','content/private/a','collect/media/%2e%2e/a','collect/media//a'])
    await assert.rejects(all.read(path,10),/INVALID/);
  // Symlinks inside the root are permitted; an external target is rejected.
  await symlink('/etc/hosts',root+'/collect/media/external');
  await assert.rejects(all.read('collect/media/external',4096),/INVALID/);
  await assert.rejects(collectReader({}).read('collect/media/x',10),/NOT_CONFIGURED/);
  assert.throws(()=>collectReader({COLLECT_BATCH_REVIEW_ENABLED:'true'}),/REQUIRED/);
  assert.throws(()=>collectReader({COLLECT_BATCH_REVIEW_ENABLED:'true',NODE_ENV:'production',COLLECT_READER_DIRECTORY:root}),/FORBIDDEN/);
  assert.throws(()=>new S3CollectReader('collect-bucket','http://external.invalid','fixture','fixture'),/INVALID/);
});

await test('S3 collect adapter only sends signed GET to its bucket and bounds a chunked response',async t=>{
  const seen:Array<{method:string;path:string;authorization:string}>=[];
  const server=createServer((request,response)=>{
    seen.push({method:request.method??'',path:request.url??'',authorization:request.headers.authorization??''});
    if(request.url?.includes('missing')){response.writeHead(404,{'content-type':'application/xml'});response.end('<Error><Code>NoSuchKey</Code></Error>');return;}
    response.writeHead(200,{'content-type':'application/octet-stream'});
    response.write('1234');response.end('5678');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const reader=new S3CollectReader('collect-bucket',`http://127.0.0.1:${address.port}`,'fixture-reader','fixture-secret');
  t.after(async()=>{reader.onApplicationShutdown();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
  assert.equal((await reader.read('collect/media/id/1',8)).toString(),'12345678');
  await assert.rejects(reader.read('collect/media/id/large',5),/TOO_LARGE/);
  await assert.rejects(reader.read('collect/media/id/missing',8));
  const count=seen.length;await assert.rejects(reader.read('collect/raw/id/1',8),/INVALID/);assert.equal(seen.length,count);
  assert.ok(seen.every(r=>r.method==='GET'&&r.path.startsWith('/collect-bucket/collect/media/')&&r.authorization.includes('Credential=fixture-reader/')));
});
