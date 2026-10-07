import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { draftTitle } from '@blariyo/contracts/draft-title';

// Site keys must match the batch registry; adding a site without a title case fails.
const sourceTitles: Record<string, string[]> = {
  arcalive: ['전편 - 후편: 비교 - 베스트 라이브', '전편 - 후편: 비교 - 아카라이브'],
  bobaedream: ['전편 - 후편: 비교 | 보배드림 베스트글'],
  clien: ['전편 - 후편: 비교 : 클리앙'],
  dcinside: ['전편 - 후편: 비교 - HIT 갤러리 - 디시인사이드'],
  dmitory: ['이슈/유머 - 전편 - 후편: 비교', '이슈/유머 - 전편 - 후편: 비교 | 디미토리'],
  dogdrip: ['전편 - 후편: 비교 - DogDrip.Net 개드립'],
  etoland: ['전편 - 후편: 비교 - 유머 게시판 | 이토랜드', '전편 - 후편: 비교 - 유머 게시판'],
  fmkorea: ['전편 - 후편: 비교 - 에펨코리아'],
  goodgag: ['전편 - 후편: 비교 - 고급유머'],
  humoruniv: ['전편 - 후편: 비교 - 웃긴대학'],
  instiz: ['전편 - 후편: 비교 - 인스티즈'],
  inven: ['전편 - 후편: 비교 - 인벤'],
  mlbpark: ['전편 - 후편: 비교 : MLBPARK'],
  natepann: ['전편 - 후편: 비교 | 네이트 판', '전편 - 후편: 비교 | 네이트판', '전편 - 후편: 비교 | 네이트\u00a0판'],
  pgr21: ['전편 - 후편: 비교 - PGR21'],
  ppomppu: ['전편 - 후편: 비교 - 뽐뿌'],
  ruliweb: ['전편 - 후편: 비교 | 루리웹'],
  theqoo: ['더쿠 - 전편 - 후편: 비교', '더쿠 - 전편 - 후편: 비교 | 더쿠'],
  todayhumor: ['오늘의유머 - 전편 - 후편: 비교'],
  yuldo: ['전편 - 후편: 비교 - 유머/이슈 - YULDO', '전편 - 후편: 비교 - 유머/이슈', '전편 - 후편: 비교 - 유머/이슈 | 율도'],
  'youtube-community': ['전편 - 후편: 비교 - YouTube'],
};

await test('title regression cases cover every registered batch source', async () => {
  const registry: unknown = JSON.parse(await readFile(new URL('../apps/collector/ops/reference-sites.sources.example.json', import.meta.url), 'utf8'));
  assert.ok(registry && typeof registry === 'object' && !Array.isArray(registry));
  assert.deepEqual(Object.keys(sourceTitles).sort(), Object.keys(registry).sort());
});

for (const [source, titles] of Object.entries(sourceTitles)) {
  await test(`${source}: source and board labels are removed while article punctuation survives`, () => {
    for (const title of titles) {
      const normalized = draftTitle(title, source);
      assert.equal(normalized, '전편 - 후편: 비교');
      assert.equal(draftTitle(normalized, source), normalized);
    }
    assert.equal(draftTitle('출처 표기가 없는 제목 - 후편', source), '출처 표기가 없는 제목 - 후편');
  });
}

await test('label-like article text, empty remainders and other source names are preserved', () => {
  for (const [source, title] of [
    ['natepann', '네이트 판'], ['natepann', '| 네이트 판'],
    ['natepann', '네이트 판 이야기 - 후편'], ['natepann', '글 제목 | 네이트 판 이야기'],
    ['theqoo', '더쿠 -'], ['theqoo', '더쿠 이야기 - 후편'],
    ['dmitory', '이슈/유머 -'], ['dmitory', '글 제목 - 이슈/유머 이야기'],
    ['yuldo', '유머/이슈'], ['yuldo', '글 제목 - 유머/이슈 이야기'],
    ['mlbpark', '글 제목 : MLBPARK 이야기'], ['clien', '클리앙'],
    ['dogdrip', '글 제목 | 네이트 판'], ['natepann', '더쿠 - 글 제목'],
    ['unknown', '글 제목 | 네이트 판'], ['__proto__', '글 제목 - toString'],
  ] as const) assert.equal(draftTitle(title, source), title);
});

await test('Todayhumor leading source label is removed without truncating article text', () => {
  assert.equal(draftTitle('오늘의유머 - 예비군 이야기 - 후편', 'todayhumor'), '예비군 이야기 - 후편');
  assert.equal(draftTitle('  오늘의유머 - 글 제목  ', 'todayhumor'), '글 제목');
  assert.equal(draftTitle('오늘의유머 - 글 제목 | 오늘의유머', 'todayhumor'), '글 제목');
  assert.equal(draftTitle('오늘의유머 - 글 제목', 'dogdrip'), '오늘의유머 - 글 제목');
  for (const value of ['오늘의유머', '오늘의유머 -', '오늘의유머 이야기 - 후편', '글 제목 - 오늘의유머 이야기']) {
    assert.equal(draftTitle(value, 'todayhumor'), value);
  }
});

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
