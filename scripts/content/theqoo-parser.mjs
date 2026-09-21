import { parseDocument } from 'htmlparser2';
import { findAll, textContent } from 'domutils';

export const parserVersion = 'theqoo-ordered-content-v1';
const boundaries = new Set([
  'p',
  'div',
  'section',
  'article',
  'li',
  'blockquote',
  'pre',
  'h1',
  'h2',
  'h3',
  'tr',
]);
const excluded = new Set(['script', 'style', 'noscript', 'template']);

export function publicUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!value || /^(?:data|javascript|blob):/i.test(value)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function socialReference(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (['x.com', 'twitter.com', 'mobile.twitter.com'].includes(host)) {
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web|i)\/status\/(\d+)/);
    if (match)
      return { provider: 'X', url: `https://x.com/i/status/${match[1]}`, originalUrl: value };
  }
  if (
    host === 'youtu.be' ||
    ['youtube.com', 'youtube-nocookie.com', 'm.youtube.com'].includes(host)
  ) {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1).split('/')[0]
        : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(id || ''))
      return {
        provider: 'YOUTUBE',
        url: `https://www.youtube.com/watch?v=${id}`,
        originalUrl: value,
      };
  }
  if (host === 'instagram.com' && /^\/(p|reel|tv)\/[^/]+/.test(url.pathname))
    return {
      provider: 'INSTAGRAM',
      url: `https://www.instagram.com${url.pathname.replace(/\/$/, '')}/`,
      originalUrl: value,
    };
  if (['bsky.app', 'tiktok.com', 'threads.net', 'threads.com'].includes(host))
    return { provider: host, url: value, originalUrl: value };
  return null;
}

// Parses only the article body. It neither summarizes nor fetches linked pages.
export function parseTheqoo(html, sourceUrl) {
  const document = parseDocument(html, { decodeEntities: true });
  const all = (predicate) => findAll(predicate, document.children);
  const articles = all(
    (node) => node.name === 'article' && node.attribs?.itemprop === 'articleBody'
  );
  if (articles.length !== 1) throw new Error('ARTICLE_BODY_NOT_UNIQUE');
  const ogTitle = all((node) => node.name === 'meta' && node.attribs?.property === 'og:title')[0]
    ?.attribs.content;
  const titleNode = all((node) => node.name === 'title')[0];
  const title = ogTitle || (titleNode ? textContent(titleNode).replace(/^더쿠\s*-\s*/, '') : '');
  if (!title?.trim()) throw new Error('TITLE_MISSING');
  const blocks = [];
  const issues = [];
  let pending = '';
  const addReference = (url, label) => {
    const social = socialReference(url);
    blocks.push(social ? { kind: 'social', ...social } : { kind: 'link', url, label });
  };
  const flush = () => {
    const text = pending
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    pending = '';
    if (!text) return;
    // Bare SNS URLs occur as plain paragraph text on theqoo; do not lose them.
    const pattern = /https?:\/\/[^\s<>"\u200b]+/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0].replace(/[),.!?]+$/, '');
      const url = publicUrl(value, sourceUrl);
      if (!url) continue;
      const before = text.slice(cursor, match.index).trim();
      if (before) blocks.push({ kind: 'text', text: before });
      addReference(url, value);
      cursor = match.index + value.length;
    }
    const rest = text.slice(cursor).trim();
    if (rest) blocks.push({ kind: 'text', text: rest });
  };
  const walk = (node) => {
    if (node.type === 'text') {
      pending += node.data;
      return;
    }
    if (!node.name || excluded.has(node.name)) return;
    const attrs = node.attribs || {};
    if (node.name === 'br') {
      pending += '\n';
      return;
    }
    if (node.name === 'img') {
      flush();
      const candidates = [
        attrs['data-original'],
        attrs['data-src'],
        attrs['data-lazy-src'],
        attrs.src,
      ];
      const url = candidates.map((value) => publicUrl(value, sourceUrl)).find(Boolean);
      if (!url) issues.push({ code: 'IMAGE_URL_MISSING', position: blocks.length });
      else blocks.push({ kind: 'image', url, alt: attrs.alt || '' });
      return;
    }
    if (node.name === 'iframe') {
      flush();
      const url = publicUrl(attrs.src || attrs['data-src'], sourceUrl);
      if (!url) issues.push({ code: 'IFRAME_URL_MISSING', position: blocks.length });
      else {
        const social = socialReference(url);
        blocks.push(social ? { kind: 'social', ...social } : { kind: 'embed', url });
      }
      return;
    }
    if (node.name === 'video' || node.name === 'audio') {
      flush();
      const sources = [
        attrs.src,
        ...findAll((child) => child.name === 'source', node.children || []).map(
          (child) => child.attribs.src
        ),
      ]
        .map((value) => publicUrl(value, sourceUrl))
        .filter(Boolean);
      if (!sources.length) issues.push({ code: 'MEDIA_URL_MISSING', position: blocks.length });
      else
        blocks.push({
          kind: node.name,
          urls: [...new Set(sources)],
          poster: publicUrl(attrs.poster, sourceUrl),
        });
      return;
    }
    if (node.name === 'a' && attrs.href) {
      const url = publicUrl(attrs.href, sourceUrl);
      if (url) {
        flush();
        const images = findAll((child) => child.name === 'img', node.children || []);
        if (images.length) images.forEach(walk);
        else addReference(url, textContent(node).trim());
        return;
      }
    }
    if (boundaries.has(node.name) && pending && !pending.endsWith('\n')) pending += '\n';
    (node.children || []).forEach(walk);
    if (boundaries.has(node.name)) pending += '\n';
  };
  walk(articles[0]);
  flush();
  if (!blocks.length) throw new Error('ARTICLE_BODY_EMPTY');
  return { parserVersion, sourceUrl, title: title.trim(), blocks, issues };
}

// A reference-only audit never persists the article text or image bytes.
export function referenceInventory(parsed) {
  return {
    parserVersion: parsed.parserVersion,
    sourceUrl: parsed.sourceUrl,
    blockKinds: parsed.blocks.map((block) => block.kind),
    textCharacters: parsed.blocks
      .filter((block) => block.kind === 'text')
      .reduce((sum, block) => sum + block.text.length, 0),
    references: parsed.blocks.flatMap((block, index) =>
      block.kind === 'text' ? [] : [{ position: index + 1, ...block }]
    ),
    issues: parsed.issues,
  };
}
