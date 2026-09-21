import test from 'node:test';
import assert from 'node:assert/strict';
import { displayBlocks, xReference, type BodyBlock } from '../apps/web/app/utils/x-posts.ts';

test('X reference keeps the exact large ID and strips tracking only from a recognized post URL', () => {
  assert.deepEqual(
    xReference(' https://twitter.com/example/status/2101299592734400792/video/1?s=20 '),
    {
      id: '2101299592734400792',
      handle: 'example',
      url: 'https://x.com/example/status/2101299592734400792',
    }
  );
});
test('URLs cannot inject hostnames, credentials, markup, or arbitrary text into an embed', () => {
  for (const value of [
    'https://x.com.evil.test/example/status/123',
    'https://evil@x.com/example/status/123',
    'http://x.com/example/status/123',
    'https://x.com:444/example/status/123',
    'javascript:alert(1)',
    'https://x.com/example',
    'https://x.com/example/status/123 설명',
    '<script>https://x.com/example/status/123</script>',
    'https://x.com/example/status/123/../456',
  ])
    assert.equal(xReference(value), null, value);
});
test('captured author, exact post reference and images become one lossless fallback card', () => {
  const blocks: BodyBlock[] = [
    { type: 'TEXT', text: '작성한 원문 앞 문장' },
    { type: 'TEXT', text: '직접 작성한 이름 (@example)\n직접 작성한 본문\n둘째 줄' },
    { type: 'TEXT', text: 'https://x.com/example/status/123' },
    {
      type: 'IMAGE',
      image: { url: '/media/example.png', alt: '테스트 설명', width: 400, height: 200 },
    },
    { type: 'TEXT', text: '작성한 원문 뒤 문장' },
  ];
  const before = structuredClone(blocks);
  const result = displayBlocks(blocks);
  assert.equal(result.length, 3);
  assert.deepEqual(result[1], {
    kind: 'X',
    reference: { id: '123', handle: 'example', url: 'https://x.com/example/status/123' },
    author: '직접 작성한 이름',
    text: '직접 작성한 본문\n둘째 줄',
    images: [blocks[3]?.type === 'IMAGE' ? blocks[3].image : null],
  });
  assert.deepEqual(blocks, before);
});
test('an unrelated author or bare URL does not swallow adjacent article text or attachments', () => {
  const result = displayBlocks([
    { type: 'TEXT', text: '작성자 (@different)\n같은 SNS 글로 묶으면 안 되는 문장' },
    { type: 'TEXT', text: 'https://x.com/example/status/123' },
    { type: 'IMAGE', image: { url: '/media/other.png', alt: '', width: 1, height: 1 } },
  ]);
  assert.deepEqual(
    result.map((block) => block.kind),
    ['TEXT', 'X', 'IMAGE']
  );
});
test('multiple captured posts stay separate and preserve their order', () => {
  const result = displayBlocks([
    { type: 'TEXT', text: '첫 작성자 (@one)\n첫 본문' },
    { type: 'TEXT', text: 'https://x.com/one/status/111' },
    { type: 'TEXT', text: '둘째 작성자 (@two)\n둘째 본문' },
    { type: 'TEXT', text: 'https://x.com/two/status/222' },
  ]);
  assert.deepEqual(
    result.map((block) => block.kind === 'X' && block.reference.id),
    ['111', '222']
  );
});
