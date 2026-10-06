import test from 'node:test';
import assert from 'node:assert/strict';
import { draftTitle } from '@blariyo/contracts/draft-title';

await test('draft titles remove known source suffixes and preserve article text', () => {
  const title = '실업급여 받고 여행 왔다는 말에 화가 많이 났다는 강레오';
  assert.equal(draftTitle(title + ' - DogDrip.Net 개드립', 'dogdrip'), title);
  assert.equal(draftTitle('전편 - 후편 - dogdrip.net 개드립 ', 'dogdrip'), '전편 - 후편');
  assert.equal(draftTitle('제목 | 루리웹', 'ruliweb'), '제목');
  assert.equal(draftTitle('제목 — 더쿠', 'theqoo'), '제목');
  assert.equal(draftTitle('글 제목 | 보배드림 베스트글', 'bobaedream'), '글 제목');
  assert.equal(draftTitle('전편 - 후편 | 보배드림 베스트글 ', 'bobaedream'), '전편 - 후편');
  assert.equal(draftTitle('제목 - 베스트 라이브', 'arcalive'), '제목');
  assert.equal(draftTitle('제목 - HIT 갤러리', 'dcinside'), '제목');
  assert.equal(draftTitle('제목 | YULDO', 'yuldo'), '제목');
  for (const value of ['보배드림 베스트글', '| 보배드림 베스트글', '보배드림 베스트글 이야기 - 후편', '제목 | 보배드림 베스트글 이야기']) {
    assert.equal(draftTitle(value, 'bobaedream'), value);
  }
  assert.equal(draftTitle('글 제목 | 보배드림 베스트글', 'dogdrip'), '글 제목 | 보배드림 베스트글');
  for (const value of ['전편 - 후편', '개드립 이야기 - 후편', 'DogDrip.Net 개드립', '- 개드립', '제목 - 개드립 이야기']) {
    assert.equal(draftTitle(value, 'dogdrip'), value);
  }
  assert.equal(draftTitle(title + ' - DogDrip.Net 개드립', 'theqoo'), title + ' - DogDrip.Net 개드립');
  assert.equal(draftTitle('제목 - 미등록', 'unknown'), '제목 - 미등록');
  assert.equal(draftTitle('제목 - toString', 'toString'), '제목 - toString');
  assert.equal(draftTitle('제목 - DogDripXNet', 'dogdrip'), '제목 - DogDripXNet');
  assert.equal(draftTitle('   ', 'dogdrip'), '');
});
