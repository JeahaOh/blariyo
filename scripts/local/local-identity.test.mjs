import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { localActorSecret } from './local-identity.mjs';

test('local actor survives restart and does not silently rotate corrupt identity',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blariyo-local-identity-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,'actor-secret');
  const first=await localActorSecret(directory);
  await chmod(path,0o644);
  const second=await localActorSecret(directory);
  assert.equal(first,second);
  const actor=secret=>createHmac('sha256',secret).update('local-fixture-operator').digest('base64url');
  assert.equal(actor(first),actor(second));
  assert.equal((await stat(path)).mode&0o777,0o600);
  await writeFile(path,'invalid');
  await assert.rejects(localActorSecret(directory),/LOCAL_ACTOR_SECRET_INVALID/);
  assert.equal(await readFile(path,'utf8'),'invalid');
});
test('local actor identity refuses symlink targets',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blariyo-local-identity-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const target=join(directory,'unrelated');await writeFile(target,'x'.repeat(64));
  await symlink(target,join(directory,'actor-secret'));
  await assert.rejects(localActorSecret(directory),/LOCAL_ACTOR_SECRET_INVALID/);
  assert.equal(await readFile(target,'utf8'),'x'.repeat(64));
});
