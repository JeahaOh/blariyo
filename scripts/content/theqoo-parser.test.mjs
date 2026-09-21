import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTheqoo, referenceInventory, socialReference } from './theqoo-parser.mjs';
import { jsonArgument, noteTweetText } from './embedded-json.mjs';

const source = 'https://theqoo.net/hot/123';
const page = (body) =>
  `<html><head><meta property="og:title" content="직접 작성한 테스트 제목"></head><body><img src="/logo.png"><article itemprop="articleBody">${body}</article><aside>추천글</aside></body></html>`;

test('preserves body order, original text, lazy images and bare SNS URLs', () => {
  const result = parseTheqoo(
    page(
      '<p>직접 작성한 첫 문장 &amp; 기호</p><p><img src="data:image/gif;base64,AA" data-src="//img.theqoo.net/example.png"></p><p>https://x.com/example/status/12345</p><p>마지막 문장</p>'
    ),
    source
  );
  assert.deepEqual(result.blocks, [
    { kind: 'text', text: '직접 작성한 첫 문장 & 기호' },
    { kind: 'image', url: 'https://img.theqoo.net/example.png', alt: '' },
    {
      kind: 'social',
      provider: 'X',
      url: 'https://x.com/i/status/12345',
      originalUrl: 'https://x.com/example/status/12345',
    },
    { kind: 'text', text: '마지막 문장' },
  ]);
});

test('retains attachments and media inside the article but ignores scripts and page chrome', () => {
  const result = parseTheqoo(
    page(
      '<script>secret()</script><a href="https://example.com/image"><img src="/one.jpg" alt="직접 작성한 설명"></a><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><video poster="/cover.jpg"><source src="/video.mp4"></video>'
    ),
    source
  );
  assert.deepEqual(
    result.blocks.map((block) => block.kind),
    ['image', 'social', 'video']
  );
  assert.equal(result.blocks[1].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(result.blocks[2].urls[0], 'https://theqoo.net/video.mp4');
});

test('missing body and missing image URL are visible failures, never generated summaries', () => {
  assert.throws(
    () => parseTheqoo('<title>not a detail page</title>', source),
    /ARTICLE_BODY_NOT_UNIQUE/
  );
  const result = parseTheqoo(page('<p>테스트 본문</p><img src="javascript:alert(1)">'), source);
  assert.deepEqual(result.issues, [{ code: 'IMAGE_URL_MISSING', position: 1 }]);
});

test('reference inventory excludes body text and preserves both SNS references', () => {
  const result = referenceInventory(
    parseTheqoo(
      page(
        '<p>이 문장은 저장하지 않는 테스트 본문</p><p>https://x.com/a/status/111</p><p>https://x.com/b/status/222</p>'
      ),
      source
    )
  );
  assert.equal(result.references.length, 2);
  assert.equal(JSON.stringify(result).includes('이 문장은'), false);
  assert.equal(result.references[1].url, 'https://x.com/i/status/222');
});

test('normalizes SNS post references without treating profile pages as posts', () => {
  assert.equal(socialReference('https://x.com/example'), null);
  assert.equal(
    socialReference('https://twitter.com/example/status/123/photo/1').url,
    'https://x.com/i/status/123'
  );
});

test('reads the observed document title when og:title is absent', () => {
  const html =
    '<html><head><title>더쿠 - 직접 작성한 제목</title></head><body><article itemprop="articleBody"><p>테스트</p></article></body></html>';
  assert.equal(parseTheqoo(html, source).title, '직접 작성한 제목');
});

test('reads nested embed JSON with escaped braces without executing surrounding code', () => {
  const payload = { text: 'quote " and brace }', nested: { media: [1, 2] } };
  assert.deepEqual(
    jsonArgument(`danger();s.handle(${JSON.stringify(payload)});danger();`, 's.handle('),
    payload
  );
  assert.throws(() => jsonArgument('s.handle({"x":', 's.handle('), /INCOMPLETE/);
});

test('reads only the expected public X note without evaluating surrounding JavaScript', () => {
  const id = Buffer.from('NoteTweetResults:12345').toString('base64');
  const text = '직접 작성한 긴 글\n따옴표 "와 역슬래시 \\ 테스트';
  const script = `danger();$R[9]={__typename:"NoteTweet",rest_id:"12345",text:${JSON.stringify(text)},other:$R[3]};`;
  assert.deepEqual(noteTweetText(script, id), { id: '12345', text });
  assert.throws(
    () => noteTweetText(script, Buffer.from('NoteTweetResults:999').toString('base64')),
    /NOT_UNIQUE/
  );
  assert.throws(() => noteTweetText(script, 'bad'), /INVALID/);
});
