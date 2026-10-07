import type { CollectionContentBlock } from './collection.model.js';
import { collectionDigest } from './collection-url.js';

export const REVIEW_RENDERER_VERSION = 'sentence-v1';
export const REVIEW_EXPIRY_MS = 48 * 60 * 60 * 1000;
export const REVIEW_OBSERVATION_TTL_MS = 120_000;
const MESSAGE_TEXT_LIMIT = 1800; // Leave room for the delivery/unit marker.

export interface ReviewUnit {
  id: string;
  blockIndex: number;
  start: number;
  end: number;
  block: CollectionContentBlock;
  fragments: string[];
}
export interface ReviewManifest {
  rendererVersion: typeof REVIEW_RENDERER_VERSION;
  contentDigest: string;
  units: ReviewUnit[];
}

function fragments(text: string): string[] {
  const result: string[] = [];
  let fragment = '';
  for (const character of text) {
    if (fragment.length + character.length > MESSAGE_TEXT_LIMIT) {
      result.push(fragment);
      fragment = '';
    }
    fragment += character;
  }
  if (fragment) result.push(fragment);
  return result;
}

/** The API owns segmentation; workers persist/render this exact manifest, never re-segment. */
export function reviewManifest(blocks: CollectionContentBlock[], contentDigest: string): ReviewManifest {
  if (!/^[a-f0-9]{64}$/.test(contentDigest) || !blocks.length || blocks.length > 1000)
    throw new Error('REVIEW_CONTENT_INVALID');
  const segmenter = new Intl.Segmenter('ko', { granularity: 'sentence' });
  const units: ReviewUnit[] = [];
  function add(blockIndex: number, start: number, end: number, block: CollectionContentBlock, text: string) {
    const id = collectionDigest({ rendererVersion: REVIEW_RENDERER_VERSION, contentDigest, blockIndex, start, end, block }).toString('hex');
    units.push({ id, blockIndex, start, end, block, fragments: fragments(text) });
  }
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'IMAGE') {
      add(blockIndex, 0, 0, block, block.alt || '이미지');
    } else if (block.type === 'LINK') {
      add(blockIndex, 0, 0, block, block.label && block.label !== block.url ? `${block.label}\n${block.url}` : block.url);
    } else {
      // A line boundary is also a review boundary. Preserve original whitespace/offsets.
      for (const line of block.text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/gu)) {
        if (!line[0]) continue;
        for (const sentence of segmenter.segment(line[0])) {
          const start = line.index + sentence.index;
          add(blockIndex, start, start + sentence.segment.length,
            { type: 'TEXT', text: sentence.segment }, sentence.segment);
        }
      }
    }
  });
  if (!units.length || units.length > 5000 || units.reduce((sum,unit)=>sum+unit.fragments.length,0)>5000) throw new Error('REVIEW_CONTENT_INVALID');
  return { rendererVersion: REVIEW_RENDERER_VERSION, contentDigest, units };
}

/** Uses the canonical manifest, not caller-supplied replacement text or image positions. */
export function reviewSelection(manifest: ReviewManifest, excluded: string[]) {
  const unique = new Set(excluded);
  if (unique.size !== excluded.length || excluded.some(id => !manifest.units.some(unit => unit.id === id)))
    throw new Error('REVIEW_SELECTION_INVALID');
  const retained = manifest.units.filter(unit => !unique.has(unit.id));
  const blocks: CollectionContentBlock[] = [];
  let previousIndex: number | undefined;
  for (const unit of retained) {
    const previous = blocks.at(-1);
    if (unit.block.type === 'TEXT' && previous?.type === 'TEXT' && previousIndex === unit.blockIndex)
      previous.text += unit.block.text;
    else blocks.push({ ...unit.block });
    previousIndex = unit.blockIndex;
  }
  const meaningful = blocks.filter(block => block.type !== 'TEXT' || block.text.trim());
  return {
    blocks: meaningful,
    excludedUnitIds: manifest.units.filter(unit => unique.has(unit.id)).map(unit => unit.id),
    digest: collectionDigest({ rendererVersion: manifest.rendererVersion, contentDigest: manifest.contentDigest,
      includedUnitIds: retained.map(unit => unit.id) }).toString('hex'),
  };
}

