import { createHash } from 'node:crypto';
import { fail } from '../../shared/errors.js';

export const directHosts: Readonly<Record<string, string>> = {
  ARCALIVE: 'arca.live', BOBAEDREAM: 'www.bobaedream.co.kr', CLIEN: 'www.clien.net',
  DCINSIDE: 'gall.dcinside.com', DMITORY: 'www.dmitory.com', DOGDRIP: 'www.dogdrip.net',
  ETOLAND: 'etoland.co.kr', FMKOREA: 'www.fmkorea.com', GOODGAG: 'www.goodgag.net',
  HUMORUNIV: 'web.humoruniv.com', INSTIZ: 'www.instiz.net', INVEN: 'www.inven.co.kr',
  MLBPARK: 'mlbpark.donga.com', NATEPANN: 'pann.nate.com', PGR21: 'pgr21.com',
  PPOMPPU: 'www.ppomppu.co.kr', RULIWEB: 'bbs.ruliweb.com', THEQOO: 'theqoo.net',
  TODAYHUMOR: 'www.todayhumor.co.kr', YULDO: 'yul-do.com', YOUTUBE_COMMUNITY: 'www.youtube.com',
};
export const directNormalizationVersion = 1;
export interface DirectIdentity { canonicalUrl: string; postKey: string; normalizationVersion: number }

