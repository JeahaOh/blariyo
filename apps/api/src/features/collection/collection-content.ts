import type { CollectionContentBlock } from './collection.model.js';
import type { EditBlock } from '../posts/posts.model.js';
import { fail } from '../../shared/errors.js';

/** No HTML is interpreted. Links are data, never server fetch instructions. */
export function validateContent(
  blocks: CollectionContentBlock[] | undefined,
  positions: number[]
): CollectionContentBlock[] | null {
  if (blocks === undefined) {
    if (!positions.length) fail(400, 'VALIDATION_FAILED');
    return null;
  }
  if (!blocks.length || blocks.length > 1000) fail(400, 'VALIDATION_FAILED');
  const references = blocks.flatMap((b) => (b.type === 'IMAGE' ? [b.imagePosition] : []));
  if (
    references.length !== positions.length ||
    new Set(references).size !== references.length ||
    references.some((position) => !positions.includes(position))
  )
    fail(400, 'VALIDATION_FAILED');
  for (const block of blocks) {
    if (block.type === 'TEXT' && !block.text.trim()) fail(400, 'VALIDATION_FAILED');
    if (block.type === 'LINK') {
      let url: URL;
      try {
        url = new URL(block.url);
      } catch {
        fail(400, 'VALIDATION_FAILED');
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        fail(400, 'VALIDATION_FAILED');
    }
  }
  // Check expanded link labels before accepting a result that cannot become a draft.
  originalDraftBlocks(blocks, (position, alt) => ({
    type: 'IMAGE',
    imageId: position,
    alt: alt || '이미지',
  }));
  return blocks;
}

export function originalDraftBlocks(
  blocks: CollectionContentBlock[],
  image: (position: number, alt: string) => EditBlock
): EditBlock[] {
  const result: EditBlock[] = blocks.flatMap((block): EditBlock[] => {
    if (block.type === 'IMAGE') return [image(block.imagePosition, block.alt)];
    if (block.type === 'TEXT') return [{ type: 'TEXT', text: block.text }];
    const label = block.label.trim();
    return [
      ...(label && label !== block.url ? [{ type: 'TEXT' as const, text: label }] : []),
      { type: 'TEXT', text: block.url },
    ];
  });
  if (result.length > 1000) fail(400, 'VALIDATION_FAILED');
  return result;
}
