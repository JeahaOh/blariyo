import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from collector import CollectError, DetailParser, Fetcher, Quota, checked_url, public_addresses, process_job

RULES = {'enabled': True, 'parserVersion': 'test-v1', 'detailPathPattern': r'^/[0-9]+$', 'titleSelector': 'h1', 'bodySelector': '.article', 'imageHosts': ['images.example']}

class CollectorTests(unittest.TestCase):
    def test_url_boundaries(self):
        self.assertEqual(checked_url('https://source.example/1#x', ['source.example']), 'https://source.example/1')
        for url in ('http://source.example/1', 'https://user:pass@source.example/1', 'https://source.example:444/1', 'https://other.example/1', 'file:///etc/passwd'):
            with self.assertRaises((CollectError, ValueError)):
                checked_url(url, ['source.example'])

    def test_dns_rebinding_and_private_ranges(self):
        for address in ('127.0.0.1', '10.1.2.3', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1'):
            with patch('socket.getaddrinfo', return_value=[(None,None,None,None,('1.1.1.1',443)),(None,None,None,None,(address,443))]):
                with self.assertRaises(CollectError):
                    public_addresses('source.example')

    def test_explicit_body_and_markup_removed(self):
        title, canonical, images = DetailParser(RULES,'https://source.example/1').extract('<h1>제목 <script>secret</script><b>&amp; 설명</b></h1><img src="https://ads.example/a"><div class="article"><img data-src="https://images.example/a.png"><img src="https://images.example/a.png"></div>')
        self.assertEqual(title,'제목 & 설명'); self.assertEqual(images,['https://images.example/a.png'])
        self.assertEqual(canonical,'https://source.example/1')
        with self.assertRaises(CollectError):
            DetailParser(RULES,'https://source.example/1').extract('<h1>제목</h1><img src="https://images.example/a.png">')
        with self.assertRaises(CollectError):
            DetailParser(RULES,'https://source.example/1').extract('<h1>제목</h1><div class="article"><img src="https://unapproved.example/a"></div>')

    def test_redirect_and_response_caps_before_untrusted_fetch(self):
        source = {'isActive': True, 'robotsAllowed': True, 'robotsCheckedAt': 'checked', 'host': 'source.example', 'requestIntervalMs': 1000, 'dailyFetchLimit': 100}
        fetcher = Fetcher({'userAgent': 'Fixture'}, SimpleNamespace(reserve=lambda *args: None), lambda: source)
        class Response:
            status = 302
            def getheader(self, name, default=None):
                return {'Location': 'https://private.example/1'}.get(name, default)
        connection = SimpleNamespace(request=lambda *args, **kwargs: None, getresponse=lambda: Response(), close=lambda: None)
        with patch('collector.public_addresses', return_value=['1.1.1.1']), patch('collector.PinnedHTTPS', return_value=connection) as opened:
            with self.assertRaises(CollectError):
                fetcher.get('https://source.example/1',['source.example'],100,'text/html')
            self.assertEqual(opened.call_count, 1)
        source['isActive'] = False
        with patch('collector.PinnedHTTPS') as opened:
            with self.assertRaises(CollectError):
                fetcher.get('https://source.example/1',['source.example'],100,'text/html')
            opened.assert_not_called()

    def test_quota_survives_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory)/'quota.db')
            Quota(path).reserve('source.example',1000,1)
            with self.assertRaises(CollectError):
                Quota(path).reserve('source.example',1000,1)

    def test_unconfigured_source_never_fetches(self):
        calls=[]
        api=SimpleNamespace(collector='fixture',call=lambda path,body: calls.append((path,body)))
        job={'candidateId':1,'lockVersion':2,'sourceHost':'source.example'}
        with patch('collector.PinnedHTTPS') as connection:
            result=process_job(api,job,{'sources':{}},None)
            connection.assert_not_called()
        self.assertEqual(result['errorCode'],'SOURCE_NOT_CONFIGURED')
        self.assertEqual(calls[0][1]['status'],'FETCH_FAILED')

    def test_offline_pipeline_and_partial_preview(self):
        class FixtureAPI:
            collector='fixture'
            def __init__(self, fail=False): self.calls=[];self.fail=fail
            def call(self,path,body,file=None):
                self.calls.append((path,body))
                if path.endswith('/heartbeat'):
                    return {'lockVersion':body['lockVersion']+1,'source':{'host':'source.example','isActive':True,'robotsAllowed':True,'robotsCheckedAt':'2026-09-08','requestIntervalMs':1000,'dailyFetchLimit':100}}
                if path.endswith('/result'):
                    return {'lockVersion':body['lockVersion']+1,'imageCandidates':[{'candidateImageId':1}]}
                if self.fail: raise CollectError('API_UNAVAILABLE')
                return {'lockVersion':body['lockVersion']+1}
        def get(fetcher,url,hosts,maximum,mime,authorize=None):
            fetcher.heartbeat()
            if url.endswith('/robots.txt'): return b'User-agent: *\nAllow: /','text/plain',url
            if mime=='text/html': return b'<h1>Title</h1><div class="article"><img src="https://images.example/1.png"></div>','text/html',url
            return b'fixture-image','image/png',url
        job={'candidateId':1,'lockVersion':2,'sourceHost':'source.example','originUrl':'https://source.example/1'}
        for failed in (False,True):
            api=FixtureAPI(failed)
            with patch('collector.Fetcher.get',get): result=process_job(api,job,{'userAgent':'Fixture','sources':{'source.example':RULES}},None)
            self.assertEqual(result['status'],'PARTIAL_PREVIEW' if failed else 'NEW')
            results=[body for path,body in api.calls if path.endswith('/result')]
            self.assertEqual(len(results),1);self.assertEqual(results[0]['status'],'NEW')

class DiscordTests(unittest.IsolatedAsyncioTestCase):
    async def test_permissions_and_commands_without_connection(self):
        from discord_bot import permitted, CollectorClient
        settings={'guildIds':['1'],'channelIds':['2'],'userIds':['3']}
        good=SimpleNamespace(guild_id=1,channel_id=2,user=SimpleNamespace(id=3))
        self.assertTrue(permitted(good,settings))
        for key,value in [('guild_id',9),('channel_id',9),('user',SimpleNamespace(id=9))]:
            altered=SimpleNamespace(**vars(good));setattr(altered,key,value);self.assertFalse(permitted(altered,settings))
        client=CollectorClient(settings,None,{},None)
        self.assertEqual(client.intents.value,0)
        self.assertEqual([c.name for c in client.group.commands],['url','status'])
        await client.close()

if __name__=='__main__': unittest.main()