/** Exact counterpart of the existing Java adapters. No DNS, HTTP or other I/O is performed. */
export function directIdentity(raw: string, parser: string): DirectIdentity {
  const invalid = (): never => fail(400, 'VALIDATION_FAILED');
  const host = directHosts[parser];
  if (!host) fail(422, 'SOURCE_UNSUPPORTED');
  const match = /^https:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?$/.exec(raw);
  if (!match || raw.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(raw)) invalid();
  const authority = match?.[1]?.toLowerCase() ?? '';
  const accepted = parser === 'HUMORUNIV' ? ['web.humoruniv.com', 'm.humoruniv.com', 'humoruniv.com'] : [host];
  if (!accepted.includes(authority)) invalid();
  let path = '', query: Map<string, string>;
  try {
    path = decodeURIComponent(match?.[2] ?? '');
    query = new Map<string, string>();
    for (const pair of (match?.[3] ?? '').split('&').filter((part, index, all) => part !== '' || index < all.length - 1)) {
      const at = pair.indexOf('='), key = decodeURIComponent((at < 0 ? pair : pair.slice(0, at)).replaceAll('+', ' '));
      const value = at < 0 ? '' : decodeURIComponent(pair.slice(at + 1).replaceAll('+', ' '));
      if (query.has(key)) invalid(); query.set(key, value);
    }
  } catch { return invalid(); }
  if (path.includes('..') || /[\s\\\u0000-\u001f\u007f]/.test(path)) invalid();
  let canonicalPath: string | undefined, postKey: string | undefined, canonicalHost = host;
  const capture = (pattern: RegExp) => pattern.exec(path);
  const word = (value: string) => /^[A-Za-z0-9_]+$/.test(value);
  const digits = (value: string) => /^[0-9]+$/.test(value);
  const q = (key: string, fallback = '') => query.get(key) ?? fallback;
  if (parser === 'ARCALIVE') {
    const m = capture(/^\/b\/([A-Za-z0-9_]+)\/([0-9]+)$/); if (m) { canonicalPath = path; postKey = m[2]; }
  } else if (['CLIEN', 'INSTIZ', 'PGR21'].includes(parser)) {
    const m = capture(parser === 'CLIEN' ? /^\/service\/board\/([A-Za-z0-9_]+)\/([0-9]+)$/ : /^\/([A-Za-z0-9_]+)\/([0-9]+)$/);
    if (m) { canonicalPath = path; postKey = `${m[1]}:${m[2]}`; }
  } else if (parser === 'DOGDRIP' || parser === 'FMKOREA') {
    const m = capture(parser === 'DOGDRIP' ? /^\/(?:dogdrip\/)?([0-9]+)$/ : /^\/(?:best\/)?([0-9]+)$/);
    if (m) { canonicalPath = '/' + m[1]; postKey = m[1]; }
  } else if (parser === 'THEQOO' || parser === 'NATEPANN' || parser === 'YOUTUBE_COMMUNITY') {
    const m = capture(parser === 'THEQOO' ? /^\/(?:hot|square|talk)\/([0-9]+)$/ : parser === 'NATEPANN' ? /^\/talk\/([0-9]+)$/ : /^\/post\/([A-Za-z0-9_-]+)$/);
    if (m) { canonicalPath = path; postKey = m[1]; }
  } else if (parser === 'INVEN') {
    const m = capture(/^\/board\/([A-Za-z0-9_]+)\/([0-9]+)\/([0-9]+)$/);
    if (m) { canonicalPath = path; postKey = `${m[1]}:${m[2]}:${m[3]}`; }
  } else if (parser === 'RULIWEB') {
    const m = capture(/^\/(?:best\/board|community\/board|family\/board|news\/board|hobby\/board)\/([A-Za-z0-9_]+)\/read\/([0-9]+)$/);
    if (m) { canonicalPath = path; postKey = `${m[1]}:${m[2]}`; }
  } else if (parser === 'YULDO') {
    const m = capture(/^\/([A-Za-z0-9_/-]+)\/([0-9]+)$/);
    if (m) { canonicalPath = path; postKey = `${m[1]?.replaceAll('/', ':')}:${m[2]}`; }
  } else if (parser === 'DMITORY') {
    const m = capture(/^\/([A-Za-z0-9_]+)\/([0-9]+)$/), root = capture(/^\/([0-9]+)$/);
    if (m) { canonicalPath = path; postKey = `${m[1]}:${m[2]}`; }
    else if (root) { canonicalPath = '/issue/' + root[1]; postKey = 'issue:' + root[1]; }
    else if (path === '/index.php' && word(q('mid')) && digits(q('document_srl'))) {
      canonicalPath = '/' + q('mid') + '/' + q('document_srl'); postKey = q('mid') + ':' + q('document_srl');
    }
  } else if (parser === 'HUMORUNIV') {
    const short = capture(/^\/([A-Za-z0-9_]+)([0-9]+)$/), table = q('table'), number = q('number', q('pg'));
    if (short) { canonicalHost = 'm.humoruniv.com'; canonicalPath = `/board/read.html?table=${short[1]}&number=${short[2]}`; postKey = `${short[1]}:${short[2]}`; }
    else if (/^\/board\/(?:[A-Za-z0-9_/-]+\/)?read\.html$/.test(path) && word(table) && digits(number)) {
      canonicalHost = match?.[1] ?? host; canonicalPath = path + '?table=' + table + '&number=' + number; postKey = table + ':' + number;
    }
  } else if (parser === 'ETOLAND') {
    const pretty = capture(/^\/b\/([A-Za-z0-9_]+)\/view\/.+-([0-9]+)$/);
    if (path === '/bbs/board.php' && word(q('bo_table')) && digits(q('wr_id'))) {
      canonicalPath = path + '?bo_table=' + q('bo_table') + '&wr_id=' + q('wr_id'); postKey = q('bo_table') + ':' + q('wr_id');
    } else if (pretty) { canonicalPath = path; postKey = `${pretty[1]}:${pretty[2]}`; }
  } else if (parser === 'GOODGAG') {
    const document = q('document_srl', q('wr_id')), board = q('mid', q('bo_table', 'post'));
    const m = capture(/^\/(?:[A-Za-z0-9_/-]+\/)?([0-9]+)$/);
    if (['/bbs/board.php', '/'].includes(path) && word(board) && digits(document)) {
      canonicalPath = path + '?' + (query.has('bo_table') ? `bo_table=${board}&wr_id=${document}` : `mid=${board}&document_srl=${document}`);
      postKey = board + ':' + document;
    } else if (m) { canonicalPath = path; postKey = m[1]; }
  } else {
    const rules: Record<string, { paths: string[]; board: string; id: string; prefix?: string; view?: boolean }> = {
      BOBAEDREAM: { paths: ['/view', '/board/bulletin/view.php'], board: 'code', id: 'No', prefix: '/view' },
      DCINSIDE: { paths: ['/board/view/', '/mgallery/board/view/', '/mini/board/view/'], board: 'id', id: 'no' },
      PPOMPPU: { paths: ['/zboard/view.php'], board: 'id', id: 'no' },
      TODAYHUMOR: { paths: ['/board/view.php'], board: 'table', id: 'no' },
      MLBPARK: { paths: ['/mp/b.php'], board: 'b', id: 'id', view: true },
    };
    const rule = rules[parser];
    if (rule && rule.paths.includes(path) && word(q(rule.board)) && (rule.view ? /^[A-Za-z0-9_-]+$/.test(q(rule.id)) && q('m') === 'view' : digits(q(rule.id)))) {
      canonicalPath = (rule.prefix ?? path) + '?' + (rule.view ? 'm=view&' : '') + rule.board + '=' + q(rule.board) + '&' + rule.id + '=' + q(rule.id);
      postKey = q(rule.board) + ':' + q(rule.id);
    }
  }
  if (!canonicalPath || !postKey) return invalid();
  return { canonicalUrl: 'https://' + canonicalHost + canonicalPath, postKey, normalizationVersion: directNormalizationVersion };
}

export function directIdentityHash(...parts: string[]): Buffer {
  const hash = createHash('sha256');
  for (const part of parts) {
    const value = Buffer.from(part, 'utf8'), length = Buffer.alloc(4);
    length.writeInt32BE(value.length); hash.update(length); hash.update(value);
  }
  return hash.digest();
}
