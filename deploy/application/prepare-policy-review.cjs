#!/usr/bin/env node
'use strict';

// Private local review only: no network, policy artifact, DB connection or deployment.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { fields, prepare, validate } = require('./prepare-public-config.cjs');
const templateDirectory = path.resolve(__dirname, '../../docs/legal/m0-core');
const documents = { terms: '이용약관', privacy: '개인정보처리방침', rights: '권리자 요청', cookies: '쿠키 안내' };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderTemplate(template, config) {
  // Replace trusted template tokens once; never interpret contact text as markup or tokens.
  for (const match of template.matchAll(/{{([^{}]+)}}/g)) {
    if (!Object.hasOwn(fields, match[1])) throw new Error('UNKNOWN_TEMPLATE_FIELD');
  }
  const withoutTokens = template.replace(/{{([^{}]+)}}/g, '');
  if (withoutTokens.includes('{{') || withoutTokens.includes('}}')) throw new Error('INVALID_TEMPLATE');
  return template.replace(/{{([^{}]+)}}/g, (_, key) => escapeHtml(config[key]));
}

function page(title, body) {
  const nav = Object.entries(documents).map(([key, label]) => `<a href="${key}.html">${label}</a>`).join('');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)} · 블라리요 검토본</title>
<style>body{margin:0;background:#f4f5f7;color:#20242c;font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.8}main{max-width:850px;margin:32px auto;padding:32px;background:white;border-radius:12px}h1{font-size:28px;line-height:1.35}h2{font-size:20px;margin-top:32px}p,li,td{overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:8px 20px;border-bottom:1px solid #ddd;padding-bottom:16px}a{color:#2456aa}.notice{padding:14px 18px;background:#fff1d1;border-left:4px solid #aa6700;margin:20px 0}.pending{color:#8b3700;background:#fff1d1}table{width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed}th,td{border:1px solid #d8dce3;padding:10px;text-align:left;vertical-align:top}th{background:#f3f5f8}@media(max-width:600px){main{margin:0;padding:20px;border-radius:0}table{font-size:13px}th,td{padding:6px}}@media print{nav{display:none}main{margin:0;padding:0}}</style></head>
<body><main><nav><a href="index.html">검토 안내</a>${nav}</nav>
<div class="notice"><strong>공개 정책 편집본</strong> — 저장된 연락처를 넣은 로컬 문서입니다. 운영 공개본과 변경 사항을 비교하는 용도이며, 이 파일로 정책이 발행되지는 않습니다.</div>
${body}
</main></body></html>\n`;
}

async function generate(directory = path.join(os.homedir(), '.config/blariyo')) {
  const { config } = prepare(directory, false);
  await validate(config);
  const output = {};
  for (const [key, title] of Object.entries(documents)) {
    const template = fs.readFileSync(path.join(templateDirectory, key + '.html'), 'utf8');
    // Mark blockers in trusted template before inserting private contact values.
    const marked = template.replaceAll('href="/privacy"','href="privacy.html"').replaceAll('href="/terms"','href="terms.html"').replace(/\[출시 차단:[^\]]+\]/g, value => `<span class="pending">${value}</span>`);
    output[key + '.html'] = page(title, renderTemplate(marked, config));
  }
  output['index.html'] = page('정책 검토', `<h1>블라리요 정책 검토</h1>
<p>작은 무료 사이트에 맞춰 약관은 8개, 개인정보처리방침은 6개 항목으로 정리했습니다. 위 메뉴에서 본문을 읽을 수 있습니다.</p>
<h2>이미 반영한 정보</h2><ul><li>기존 보관 파일의 공개 연락처 5개</li><li>운영자 짤 발행·공개 열람, 일반 회원·분석·광고 비활성</li><li>Lightsail 서울, Cloudflare R2·Tunnel·Access, blariyo.com 메일을 Gmail로 받는 구성</li></ul>
<h2>책임 범위를 정리한 부분</h2><p>별도 약정 없는 상시 제공·영구 보관·특정 게시 일정의 보장을 두지 않고, 운영자에게 책임 있는 사유가 없는 장애와 외부 사이트의 운영 책임을 구분했습니다. 고의·중대한 과실이나 법령상 책임을 일괄 면제하지 않습니다.</p>
<h2>현재 공개 기준</h2><p>시행일은 2026년 9월 20일입니다. 사업자별 처리와 최소 보관 기준을 반영했습니다. 운영 발행 여부는 DB·공개 화면·배포 기록으로 확인하며 이 로컬 생성 명령은 서버를 변경하지 않습니다.</p>
<p>Cloudflare Email Routing에서 일반 Gmail로 전달하는 활성 규칙을 확인했습니다. 문의와 권리 요청은 고정 1년·3년 보관을 없애고 목적 달성 후 지체 없이 파기하는 기준입니다. 메일 주소나 연락처를 다시 입력할 필요는 없습니다.</p>
<p>색으로 표시한 항목은 기존 법무 초안의 공개 조건과 실제 운영 확인 사항입니다. 가상의 사업자·국가·시행일을 채우거나 면책 문구만으로 이 조건을 없애지 않았습니다.</p>
<p>이 묶음에는 정책 등록용 JSON, 시행 시각, 체크섬이 없습니다. 서버와 DB를 변경하지 않습니다. 다시 실행하면 기존 검토본을 보존하고 새 폴더를 만듭니다.</p>`);

  // mkdtemp and exclusive writes avoid replacing existing review copies or symlink targets.
  const destination = fs.mkdtempSync(path.join(directory, 'policy-review-'));
  fs.chmodSync(destination, 0o700);
  for (const [name, html] of Object.entries(output)) {
    const fd = fs.openSync(path.join(destination, name), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, html); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
  }
  return { destination, index: path.join(destination, 'index.html') };
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node prepare-blariyo-policy-review.cjs [--open]');
    console.log('저장된 public-contact.json으로 ~/.config/blariyo/policy-review-*/에 검토 HTML 5개를 새로 생성합니다.');
    console.log('--open: macOS 기본 브라우저로 생성한 로컬 검토 안내를 엽니다.');
    console.log('폴더 700·파일 600. 입력값 비출력. 기존 파일 유지. 네트워크·정책 발행·DB 변경 없음.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--open')) throw new Error('INVALID_ARGUMENT');
  const result = await generate();
  console.log('PASS 정책 검토본 — 기존 연락처 자동 반영 · 폴더 700 · 파일 600 · 기존 파일 유지');
  console.log('검토 파일: ' + result.index);
  console.log('상태: 로컬 검토본 생성. 이 명령은 정책 발행·서버 배포를 수행하지 않습니다.');
  if (args[0] === '--open') {
    try { execFileSync('/usr/bin/open', [result.index], { stdio: 'ignore' }); }
    catch { console.log('참고: 자동 열기에 실패했습니다. 위 검토 파일을 브라우저에서 여세요.'); }
  }
  return result;
}

module.exports = { escapeHtml, renderTemplate, page, generate, main };
if (require.main === module) main().catch(() => {
  console.error('FAIL 검토본 생성 — 연락처 파일 권한·형식, API build 또는 저장 경로를 확인하세요. 입력값은 출력하지 않습니다.');
  process.exitCode = 1;
});
