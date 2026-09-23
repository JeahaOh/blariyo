import { open, chmod, lstat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

// Authentication cookies rotate; the actor identity used for receipts must survive restart.
export async function localActorSecret(directory) {
  const path=join(directory,'actor-secret');
  try {
    const file=await open(path,'wx',0o600);
    try {await file.writeFile(randomBytes(32).toString('hex'));}
    finally {await file.close();}
  } catch(error) {if(error.code!=='EEXIST')throw error;}
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink())throw Error('LOCAL_ACTOR_SECRET_INVALID');
  await chmod(path,0o600);
  const file=await open(path,'r');
  try {
    if((await file.stat()).size!==64)throw Error('LOCAL_ACTOR_SECRET_INVALID');
    const secret=await file.readFile('utf8');
    if(!/^[a-f0-9]{64}$/.test(secret))throw Error('LOCAL_ACTOR_SECRET_INVALID');
    return secret;
  } finally {await file.close();}
}
