import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
import tempfile
import threading
import unittest
from types import SimpleNamespace
from aiohttp.test_utils import TestClient, TestServer
from collector import CollectError
from runtime import Runner, RunStore, Schedule
from server import create_app


class StoreTests(unittest.TestCase):
    def test_idempotency_recovery_and_persistence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory)/'state.db')
            store = RunStore(path)
            first = store.submit('API','same',1)
            self.assertEqual(store.submit('API','same',1)['runId'],first['runId'])
            with self.assertRaises(CollectError): store.submit('API','same',2)
            store.take()
            restarted = RunStore(path);restarted.recover()
            self.assertEqual(restarted.get(first['runId'])['status'],'INTERRUPTED')
            queued = store.submit('DISCORD','second',2)
            self.assertEqual(restarted.take()['runId'],queued['runId'])

    def test_cron_timezone_no_duplicate_and_skip_misfire(self):
        schedule = Schedule({'cron':'30 7 * * *','timezone':'Asia/Seoul'},datetime(2026,9,7,22,0,tzinfo=timezone.utc))
        self.assertEqual(schedule.next_at,datetime(2026,9,7,22,30,tzinfo=timezone.utc))
        self.assertIsNotNone(schedule.due(datetime(2026,9,7,22,30,1,tzinfo=timezone.utc)))
        self.assertIsNone(schedule.due(datetime(2026,9,7,22,30,2,tzinfo=timezone.utc)))
        self.assertIsNone(schedule.due(datetime(2026,9,10,22,31,tzinfo=timezone.utc)))
        with self.assertRaises(CollectError): Schedule({'cron':'0 30 7 * * *'})


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = str(Path(self.directory.name)/'state.db')
        self.seen = []
        self.config = {'server':{'schedule':{'enabled':False}}}
        self.api = SimpleNamespace(collector='fixture',call=lambda path,body:{'items':[{'candidateId':body.get('candidateId',1)}]})
        self.processor = lambda api,job,config,quota: self.seen.append(job['candidateId']) or {'candidateId':job['candidateId'],'status':'NEW'}
        self.runner = Runner(self.api,self.config,None,self.path,self.processor)
        self.client = TestClient(TestServer(create_app(self.runner,'x'*40)))
        await self.client.start_server()
        self.headers = {'Authorization':'Bearer '+'x'*40,'Idempotency-Key':'first'}

    async def asyncTearDown(self):
        await self.client.close()
        self.directory.cleanup()

    async def wait_finished(self, run_id):
        for _ in range(200):
            result=self.runner.store.get(run_id)
            if result['finishedAt']: return result
            await asyncio.sleep(.01)
        self.fail('run did not finish')

    async def test_real_http_auth_validation_and_run_readback(self):
        self.assertEqual((await self.client.get('/health')).status,401)
        self.assertEqual((await self.client.post('/v1/runs',headers={**self.headers,'Origin':'http://untrusted.example'},json={})).status,403)
        self.assertEqual((await self.client.post('/v1/runs',headers=self.headers,json={'candidateId':True})).status,400)
        self.assertEqual((await self.client.post('/v1/runs',headers=self.headers,json={'extra':1})).status,400)
        response=await self.client.post('/v1/runs',headers=self.headers,json={'candidateId':8})
        self.assertEqual(response.status,202);run=await response.json()
        duplicate=await self.client.post('/v1/runs',headers=self.headers,json={'candidateId':8})
        self.assertEqual((await duplicate.json())['runId'],run['runId'])
        self.assertEqual((await self.client.post('/v1/runs',headers=self.headers,json={'candidateId':9})).status,409)
        self.assertEqual((await self.wait_finished(run['runId']))['status'],'SUCCEEDED')
        self.assertEqual(self.seen,[8])
        self.assertEqual((await self.client.get('/v1/runs/'+run['runId'],headers=self.headers)).status,200)
        self.assertEqual((await self.client.get('/v1/schedule',headers=self.headers)).status,200)

    async def test_cron_api_discord_share_serial_runner_and_health_stays_responsive(self):
        entered, release=threading.Event(),threading.Event()
        active=0;maximum=0
        def slow(api,job,config,quota):
            nonlocal active,maximum
            active+=1;maximum=max(maximum,active);entered.set();release.wait(5);active-=1
            return {'candidateId':job['candidateId'],'status':'NEW'}
        self.runner.processor=slow
        a=self.runner.submit('API','a',1)
        b=self.runner.submit('CRON','b',2)
        c=self.runner.submit('DISCORD','c',3)
        try:
            self.assertTrue(await asyncio.to_thread(entered.wait,2))
            health=await asyncio.wait_for(self.client.get('/health',headers=self.headers),1)
            self.assertEqual(health.status,200)
            self.assertEqual((await health.json())['activeRunId'],a['runId'])
        finally: release.set()
        for run in (a,b,c): self.assertEqual((await self.wait_finished(run['runId']))['status'],'SUCCEEDED')
        self.assertEqual(maximum,1)

    async def test_scheduler_actually_enqueues_and_shutdown_waits_for_active_job(self):
        self.runner.batch_size = 1
        self.runner.schedule.enabled = True
        self.runner.schedule.next_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        for _ in range(200):
            rows = self.runner.store.list()
            if rows and rows[0]['finishedAt']:
                break
            await asyncio.sleep(.01)
        self.assertEqual(rows[0]['trigger'], 'CRON')
        self.assertEqual(rows[0]['status'], 'SUCCEEDED')
        entered, release = threading.Event(), threading.Event()
        def slow(*args):
            entered.set(); release.wait(5)
            return {'candidateId': 2, 'status': 'NEW'}
        self.runner.processor = slow
        self.runner.schedule.enabled = False
        run = self.runner.submit('API', 'shutdown', 2)
        self.assertTrue(await asyncio.to_thread(entered.wait,2))
        stopping = asyncio.create_task(self.runner.stop())
        await asyncio.sleep(.02)
        self.assertFalse(stopping.done())
        with self.assertRaises(CollectError): self.runner.submit('API','after-stop',3)
        release.set()
        await stopping
        self.assertEqual(self.runner.store.get(run['runId'])['status'], 'SUCCEEDED')

    async def test_single_process_guard_and_failure_history(self):
        other=Runner(self.api,self.config,None,self.path,self.processor)
        with self.assertRaises(CollectError): await other.start()
        def failed(*args): raise RuntimeError('must never appear in HTTP or history')
        self.runner.processor=failed
        run=self.runner.submit('API','failure',4)
        result=await self.wait_finished(run['runId'])
        self.assertEqual(result['status'],'FAILED')
        self.assertEqual(result['result']['errorCode'],'RUN_FAILED')
        self.assertNotIn('must never',str(result))
