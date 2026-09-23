import test from 'node:test';
import assert from 'node:assert/strict';
import {textLinks} from '../app/utils/text-links.mjs';

test('external links preserve labels, line breaks, Korean paths and punctuation',()=>{
  const text='원문 (https://example.com/한글?q=1).\n설명 https://example.com/a_(b)! 끝';
  const parts=textLinks(text);
  assert.equal(parts.map(p=>p.text).join(''),text);
  assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),['https://example.com/%ED%95%9C%EA%B8%80?q=1','https://example.com/a_(b)']);
});
test('untrusted markup and credential-bearing URLs remain text; no data is removed',()=>{
  const text='<script>alert(1)</script> javascript:alert(1) https://user:secret@example.com/ https://invalid%host/';
  const parts=textLinks(text);
  assert.equal(parts.map(p=>p.text).join(''),text);
  assert.equal(parts.some(p=>p.href),false);
});
