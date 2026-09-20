#!/usr/bin/env python3
import sys,subprocess,fcntl,os
allowed={'publish':'posts:publish-due','outbox':'outbox:run','cleanup':'cleanup:run'}
name=sys.argv[1];assert name in allowed
fd=os.open('/run/blariyo-job.lock',os.O_CREAT|os.O_RDWR,0o600)
try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:print('JOB_SKIPPED_BUSY');sys.exit(0)
r=subprocess.run(['docker','exec','blariyo-app-api-1','node','apps/api/dist/commands/command.js',allowed[name]],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
print('JOB_'+name.upper()+('_OK' if r.returncode==0 else '_FAILED'));sys.exit(0 if r.returncode==0 else 1)
