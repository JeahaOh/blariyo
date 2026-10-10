import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAutoPublish, type AutoPublishInput } from '../dist/features/collection/auto-publish-classifier.js';
import { initialRules } from './auto-publish-rules.fixture.js';
const classify = (input: AutoPublishInput) => classifyAutoPublish(input,initialRules);
import { autoPublishArguments } from '../dist/commands/command.js';

const imagePost = (title: string): AutoPublishInput => ({ title,sourceKey:'theqoo',bodyBlocks:[{type:'IMAGE',imagePosition:1,alt:''}],snsLinks:[],media:[{kind:'IMAGE'}] });

await test('clear daily-life and humor titles qualify only when original content exists', () => {
  for (const title of ['아메리카노 가격이 이럴 수 있나', '점심시간 직장인의 황당한 실수', '고양이가 알람을 끄는 웃긴 이유', '아재개그가 이렇게 웃길 줄이야'])
    assert.equal(classify(imagePost(title)).decision,'ELIGIBLE',title);
  const text = imagePost('월요일 출근길 공감되는 실수');
  text.media=[];text.bodyBlocks=[{type:'TEXT',text:'출근길에 가방을 두고 와서 돌아갔는데 지갑도 빠뜨렸습니다. 다시 나가니 같은 실수를 반복한 동료를 만나 함께 웃었습니다.'}];
  assert.equal(classify(text).category,'LIFE');
  text.bodyBlocks=[{type:'TEXT',text:'ㅋㅋ'}];
  assert.equal(classify(text).reason,'INSUFFICIENT_CONTENT');
});

await test('out-of-scope subjects in title or body stay with human review', () => {
  for (const [title,reason] of [
    ['직장인의 황당한 대통령 선거 공감','POLITICS_OR_CONFLICT'],
    ['고양이 배우의 웃긴 영화 근황','NEWS_OR_ENTERTAINMENT'],
    ['커피 마시며 보는 주식 투자 반전','HEALTH_OR_FINANCE'],
    ['직장인이 웃는 네이버페이 포인트 모음','PROMOTION_OR_POINTS'],
    ['강아지 학대 논란의 황당한 현실','ADULT_OR_HARM'],
    ['전세계 사람들이 놀란 신기한 이야기','UNCERTAIN_TOPIC'],
  ]) {
    const result=classify(imagePost(title!));
    assert.equal(result.decision,'REVIEW');assert.equal(result.reason,reason);assert.equal(result.category,null);
  }
  const post=imagePost('점심시간 직장인의 황당한 실수');
  post.bodyBlocks.push({type:'TEXT',text:'본문은 대통령과 선거 이야기입니다.'});
  assert.equal(classify(post).reason,'POLITICS_OR_CONFLICT');
});

await test('external originals, files and oversized content cannot qualify from a benign title',()=>{
  const post=imagePost('고양이가 알람을 끄는 웃긴 이유');
  assert.equal(classify({...post,title:post.title+' https://example.invalid'}).reason,'EXTERNAL_CONTENT');
  assert.equal(classify({...post,snsLinks:['https://example.invalid/social']}).reason,'EXTERNAL_CONTENT');
  assert.equal(classify({...post,bodyBlocks:[{type:'LINK',url:'https://example.invalid',label:'원문'}]}).reason,'EXTERNAL_CONTENT');
  assert.equal(classify({...post,bodyBlocks:[{type:'TEXT',text:'원문 https://example.invalid'}]}).reason,'EXTERNAL_CONTENT');
  assert.equal(classify({...post,media:[{kind:'FILE'}]}).reason,'UNSUPPORTED_ATTACHMENT');
  assert.equal(classify({...post,bodyBlocks:[]}).reason,'INSUFFICIENT_CONTENT');
  assert.equal(classify({...post,bodyBlocks:Array.from({length:101},()=>({type:'TEXT' as const,text:'ㅋㅋ'}))}).reason,'CONTENT_TOO_LARGE');
  assert.equal(classify({...post,media:Array.from({length:21},()=>({kind:'IMAGE'}))}).reason,'CONTENT_TOO_LARGE');
  assert.equal(classify({...post,bodyBlocks:[{type:'TEXT',text:'가'.repeat(6001)}]}).reason,'CONTENT_TOO_LARGE');
});

await test('the dedicated CLI validates dry-run and bounded publication limits before database access',()=>{
  assert.deepEqual(autoPublishArguments([]),{dryRun:false,limit:5});
  assert.deepEqual(autoPublishArguments(['--dry-run','--limit=20']),{dryRun:true,limit:20});
  for (const args of [['--limit=0'],['--limit=21'],['--limit=-1'],['--limit=1.5'],['--limit=01'],['--force'],['--dry-run','--dry-run'],['--limit=1','--limit=2']])
    assert.throws(()=>autoPublishArguments(args));
});

await test('managed keyword scope, disabled words and Unicode word boundaries change classification without regex input',()=>{
  const input=imagePost('직장인의 의사소통 황당한 실수');
  const rules=structuredClone(initialRules);
  const word=rules.items.find(k=>k.keyword==='의사');assert.ok(word);word.matchMode='WORD';
  assert.equal(classifyAutoPublish(input,rules).decision,'ELIGIBLE');
  input.bodyBlocks.push({type:'TEXT',text:'의사 이야기'});
  assert.equal(classifyAutoPublish(input,rules).reason,'HEALTH_OR_FINANCE');
  word.scope='TITLE';assert.equal(classifyAutoPublish(input,rules).decision,'ELIGIBLE');
  word.matchMode='CONTAINS';assert.equal(classifyAutoPublish(input,rules).decision,'REVIEW');
  word.enabled=false;assert.equal(classifyAutoPublish(input,rules).decision,'ELIGIBLE');
  rules.items=rules.items.filter(k=>k.group!=='REACTION');
  assert.equal(classifyAutoPublish(input,rules).reason,'UNCERTAIN_TOPIC');
  rules.items.push({keywordId:'00000000-0000-4000-8000-000000000001',keyword:'ＶＳ',group:'REACTION',scope:'BODY',matchMode:'WORD',enabled:true});
  input.bodyBlocks.push({type:'TEXT',text:'vs'});assert.equal(classifyAutoPublish(input,rules).decision,'ELIGIBLE');
});
