import { displayBlocks, type BodyBlock, type DisplayBlock } from './x-posts.ts';

export type SocialProvider = 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM';
export interface SocialReference {
  provider: SocialProvider;
  id: string;
  url: string;
  start: number;
  vertical: boolean;
}
export interface SocialCard {
  kind: 'SOCIAL';
  reference: SocialReference;
}
export type SocialDisplayBlock = DisplayBlock | SocialCard | { kind: 'LINK'; url: string };

function publicUrl(text: string): URL | null {
  const value = text.trim();
  if (/\s/.test(value)) return null;
  try {
    const url = new URL(value);
    const rawPath = /^https:\/\/[^/?#]+(\/[^?#]*)/.exec(value)?.[1];
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== rawPath
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

function startSeconds(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Math.min(Number(value), 604800);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  return match
    ? Math.min(
        Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0),
        604800
      )
    : 0;
}

export function socialReference(text: string): SocialReference | null {
  const url = publicUrl(text);
  if (!url) return null;
  const host = url.hostname;
  if (
    [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com',
      'youtu.be',
    ].includes(host)
  ) {
    const match = /^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    const id =
      host === 'youtu.be'
        ? /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1]
        : url.pathname === '/watch' && url.searchParams.getAll('v').length === 1
          ? url.searchParams.get('v')
          : match?.[2];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const start = startSeconds(url.searchParams.get('start') || url.searchParams.get('t'));
    return {
      provider: 'YOUTUBE',
      id,
      url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ''}`,
      start,
      vertical: match?.[1] === 'shorts',
    };
  }
  if (['www.tiktok.com', 'tiktok.com', 'm.tiktok.com'].includes(host)) {
    const match = /^\/@([A-Za-z0-9_.]{1,32})\/(video|photo)\/(\d{1,25})\/?$/.exec(url.pathname);
    if (match?.[1] && match[2] && match[3])
      return {
        provider: 'TIKTOK',
        id: match[3],
        url: `https://www.tiktok.com/@${match[1]}/${match[2]}/${match[3]}`,
        start: 0,
        vertical: true,
      };
  }
  if (['www.instagram.com', 'instagram.com'].includes(host)) {
    const match = /^\/(?:[A-Za-z0-9_.]{1,30}\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,64})\/?$/.exec(
      url.pathname
    );
    if (match?.[1] && match[2])
      return {
        provider: 'INSTAGRAM',
        id: match[2],
        url: `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/`,
        start: 0,
        vertical: match[1] !== 'p',
      };
  }
  return null;
}

export function socialDisplayBlocks(blocks: readonly BodyBlock[]): SocialDisplayBlock[] {
  return displayBlocks(blocks).map((block) => {
    if (block.kind !== 'TEXT') return block;
    const reference = socialReference(block.text);
    if (reference) return { kind: 'SOCIAL', reference };
    const url = publicUrl(block.text);
    return url &&
      ['vm.tiktok.com', 'vt.tiktok.com', 'www.tiktok.com', 'tiktok.com'].includes(url.hostname)
      ? { kind: 'LINK', url: url.href }
      : block;
  });
}

export type EmbedFailure = 'unavailable' | 'restricted' | 'failed';
export function youtubeFailure(code: number): EmbedFailure {
  return code === 100 ? 'unavailable' : code === 101 || code === 150 ? 'restricted' : 'failed';
}
export function tiktokMessage(
  event: MessageEvent,
  frameWindow: Window | null
): { state: 'embedded' } | { state: EmbedFailure } | null {
  if (!frameWindow || event.source !== frameWindow || event.origin !== 'https://www.tiktok.com')
    return null;
  const data: unknown = event.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('x-tiktok-player' in data) ||
    data['x-tiktok-player'] !== true ||
    !('type' in data)
  )
    return null;
  if (data.type === 'onPlayerReady') return { state: 'embedded' };
  if (data.type !== 'onPlayerError' || !('value' in data)) return null;
  const error = data.value;
  if (
    typeof error !== 'object' ||
    error === null ||
    !('errorCode' in error) ||
    typeof error.errorCode !== 'number'
  )
    return null;
  return { state: error.errorCode === 1001 ? 'unavailable' : 'failed' };
}
