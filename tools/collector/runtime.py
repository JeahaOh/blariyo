"""Shared, durable job runner used by cron, local HTTP and Discord."""
import asyncio
from contextlib import closing
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
import re
import sqlite3
import time
import uuid
from zoneinfo import ZoneInfo
from croniter import croniter
from collector import CollectError, process_job


class RunStore:
    def __init__(self, path):
        self.path = path
        with closing(self.connect()) as db, db:
            db.execute('''CREATE TABLE IF NOT EXISTS collector_run (
                id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
                trigger TEXT NOT NULL, candidate_id INTEGER, status TEXT NOT NULL,
                created_at REAL NOT NULL, started_at REAL, finished_at REAL, result TEXT)''')
        os.chmod(path, 0o600)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    @staticmethod
    def data(row):
        if not row:
            return None
        return {'runId': row['id'], 'trigger': row['trigger'], 'candidateId': row['candidate_id'],
                'status': row['status'], 'createdAt': row['created_at'], 'startedAt': row['started_at'],
                'finishedAt': row['finished_at'], 'result': json.loads(row['result']) if row['result'] else None}

    def submit(self, trigger, key, candidate_id=None):
        if trigger not in ('API', 'CRON', 'DISCORD') or not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9._:-]{1,128}', key):
            raise CollectError('VALIDATION_FAILED')
        if candidate_id is not None and (type(candidate_id) is not int or not 1 <= candidate_id <= 9007199254740991):
            raise CollectError('VALIDATION_FAILED')
        digest = hashlib.sha256(json.dumps({'candidateId': candidate_id}).encode()).hexdigest()
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT * FROM collector_run WHERE request_key=?', (trigger + ':' + key,)).fetchone()
            if old:
                if old['request_hash'] != digest:
                    raise CollectError('IDEMPOTENCY_CONFLICT')
                return self.data(old)
            if db.execute("SELECT count(*) FROM collector_run WHERE status IN ('QUEUED','RUNNING')").fetchone()[0] >= 100:
                raise CollectError('QUEUE_FULL')
            run_id = str(uuid.uuid4())
            db.execute("INSERT INTO collector_run(id,request_key,request_hash,trigger,candidate_id,status,created_at) VALUES(?,?,?,?,?,'QUEUED',?)", (run_id, trigger + ':' + key, digest, trigger, candidate_id, time.time()))
            db.execute('DELETE FROM collector_run WHERE finished_at<?', (time.time() - 30 * 86400,))
            return self.data(db.execute('SELECT * FROM collector_run WHERE id=?', (run_id,)).fetchone())

    def take(self):
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT * FROM collector_run WHERE status='QUEUED' ORDER BY created_at,id LIMIT 1").fetchone()
            if not row:
                return None
            db.execute("UPDATE collector_run SET status='RUNNING',started_at=? WHERE id=?", (time.time(), row['id']))
            return self.data(db.execute('SELECT * FROM collector_run WHERE id=?', (row['id'],)).fetchone())

    def finish(self, run_id, status, result):
        with closing(self.connect()) as db, db:
            db.execute('UPDATE collector_run SET status=?,result=?,finished_at=? WHERE id=?', (status, json.dumps(result), time.time(), run_id))

    def recover(self):
        with closing(self.connect()) as db, db:
            db.execute("UPDATE collector_run SET status='INTERRUPTED',finished_at=?,result=? WHERE status='RUNNING'", (time.time(), json.dumps({'errorCode': 'PROCESS_INTERRUPTED'})))

    def list(self):
        with closing(self.connect()) as db:
            return [self.data(row) for row in db.execute('SELECT * FROM collector_run ORDER BY created_at DESC,id DESC LIMIT 50')]

    def get(self, run_id):
        with closing(self.connect()) as db:
            return self.data(db.execute('SELECT * FROM collector_run WHERE id=?', (run_id,)).fetchone())


