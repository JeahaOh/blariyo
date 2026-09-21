export interface PostImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}
export type BodyBlock = { type: 'TEXT'; text: string } | { type: 'IMAGE'; image: PostImage };
export interface XReference {
  id: string;
  handle: string;
  url: string;
}
export interface XCard {
  kind: 'X';
  reference: XReference;
  author: string;
  text: string;
  images: PostImage[];
}
export type DisplayBlock =
  { kind: 'TEXT'; text: string } | { kind: 'IMAGE'; image: PostImage } | XCard;

export function xReference(text: string): XReference | null {
  const value = text.trim();
  if (/\s/.test(value)) return null;
  try {
    const url = new URL(value);
    const rawPath = /^https:\/\/[^/?#]+(\/[^?#]*)/.exec(value)?.[1];
    if (url.pathname !== rawPath) return null;
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)
    )
      return null;
    const match = /^\/([a-zA-Z0-9_]{1,15})\/status\/(\d{1,25})(?:\/(?:photo|video)\/\d+)?\/?$/.exec(
      url.pathname
    );
    if (!match?.[1] || !match[2]) return null;
    return { handle: match[1], id: match[2], url: `https://x.com/${match[1]}/status/${match[2]}` };
  } catch {
    return null;
  }
}

export function displayBlocks(blocks: readonly BodyBlock[]): DisplayBlock[] {
  const output: DisplayBlock[] = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (!block) continue;
    if (block.type === 'IMAGE') {
      output.push({ kind: 'IMAGE', image: block.image });
      continue;
    }
    const next = blocks[index + 1];
    const linked = next?.type === 'TEXT' ? xReference(next.text) : null;
    const author = /^([^\n]+) \(@([a-zA-Z0-9_]{1,15})\)\r?\n([\s\S]+)$/.exec(block.text);
    if (
      linked &&
      author?.[1] &&
      author[2]?.toLowerCase() === linked.handle.toLowerCase() &&
      author[3]
    ) {
      const card: XCard = {
        kind: 'X',
        reference: linked,
        author: author[1],
        text: author[3],
        images: [],
      };
      index++;
      while (blocks[index + 1]?.type === 'IMAGE') {
        const image = blocks[++index];
        if (image?.type === 'IMAGE') card.images.push(image.image);
      }
      output.push(card);
    } else {
      const reference = xReference(block.text);
      output.push(
        reference
          ? { kind: 'X', reference, author: '', text: '', images: [] }
          : { kind: 'TEXT', text: block.text }
      );
    }
  }
  return output;
}
