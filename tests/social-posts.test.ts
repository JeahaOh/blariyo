import test from 'node:test';
import assert from 'node:assert/strict';
import {
  socialReference,
  socialDisplayBlocks,
  youtubeFailure,
  tiktokMessage,
} from '../apps/web/app/utils/social-posts.ts';

test('YouTube watch, share, Shorts, live and privacy-enhanced URLs preserve ID and time', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=Jk5P8d5z8-I&t=1m30s&si=tracking',
    'https://youtu.be/Jk5P8d5z8-I?t=90',
    'https://m.youtube.com/live/Jk5P8d5z8-I?start=90',
    'https://www.youtube-nocookie.com/embed/Jk5P8d5z8-I?start=90',
  ]) {
    const reference = socialReference(url);
    assert.equal(reference?.provider, 'YOUTUBE');
    assert.equal(reference?.id, 'Jk5P8d5z8-I');
    assert.equal(reference?.start, 90);
    assert.equal(reference?.url, 'https://www.youtube.com/watch?v=Jk5P8d5z8-I&t=90');
  }
  assert.equal(socialReference('https://youtube.com/shorts/Jk5P8d5z8-I')?.vertical, true);
});
test('Instagram post/reel and TikTok video/photo URLs strip tracking and retain long IDs as strings', () => {
  assert.equal(
    socialReference('https://instagram.com/p/DdWryEimgTl/?img_index=2')?.url,
    'https://www.instagram.com/p/DdWryEimgTl/'
  );
  assert.equal(
    socialReference('https://www.instagram.com/example/reel/DdWryEimgTl/')?.vertical,
    true
  );
  for (const type of ['video', 'photo'])
    assert.equal(
      socialReference(`https://www.tiktok.com/@example/${type}/6718335390845095173?lang=en`)?.id,
      '6718335390845095173'
    );
});
test('untrusted or malformed addresses never become executable embeds', () => {
  for (const url of [
    'http://www.youtube.com/watch?v=Jk5P8d5z8-I',
    'https://youtube.com.evil.test/watch?v=Jk5P8d5z8-I',
    'https://evil@instagram.com/p/DdWryEimgTl/',
    'https://www.tiktok.com:444/@a/video/123',
    'https://youtube.com/watch?v=Jk5P8d5z8-I&v=smTU05BSvpE',
    'https://instagram.com/p/bad<script>/',
    'https://www.youtube.com/embed/Jk5P8d5z8-I/../smTU05BSvpE',
    'https://www.youtube.com/watch?v=short',
    'https://www.tiktok.com/@a/video/123 trailing text',
    'https://www.instagram.com/stories/example/123/',
    'https://vt.tiktok.com/abc123/',
  ])
    assert.equal(socialReference(url), null, url);
});
test('projection preserves article text/images and source data; only standalone SNS URLs become embeds', () => {
  const image = { url: '/media/original.jpg', alt: 'original', width: 600, height: 800 };
  const blocks = [
    { type: 'TEXT' as const, text: '원문 본문\nhttps://youtu.be/Jk5P8d5z8-I' },
    { type: 'TEXT' as const, text: 'https://youtu.be/Jk5P8d5z8-I' },
    { type: 'IMAGE' as const, image },
    { type: 'TEXT' as const, text: 'https://vt.tiktok.com/abc123/' },
    { type: 'TEXT' as const, text: 'https://x.com/example/status/2101299592734400792' },
  ];
  const before = structuredClone(blocks);
  const result = socialDisplayBlocks(blocks);
  assert.deepEqual(
    result.map((block) => block.kind),
    ['TEXT', 'SOCIAL', 'IMAGE', 'LINK', 'X']
  );
  assert.deepEqual(result[0], { kind: 'TEXT', text: blocks[0]?.text });
  assert.deepEqual(result[2], { kind: 'IMAGE', image });
  assert.deepEqual(blocks, before);
});
test('YouTube error categories do not call network or embed restrictions a deletion', () => {
  assert.equal(youtubeFailure(100), 'unavailable');
  assert.equal(youtubeFailure(101), 'restricted');
  assert.equal(youtubeFailure(150), 'restricted');
  assert.equal(youtubeFailure(153), 'failed');
  assert.equal(youtubeFailure(5), 'failed');
});
test('TikTok messages require the exact iframe window, official origin and typed payload', () => {
  const frame = {} as Window;
  const event = (data: unknown, origin = 'https://www.tiktok.com', source = frame) =>
    ({ data, origin, source }) as MessageEvent;
  const ready = { 'x-tiktok-player': true, type: 'onPlayerReady' };
  assert.deepEqual(tiktokMessage(event(ready), frame), { state: 'embedded' });
  assert.equal(tiktokMessage(event(ready, 'https://evil.test'), frame), null);
  assert.equal(tiktokMessage(event(ready, 'https://www.tiktok.com', {} as Window), frame), null);
  assert.equal(tiktokMessage(event('{"type":"onPlayerReady"}'), frame), null);
  assert.equal(tiktokMessage(event(null), frame), null);
  assert.deepEqual(
    tiktokMessage(
      event({ 'x-tiktok-player': true, type: 'onPlayerError', value: { errorCode: 1001 } }),
      frame
    ),
    { state: 'unavailable' }
  );
  assert.deepEqual(
    tiktokMessage(
      event({ 'x-tiktok-player': true, type: 'onPlayerError', value: { errorCode: 2001 } }),
      frame
    ),
    { state: 'failed' }
  );
});
