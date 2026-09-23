#!/usr/bin/env python3
"""Exercise two local immutable API images on a disposable V005 -> V008 database. No SSH/push."""
import argparse
import json
from pathlib import Path
import re
import secrets
import subprocess
import time

HERE = Path(__file__).resolve().parent
ID = re.compile(r'sha256:[a-f0-9]{64}')


def run(args, data=None):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
    if result.returncode:
        # The fixture contains no production inputs, but do not dump arguments/env/SQL on failure.
        raise RuntimeError('COMMAND_FAILED: ' + result.stderr.decode()[-1800:])
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous-image', required=True)
    parser.add_argument('--candidate-image', required=True)
    args = parser.parse_args()
    for image in [args.previous_image, args.candidate_image]:
        if not ID.fullmatch(image):
            raise ValueError('IMMUTABLE_LOCAL_IMAGE_REQUIRED')
        actual = json.loads(run(['docker', 'image', 'inspect', image, '--format', '{{json .}}']))
        assert actual['Id'] == image and actual['Architecture'] == 'amd64' and actual['Os'] == 'linux'
    prefix = 'blariyo-release-compat-' + secrets.token_hex(6)
    resources = []
    primary = None
    stages = []
    print('Owned prefix: ' + prefix, flush=True)
    try:
        run(['docker','network','create','--internal',prefix]);resources.append(('network',prefix))
        db = prefix + '-db'
        run(['docker','run','-d','--name',db,'--network',prefix,'--network-alias','db','--tmpfs','/var/lib/postgresql','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB=fixture','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:18'])
        resources.append(('container',db))
        for _ in range(100):
            try:
                run(['docker','exec',db,'pg_isready','-h','127.0.0.1','-U','fixture','-d','fixture']);break
            except RuntimeError:time.sleep(.2)
        else:raise RuntimeError('DB_NOT_READY')
        def sql(value):
            return run(['docker','exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','fixture','-d','fixture'],value.encode()).decode().strip()
        sql('CREATE ROLE blariyo_app LOGIN;')
        volume = prefix + '-media'
        run(['docker','volume','create',volume]);resources.append(('volume',volume))
        run(['docker','run','--rm','--platform','linux/amd64','--network','none','--user','0','--mount',f'type=volume,source={volume},target=/compat-data',args.previous_image,'chown','1000:1000','/compat-data'])
        def migrate(image):
            run(['docker','run','--rm','--platform','linux/amd64','--network',prefix,'-e','DATABASE_URL=postgres://fixture@db:5432/fixture','-e','DB_APP_ROLE=blariyo_app',image,'node','apps/api/dist/commands/migrate.js'])
        def ledger():return sql("SELECT version FROM ops.schema_migration ORDER BY version").splitlines()
        def check(label,image,mode):
            name=prefix+'-runner'
            # Record before launch so an interrupted/failed run is still explicitly cleaned up.
            resources.append(('container',name))
            output=run(['docker','run','--rm','--name',name,'--platform','linux/amd64','--network',prefix,'--read-only','--memory','256m','--memory-swap','384m','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:mode=1777','--mount',f'type=volume,source={volume},target=/compat-data','--mount',f'type=bind,source={HERE / "fixtures/release-compatibility.mjs"},target=/fixtures/check.mjs,readonly','-e','DATABASE_URL=postgres://blariyo_app@db:5432/fixture',image,'node','/fixtures/check.mjs',mode])
            resources.remove(('container',name))
            result=json.loads(output);stages.append({'stage':label,'image':image,**result});print(json.dumps(stages[-1]),flush=True)
        migrate(args.previous_image)
        assert ledger()==['V001','V002','V003','V004','V005']
        check('previous-on-V005',args.previous_image,'seed')
        check('candidate-on-V005',args.candidate_image,'exercise')
        check('previous-after-candidate-writes-on-V005',args.previous_image,'exercise')
        migrate(args.candidate_image)
        assert ledger()==['V001','V002','V003','V004','V005','V006','V007','V008']
        check('candidate-on-V008',args.candidate_image,'exercise')
        before=sql('SELECT count(*) FROM content.board_post; SELECT count(*) FROM content.board_post_status_history;')
        check('previous-on-V008-rejected',args.previous_image,'not-ready')
        assert sql('SELECT count(*) FROM content.board_post; SELECT count(*) FROM content.board_post_status_history;')==before
        assert sql("SELECT count(*) FROM pg_stat_activity WHERE datname='fixture' AND pid<>pg_backend_pid()")=='0'
        print(json.dumps({'status':'PASS','stages':len(stages),'rollbackOnV005':True,'rollbackOnV008':False,'productionVerified':False}),flush=True)
    except BaseException as error:
        primary=error
        raise
    finally:
        failures=[]
        for kind,name in reversed(resources):
            args=['docker','rm','-f',name] if kind=='container' else ['docker',kind,'rm',name]
            try:run(args)
            except RuntimeError:
                # --rm runners may have already disappeared; inspect that exact resource.
                probe=subprocess.run(['docker',kind,'inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                if probe.returncode==0:failures.append(name)
        print(json.dumps({'cleanup':'FAILED' if failures else 'PASS','remainingOwnedResources':failures}),flush=True)
        if failures and primary is None:raise RuntimeError('CLEANUP_FAILED')


if __name__=='__main__':main()