export interface ReactionObservation {
  emoji: string;
  users: { id: string; bot: boolean }[];
  complete: boolean;
}
export interface MessageObservation {
  messageId: string;
  complete: boolean;
  reactions: ReactionObservation[];
}
export interface ReviewObservation {
  observedAt: number;
  head: MessageObservation;
  parts: MessageObservation[];
}
export interface ReviewBinding {
  readyAt: number;
  headMessageId: string;
  parts: { messageId: string; unitId: string }[];
}
export type ReviewDecision =
  | { action: 'APPROVE_PUBLISH'; approverIds: string[]; excludedUnitIds: string[]; selectionDigest: string }
  | { action: 'REJECT'; reason: 'HEAD_REJECTED' | 'EXPIRED'; reviewerIds: string[] }
  | { action: 'HOLD'; reason: 'UNAPPROVED' | 'NEEDS_ADMIN' | 'READ_INCOMPLETE' | 'STALE_OBSERVATION' };

export function decideReview(manifest: ReviewManifest, binding: ReviewBinding, observation: ReviewObservation,
  reviewerIds: ReadonlySet<string>, now: number): ReviewDecision {
  if (![now, binding.readyAt, observation.observedAt].every(Number.isFinite) ||
    binding.readyAt > observation.observedAt || observation.observedAt > now ||
    now - observation.observedAt > REVIEW_OBSERVATION_TTL_MS)
    return { action: 'HOLD', reason: 'STALE_OBSERVATION' };
  const complete = (message: MessageObservation) => message.complete && message.reactions.every(reaction => reaction.complete);
  const observed = new Map(observation.parts.map(part => [part.messageId, part]));
  const expected = new Set(binding.parts.map(part => part.messageId));
  if (!complete(observation.head) || observation.head.messageId !== binding.headMessageId ||
    expected.has(binding.headMessageId) || expected.size !== binding.parts.length ||
    observation.parts.length !== expected.size || observed.size !== expected.size ||
    binding.parts.some(part => !observed.has(part.messageId)) || !observation.parts.every(complete) ||
    manifest.units.some(unit => binding.parts.filter(part => part.unitId === unit.id).length !== unit.fragments.length) ||
    binding.parts.some(part => !manifest.units.some(unit => unit.id === part.unitId)))
    return { action: 'HOLD', reason: 'READ_INCOMPLETE' };
  const humans = (reaction: ReactionObservation) => reaction.users.filter(user => !user.bot && reviewerIds.has(user.id)).map(user => user.id);
  const emoji = (value: string) => value.replaceAll('\uFE0F', '');
  const headUsers = (symbol: string) => [...new Set(observation.head.reactions
    .filter(reaction => emoji(reaction.emoji) === symbol).flatMap(humans))].sort();
  const approves = headUsers('👍'), rejects = headUsers('❌');
  if (rejects.length && !approves.length) return { action: 'REJECT', reason: 'HEAD_REJECTED', reviewerIds: rejects };
  const excluded = new Set<string>();
  for (const part of binding.parts) {
    if (observed.get(part.messageId)?.reactions.some(reaction => emoji(reaction.emoji) !== '👍' && humans(reaction).length))
      excluded.add(part.unitId);
  }
  const selection = reviewSelection(manifest, [...excluded]);
  if (!selection.blocks.length) return { action: 'HOLD', reason: 'NEEDS_ADMIN' };
  if (approves.length && !rejects.length) return { action: 'APPROVE_PUBLISH', approverIds: approves,
    excludedUnitIds: selection.excludedUnitIds, selectionDigest: selection.digest };
  // Expiry uses observation time; crossing the boundary while processing is not a new scan.
  if (observation.observedAt >= binding.readyAt + REVIEW_EXPIRY_MS)
    return { action: 'REJECT', reason: 'EXPIRED', reviewerIds: [] };
  return { action: 'HOLD', reason: 'UNAPPROVED' };
}
