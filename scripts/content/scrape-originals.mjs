import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { parseDocument } from 'htmlparser2';
import { findAll, textContent } from 'domutils';
import render from 'dom-serializer';
import sharp from 'sharp';
import { parseTheqoo } from './theqoo-parser.mjs';
import { fetchPublic } from './public-fetch.mjs';
import { jsonArgument, noteTweetText } from './embedded-json.mjs';

export const directory = new URL(
  '../../.local-data/content-review/originals-20260920/',
  import.meta.url
);
const manifest = new URL('snapshot.json', directory);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bundle = JSON.parse(
  await readFile(new URL('./community-hot-20260920.json', import.meta.url), 'utf8')
);
assert.equal(bundle.items.length, 25);
const wanted = new Set(bundle.items.map((item) => item.sourceUrl));
assert.equal(wanted.size, 25);
await mkdir(new URL('assets/', directory), { recursive: true });
let state;
try {
  state = JSON.parse(await readFile(manifest, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
state ??= {
  batch: 'theqoo-20260920-originals',
  rights: { basis: 'USER_CONFIRMED_PERMISSION', confirmedOn: '2026-09-20', scope: [...wanted] },
  posts: [],
  assets: {},
};
assert.deepEqual(new Set(state.rights.scope), wanted);
const save = () => writeFile(manifest, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
const json = async (url) => {
  const response = await fetchPublic(url, 5 * 1024 * 1024);
  if (!response.mime.includes('json')) throw new Error('JSON_EXPECTED');
  return JSON.parse(response.body.toString());
};
function plain(node) {
  if (!node) return '';
  if (node.type === 'text') return node.data;
  if (node.name === 'br') return '\n';
  if (['script', 'style'].includes(node.name)) return '';
  if ((node.attribs?.class || '').split(/\s+/).includes('CaptionComments')) return '';
  return (node.children || []).map(plain).join('');
}
async function imageAsset(url, origin) {
  if (state.assets[url]) return state.assets[url];
  const response = await fetchPublic(url);
  if (!response.mime.startsWith('image/')) throw new Error(`IMAGE_EXPECTED:${response.mime}`);
  // Header inspection only; full decode is separately bounded and verified before DB import.
  const meta = await sharp(response.body, { animated: true, limitInputPixels: false }).metadata();
  if (meta.width * (meta.pageHeight || meta.height) > 40000000 || (meta.pages || 1) > 1500)
    throw new Error('IMAGE_DIMENSION_LIMIT');
  if (!['jpeg', 'png', 'webp', 'gif'].includes(meta.format))
    throw new Error('UNSUPPORTED_IMAGE_FORMAT');
  const hash = sha(response.body);
  const filename = `assets/${hash}.${meta.format === 'jpeg' ? 'jpg' : meta.format}`;
  await writeFile(new URL(filename, directory), response.body, { mode: 0o600 });
  const asset = {
    remoteUrl: url,
    resolvedUrl: response.url,
    origin,
    filename,
    sha256: hash,
    mime: `image/${meta.format}`,
    bytes: response.body.length,
    width: meta.width,
    height: meta.pageHeight || meta.height,
    frames: meta.pages || 1,
  };
  state.assets[url] = asset;
  return asset;
}
async function resolvedImagePage(url) {
  const response = await fetchPublic(url, 1024 * 1024);
  if (response.mime.startsWith('image/')) return url;
  const doc = parseDocument(response.body.toString());
  const og = findAll(
    (node) => node.name === 'meta' && node.attribs?.property === 'og:image',
    doc.children
  )[0];
  if (!og?.attribs.content) throw new Error('IMAGE_PAGE_WITHOUT_IMAGE');
  return new URL(og.attribs.content, url).href;
}
async function sourceImage(block, origin) {
  try {
    return await imageAsset(block.url, origin);
  } catch (error) {
    // Expired article URLs can have a current server-issued signature on the
    // official public image page. Never remove or manufacture the signature.
    if (
      new URL(block.url).hostname !== 'imagedelivery.net' ||
      !/^[A-Za-z]{6}$/.test(block.alt || '') ||
      !/HTTP Error 403/.test(String(error.stderr || error.message))
    )
      throw error;
    const sourcePage = `https://img.theqoo.net/${block.alt}`;
    const fresh = await resolvedImagePage(sourcePage);
    assert.equal(
      new URL(fresh).origin + new URL(fresh).pathname,
      new URL(block.url).origin + new URL(block.url).pathname,
      'Public image page points to a different image'
    );
    return { ...(await imageAsset(fresh, origin)), sourcePage, refreshedFrom: block.url };
  }
}
async function xPost(reference) {
  const id = reference.url.split('/').at(-1);
  // Public syndication request parameter, also used by vercel/react-tweet's fetchTweet.
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  const data = await json(
    'https://cdn.syndication.twimg.com/tweet-result?' +
      new URLSearchParams({ id, lang: 'ko', token })
  );
  if (data.id_str !== id || typeof data.text !== 'string') throw new Error('X_CONTENT_UNAVAILABLE');
  const blocks = [];
  const records = [];
  async function add(tweet, relation) {
    if (!tweet?.text) return;
    const url = `https://x.com/${tweet.user?.screen_name || 'i'}/status/${tweet.id_str}`;
    let nativeText = tweet.text;
    let note;
    if (tweet.note_tweet) {
      try {
        const response = await fetchPublic(url, 4 * 1024 * 1024);
        const extracted = noteTweetText(response.body.toString(), tweet.note_tweet.id);
        assert.ok(extracted.text.length >= nativeText.length, 'Note text shorter than syndication');
        nativeText = extracted.text;
        note = {
          ...extracted,
          source: url,
          responseSha256: sha(response.body),
          capturedAt: new Date().toISOString(),
        };
      } catch (error) {
        note = { error: String(error.message).slice(0, 200) };
      }
    }
    const text = nativeText.replace(/https:\/\/t\.co\/\w+/g, (short) => {
      const entity = Object.values(tweet.entities || {})
        .flat()
        .find((value) => value.url === short);
      return entity?.expanded_url || short;
    });
    records.push({
      id: tweet.id_str,
      relation,
      author: tweet.user?.name,
      handle: tweet.user?.screen_name,
      text,
      createdAt: tweet.created_at,
      media: tweet.mediaDetails || tweet.photos || [],
      url,
      ...(note ? { note } : {}),
    });
    blocks.push({
      kind: 'text',
      text: `${tweet.user?.name || 'X'}${tweet.user?.screen_name ? ` (@${tweet.user.screen_name})` : ''}\n${text}`,
    });
    blocks.push({ kind: 'social', provider: 'X', url });
    const media =
      tweet.mediaDetails ||
      (tweet.photos || []).map((photo) => ({ type: 'photo', media_url_https: photo.url }));
    for (const item of media) {
      const remote = item.media_url_https || item.url;
      if (remote) {
        const asset = await imageAsset(remote, url);
        blocks.push({
          kind: 'image',
          url: remote,
          asset,
          alt: item.ext_alt_text || '',
          role: item.type === 'photo' ? 'attachment' : 'video-poster',
        });
      }
      if (item.video_info?.variants) records.at(-1).videoVariants = item.video_info.variants;
    }
    if (tweet.note_tweet && !note?.text) records.at(-1).truncated = true;
  }
  await add(data, 'linked');
  await add(data.quoted_tweet, 'quoted');
  await add(data.parent, 'parent');
  return {
    provider: 'X',
    url: reference.url,
    status: records.some((record) => record.truncated) ? 'PARTIAL' : 'FETCHED',
    records,
    blocks,
  };
}
function jsonObjects(node, output = []) {
  if (!node || typeof node !== 'object') return output;
  if (!Array.isArray(node)) output.push(node);
  for (const [key, child] of Object.entries(node)) {
    if (typeof child === 'object') jsonObjects(child, output);
    else if (key === 'contextJSON' && typeof child === 'string') {
      try {
        jsonObjects(JSON.parse(child), output);
      } catch {
        try {
          jsonObjects(JSON.parse(JSON.parse(`"${child}"`)), output);
        } catch {}
      }
    }
  }
  return output;
}
async function instagramPost(reference) {
  const response = await fetchPublic(reference.url + 'embed/captioned/', 4 * 1024 * 1024);
  const doc = parseDocument(response.body.toString());
  const hasClass = (node, name) => (node.attribs?.class || '').split(/\s+/).includes(name);
  const captions = findAll((node) => hasClass(node, 'Caption'), doc.children);
  let caption = plain(captions[0]).trim();
  const mainImages = findAll(
    (node) => node.name === 'img' && hasClass(node, 'EmbeddedMediaImage'),
    doc.children
  ).map((node) => node.attribs.src);
  const shortcode = reference.url.split('/').filter(Boolean).at(-1);
  const objects = findAll((node) => node.name === 'script', doc.children).flatMap((node) => {
    try {
      return jsonObjects(
        node.attribs?.type === 'application/json'
          ? JSON.parse(textContent(node))
          : jsonArgument(textContent(node), 's.handle(')
      );
    } catch {
      return [];
    }
  });
  const media = objects.find(
    (node) =>
      (node.shortcode === shortcode || node.code === shortcode) &&
      (node.edge_sidecar_to_children || node.display_url || node.image_versions2)
  );
  caption = media?.edge_media_to_caption?.edges?.[0]?.node?.text || caption;
  const children =
    media?.carousel_media || media?.edge_sidecar_to_children?.edges?.map((edge) => edge.node);
  const urls =
    children
      ?.map((child) => child.display_url || child.image_versions2?.candidates?.[0]?.url)
      .filter(Boolean) || mainImages;
  if (!caption || !urls.length) throw new Error('INSTAGRAM_CONTENT_UNAVAILABLE');
  const blocks = [
    { kind: 'text', text: caption },
    { kind: 'social', provider: 'INSTAGRAM', url: reference.url },
  ];
  for (const url of [...new Set(urls)])
    blocks.push({ kind: 'image', url, asset: await imageAsset(url, reference.url), alt: '' });
  return {
    provider: 'INSTAGRAM',
    url: reference.url,
    status: media ? 'FETCHED' : 'PARTIAL',
    caption,
    embeddedMediaCount: urls.length,
    carouselComplete: Boolean(children),
    blocks,
  };
}
async function youtubePost(reference) {
  const data = await json(
    'https://www.youtube.com/oembed?' + new URLSearchParams({ url: reference.url, format: 'json' })
  );
  if (!data.title || !data.html) throw new Error('YOUTUBE_CONTENT_UNAVAILABLE');
  const blocks = [
    { kind: 'text', text: `${data.title}\n${data.author_name}` },
    { kind: 'social', provider: 'YOUTUBE', url: reference.url },
  ];
  if (data.thumbnail_url)
    blocks.push({
      kind: 'image',
      url: data.thumbnail_url,
      asset: await imageAsset(data.thumbnail_url, reference.url),
      alt: data.title,
      role: 'video-thumbnail',
    });
  return {
    provider: 'YOUTUBE',
    url: reference.url,
    status: 'FETCHED',
    title: data.title,
    author: data.author_name,
    embedHtml: data.html,
    playback: 'OFFICIAL_EMBED',
    blocks,
  };
}

const refreshInstagram = process.argv.includes('--refresh-instagram');
const refreshXNotes = process.argv.includes('--refresh-x-notes');
const refreshExpiredImages = process.argv.includes('--refresh-expired-images');
for (const [index, item] of bundle.items.entries()) {
  const previous = state.posts.find((post) => post.sourceUrl === item.sourceUrl);
  const terminalPartial =
    previous?.status === 'PARTIAL' &&
    previous.issues.every(
      (issue) => issue.error === 'X_LONG_TEXT_TRUNCATED' || /HTTP Error 403/.test(issue.error)
    );
  const instagramRefresh =
    refreshInstagram && previous?.social.some((social) => social.provider === 'INSTAGRAM');
  const xNoteRefresh =
    refreshXNotes && previous?.issues.some((issue) => issue.error === 'X_LONG_TEXT_TRUNCATED');
  const expiredImageRefresh =
    refreshExpiredImages &&
    previous?.issues.some((issue) => issue.kind === 'image' && /HTTP Error 403/.test(issue.error));
  if (
    previous &&
    (previous.status === 'FETCHED' || terminalPartial) &&
    !instagramRefresh &&
    !xNoteRefresh &&
    !expiredImageRefresh
  )
    continue;
  const capture = {
    sourceUrl: item.sourceUrl,
    capturedAt: new Date().toISOString(),
    status: 'FAILED',
    issues: [],
    social: [],
    blocks: [],
  };
  try {
    const response = await fetchPublic(item.sourceUrl, 2 * 1024 * 1024);
    assert.ok(response.mime.includes('html'));
    const html = response.body.toString();
    const parsed = parseTheqoo(html, item.sourceUrl);
    const doc = parseDocument(html);
    const article = findAll(
      (node) => node.name === 'article' && node.attribs?.itemprop === 'articleBody',
      doc.children
    )[0];
    Object.assign(capture, {
      title: parsed.title,
      parserVersion: parsed.parserVersion,
      articleHtml: render(article),
      sourceBlocks: parsed.blocks,
      responseSha256: sha(response.body),
      issues: parsed.issues,
    });
    for (const block of parsed.blocks) {
      try {
        if (block.kind === 'image')
          capture.blocks.push({ ...block, asset: await sourceImage(block, item.sourceUrl) });
        else if (block.kind === 'link' && new URL(block.url).hostname === 'img.theqoo.net') {
          const url = await resolvedImagePage(block.url);
          capture.blocks.push({
            kind: 'image',
            url,
            sourcePage: block.url,
            asset: await imageAsset(url, item.sourceUrl),
            alt: '',
          });
        } else if (block.kind === 'social') {
          const social = await (block.provider === 'X'
            ? xPost(block)
            : block.provider === 'YOUTUBE'
              ? youtubePost(block)
              : block.provider === 'INSTAGRAM'
                ? instagramPost(block)
                : Promise.reject(new Error('UNSUPPORTED_SOCIAL_PROVIDER')));
          capture.social.push(social);
          capture.blocks.push(...social.blocks);
          if (social.status !== 'FETCHED')
            capture.issues.push({
              kind: 'social',
              url: block.url,
              error:
                block.provider === 'X' ? 'X_LONG_TEXT_TRUNCATED' : 'INSTAGRAM_CAROUSEL_INCOMPLETE',
            });
        } else capture.blocks.push(block);
      } catch (error) {
        const code = String(error.stderr?.toString() || error.message).slice(0, 350);
        capture.issues.push({ kind: block.kind, url: block.url, error: code });
        capture.blocks.push({ ...block, fetchStatus: 'FAILED' });
        if (block.kind === 'social')
          capture.social.push({
            provider: block.provider,
            url: block.url,
            status: 'FAILED',
            error: code,
          });
      }
    }
    capture.status = capture.issues.length ? 'PARTIAL' : 'FETCHED';
  } catch (error) {
    capture.issues.push({ error: String(error.stderr?.toString() || error.message).slice(0, 350) });
  }
  state.posts = state.posts.filter((post) => post.sourceUrl !== item.sourceUrl);
  state.posts.push(capture);
  await save();
  console.log(
    JSON.stringify({
      item: index + 1,
      status: capture.status,
      blocks: capture.blocks.length,
      images: capture.blocks.filter((b) => b.asset).length,
      social: capture.social.map((s) => `${s.provider}:${s.status}`),
      issues: capture.issues,
    })
  );
  if (index + 1 < bundle.items.length) await delay(1200);
}
console.log(
  JSON.stringify({
    snapshot: manifest.pathname,
    posts: state.posts.length,
    complete: state.posts.filter((post) => post.status === 'FETCHED').length,
    assets: Object.keys(state.assets).length,
  })
);
if (state.posts.length !== 25 || state.posts.some((post) => post.status !== 'FETCHED'))
  process.exitCode = 1;
