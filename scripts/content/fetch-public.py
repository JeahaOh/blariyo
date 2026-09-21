"""Bounded public HTTPS fetch. Binary stdout: one JSON header, newline, then bytes."""
import ipaddress
import json
import socket
import sys
import urllib.parse
import urllib.request

ALLOWED = {
    'theqoo.net', 'img.theqoo.net', 'img-cdn.theqoo.net', 'img-static.theqoo.net',
    'publish.twitter.com', 'publish.x.com', 'cdn.syndication.twimg.com',
    'platform.twitter.com', 'platform.x.com', 'syndication.twitter.com',
    'pbs.twimg.com', 'video.twimg.com', 'x.com', 'www.x.com', 'twitter.com',
    'www.youtube.com', 'youtube.com', 'youtu.be', 'i.ytimg.com',
    'www.instagram.com', 'instagram.com',
    'imagedelivery.net', 'img1.daumcdn.net', 'blog.kakaocdn.net',
}

def check(url):
    parsed = urllib.parse.urlsplit(url)
    host = parsed.hostname or ''
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('INVALID_HTTPS_URL')
    if host not in ALLOWED and not host.endswith(('.cdninstagram.com', '.fbcdn.net')):
        raise ValueError('HOST_NOT_ALLOWED:' + host)
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError('NON_PUBLIC_ADDRESS')

class Redirects(urllib.request.HTTPRedirectHandler):
    count = 0
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.count += 1
        if self.count > 5:
            raise ValueError('TOO_MANY_REDIRECTS')
        check(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

try:
    url = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20 * 1024 * 1024
    check(url)
    request = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; BlariyoContentImport/1.0)',
        'Accept': '*/*',
    })
    with urllib.request.build_opener(Redirects()).open(request, timeout=25) as response:
        body = response.read(limit + 1)
        if len(body) > limit:
            raise ValueError('RESPONSE_TOO_LARGE')
        header = {'url': response.url, 'status': response.status,
                  'mime': response.headers.get_content_type(), 'bytes': len(body)}
    sys.stdout.buffer.write(json.dumps(header).encode() + b'\n' + body)
except Exception as error:
    print(type(error).__name__ + ':' + str(error), file=sys.stderr)
    sys.exit(1)