class Schedule:
    def __init__(self, settings, now=None):
        self.enabled = settings.get('enabled', True)
        self.expression = settings.get('cron', '* * * * *')
        self.timezone = settings.get('timezone', 'Asia/Seoul')
        if type(self.enabled) is not bool or len(self.expression.split()) != 5 or not croniter.is_valid(self.expression):
            raise CollectError('CONFIG_INVALID')
        self.zone = ZoneInfo(self.timezone)
        self.next_at = self.next(now or datetime.now(timezone.utc))

    def next(self, now):
        return croniter(self.expression, now.astimezone(self.zone)).get_next(datetime).astimezone(timezone.utc)

    def due(self, now):
        if not self.enabled or now < self.next_at:
            return None
        scheduled = self.next_at
        # A delayed process skips missed slots instead of replaying a backlog.
        self.next_at = self.next(now)
        return scheduled if (now - scheduled).total_seconds() < 60 else None

    def data(self):
        return {'enabled': self.enabled, 'cron': self.expression, 'timezone': self.timezone,
                'nextRunAt': self.next_at.isoformat() if self.enabled else None}


class Runner:
    def __init__(self, api, config, quota, path, processor=process_job):
        self.api, self.config, self.quota, self.processor = api, config, quota, processor
        self.store = RunStore(path)
        self.schedule = Schedule(config.get('server', {}).get('schedule', {}))
        self.batch_size = config.get('server', {}).get('batchSize', 5)
        if type(self.batch_size) is not int or not 1 <= self.batch_size <= 20:
            raise CollectError('CONFIG_INVALID')
        self.worker = self.scheduler = self.lock_file = None
        self.stopping = False
        self.accepting = False
        self.listeners = []
        self.active_run = None

    async def start(self):
        if self.worker:
            raise CollectError('ALREADY_RUNNING')
        self.lock_file = open(self.store.path + '.lock', 'a')
        try:
            fcntl.flock(self.lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.lock_file.close(); self.lock_file = None
            raise CollectError('ALREADY_RUNNING')
        self.store.recover()
        self.stopping = False
        self.accepting = True
        self.worker = asyncio.create_task(self.work())
        self.scheduler = asyncio.create_task(self.tick())

    def submit(self, trigger, key, candidate_id=None):
        if not self.accepting or not self.worker or self.worker.done():
            raise CollectError('NOT_READY')
        return self.store.submit(trigger, key, candidate_id)

    async def stop(self):
        self.accepting = False
        self.stopping = True
        if self.scheduler:
            self.scheduler.cancel()
            try:
                await self.scheduler
            except asyncio.CancelledError:
                pass
        if self.worker:
            await self.worker
        if self.lock_file:
            fcntl.flock(self.lock_file, fcntl.LOCK_UN)
            self.lock_file.close()
        self.worker = self.scheduler = self.lock_file = None

    async def tick(self):
        while not self.stopping:
            due = self.schedule.due(datetime.now(timezone.utc))
            if due:
                try:
                    self.submit('CRON', str(int(due.timestamp())))
                except CollectError:
                    pass  # Queue is bounded. Next scheduled tick can reclaim remaining work.
            await asyncio.sleep(1)

    async def work(self):
        while not self.stopping:
            run = self.store.take()
            if not run:
                await asyncio.sleep(0.1)
                continue
            self.active_run = run['runId']
            results = []
            try:
                for _ in range(1 if run['candidateId'] else self.batch_size):
                    if self.stopping:
                        break
                    claim = {'collectorId': self.api.collector, 'maxItems': 1, 'leaseSeconds': 900}
                    if run['candidateId']:
                        claim['candidateId'] = run['candidateId']
                    jobs = await asyncio.to_thread(self.api.call, '/candidates/claim', claim)
                    if not jobs['items']:
                        break
                    result = await asyncio.to_thread(self.processor, self.api, jobs['items'][0], self.config, self.quota)
                    safe = {key: result[key] for key in ('candidateId', 'status', 'errorCode') if key in result}
                    results.append(safe)
                    for listener in self.listeners:
                        try:
                            await asyncio.wait_for(listener(safe), 5)
                        except Exception:
                            pass
                status = 'SUCCEEDED' if all(r['status'] == 'NEW' for r in results) else 'PARTIAL' if any(r['status'] in ('NEW', 'PARTIAL_PREVIEW') for r in results) else 'FAILED'
                self.store.finish(run['runId'], status, {'processed': len(results), 'items': results})
            except Exception:
                self.store.finish(run['runId'], 'FAILED', {'errorCode': 'RUN_FAILED', 'processed': len(results), 'items': results})
            finally:
                self.active_run = None
