import test from 'node:test';
import assert from 'node:assert/strict';
import { decideReview, reviewManifest, reviewSelection, REVIEW_EXPIRY_MS,
  type ReactionObservation, type ReviewObservation, type ReviewBinding } from '../dist/features/collection/discord-review-policy.js';

const manifest = reviewManifest([
  { type: 'TEXT', text: '첫 문장입니다. 두 번째 문장입니다.\n다음 줄입니다.' },
  { type: 'IMAGE', imagePosition: 1, alt: '이미지' },
  { type: 'LINK', label: '원문', url: 'https://example.org/source' },
], 'a'.repeat(64));
const reviewers = new Set(['reviewer']);
const readyAt = Date.UTC(2026, 9, 7, 0);
const binding: ReviewBinding = { readyAt, headMessageId: 'head', parts: manifest.units.flatMap(unit => unit.fragments.map((_, index) => ({
  messageId: `${unit.id}-${index}`, unitId: unit.id,
}))) };
const reaction = (emoji: string, id = 'reviewer', bot = false): ReactionObservation => ({ emoji, users: [{ id, bot }], complete: true });
function observation(head: ReactionObservation[], observedAt = readyAt + 1000): ReviewObservation {
  return { observedAt, head: { messageId: 'head', complete: true, reactions: head },
    parts: binding.parts.map(part => ({ messageId: part.messageId, complete: true, reactions: [] })) };
}

await test('manifest preserves original text/order and binds stable units to snapshot and offsets', () => {
  assert.equal(manifest.units.length, 5);
  assert.deepEqual(reviewSelection(manifest, []).blocks, [
    { type: 'TEXT', text: '첫 문장입니다. 두 번째 문장입니다.\n다음 줄입니다.' },
    { type: 'IMAGE', imagePosition: 1, alt: '이미지' },
    { type: 'LINK', label: '원문', url: 'https://example.org/source' },
  ]);
  const unit = manifest.units[1]; assert.ok(unit);
  assert.equal(unit.start, '첫 문장입니다. '.length);
  assert.deepEqual(reviewSelection(manifest, [unit.id]).blocks[0], { type: 'TEXT', text: '첫 문장입니다. 다음 줄입니다.' });
  assert.throws(() => reviewSelection(manifest, ['unknown']), /SELECTION_INVALID/);
  assert.throws(() => reviewSelection(manifest, [unit.id, unit.id]), /SELECTION_INVALID/);
  assert.notEqual(reviewManifest([unit.block], 'b'.repeat(64)).units[0]?.id, unit.id);
});

await test('only registered humans count; head thumbs-only approves and x-only rejects', () => {
  const cases: [ReactionObservation[], string, string | undefined][] = [
    [[], 'HOLD', 'UNAPPROVED'],
    [[reaction('👍', 'bot', true), reaction('❌', 'bot', true)], 'HOLD', 'UNAPPROVED'],
    [[reaction('👍', 'stranger')], 'HOLD', 'UNAPPROVED'],
    [[reaction('👍', 'reviewer', true)], 'HOLD', 'UNAPPROVED'],
    [[reaction('👍')], 'APPROVE_PUBLISH', undefined],
    [[reaction('❌')], 'REJECT', 'HEAD_REJECTED'],
    [[reaction('👍'), reaction('❌')], 'HOLD', 'UNAPPROVED'],
    [[reaction('👎')], 'HOLD', 'UNAPPROVED'],
  ];
  for (const [reactions, action, reason] of cases) {
    const input = observation(reactions), result = decideReview(manifest, binding, input, reviewers, input.observedAt);
    assert.equal(result.action, action);
    assert.equal('reason' in result ? result.reason : undefined, reason);
  }
});

await test('48 hours means first complete scan after ready; late thumbs still approves; both/no votes are rechecked', () => {
  for (const reactions of [[], [reaction('👍'), reaction('❌')]]) {
    const before = observation(reactions, readyAt + REVIEW_EXPIRY_MS - 1);
    assert.deepEqual(decideReview(manifest, binding, before, reviewers, before.observedAt), { action: 'HOLD', reason: 'UNAPPROVED' });
    const after = observation(reactions, readyAt + REVIEW_EXPIRY_MS);
    assert.deepEqual(decideReview(manifest, binding, after, reviewers, after.observedAt), { action: 'REJECT', reason: 'EXPIRED', reviewerIds: [] });
  }
  const late = observation([reaction('👍')], readyAt + REVIEW_EXPIRY_MS + 1000);
  assert.equal(decideReview(manifest, binding, late, reviewers, late.observedAt).action, 'APPROVE_PUBLISH');
});

await test('body excludes any non-thumbs human reaction and ignores bot seeds/unregistered reactions', () => {
  const input = observation([reaction('👍')]);
  input.parts[0]!.reactions = [reaction('👍'), reaction('❌', 'bot', true)];
  input.parts[1]!.reactions = [reaction('👍'), reaction('👎')];
  input.parts[2]!.reactions = [reaction('❌', 'stranger')];
  const result = decideReview(manifest, binding, input, reviewers, input.observedAt);
  assert.equal(result.action, 'APPROVE_PUBLISH');
  if (result.action !== 'APPROVE_PUBLISH') throw new Error('expected approval');
  assert.deepEqual(result.excludedUnitIds, [manifest.units[1]!.id]);
  input.parts.forEach(part => { part.reactions = [reaction('❌')]; });
  input.observedAt = readyAt + REVIEW_EXPIRY_MS;
  assert.deepEqual(decideReview(manifest, binding, input, reviewers, input.observedAt), { action: 'HOLD', reason: 'NEEDS_ADMIN' });
});

await test('missing, duplicate, partial, stale and pre-ready observations never approve or expire', () => {
  const base = observation([reaction('👍')], readyAt + REVIEW_EXPIRY_MS);
  const inputs = [structuredClone(base), structuredClone(base), structuredClone(base), structuredClone(base)];
  inputs[0]!.parts.pop();
  inputs[1]!.parts[1] = inputs[1]!.parts[0]!;
  inputs[2]!.head.reactions[0]!.complete = false;
  inputs[3]!.parts[0]!.complete = false;
  for (const input of inputs) assert.deepEqual(decideReview(manifest, binding, input, reviewers, input.observedAt), { action: 'HOLD', reason: 'READ_INCOMPLETE' });
  assert.deepEqual(decideReview(manifest, binding, base, reviewers, base.observedAt + 120001), { action: 'HOLD', reason: 'STALE_OBSERVATION' });
  base.observedAt = readyAt - 1;
  assert.deepEqual(decideReview(manifest, binding, base, reviewers, readyAt), { action: 'HOLD', reason: 'STALE_OBSERVATION' });
});

await test('long sentence fragments keep one exclusion unit without splitting emoji surrogate pairs', () => {
  const text = '가😀'.repeat(1500) + '.';
  const long = reviewManifest([{ type: 'TEXT', text }, { type: 'TEXT', text: '유지.' }], 'a'.repeat(64));
  const unit = long.units[0]!;
  assert.equal(unit.fragments.join(''), text);
  assert.ok(unit.fragments.length > 1);
  assert.ok(unit.fragments.every(fragment => fragment.length <= 1800 && !/[\uD800-\uDBFF]$/.test(fragment)));
  const parts = long.units.flatMap(u => u.fragments.map((_, index) => ({ messageId: `${u.id}-${index}`, unitId: u.id })));
  const input: ReviewObservation = { observedAt: readyAt, head: { messageId: 'head', complete: true, reactions: [reaction('👍')] },
    parts: parts.map(part => ({ messageId: part.messageId, complete: true, reactions: [] })) };
  input.parts[1]!.reactions = [reaction('❌')];
  const result = decideReview(long, { readyAt, headMessageId: 'head', parts }, input, reviewers, readyAt);
  assert.equal(result.action, 'APPROVE_PUBLISH');
  if (result.action === 'APPROVE_PUBLISH') assert.deepEqual(reviewSelection(long, result.excludedUnitIds).blocks, [{ type: 'TEXT', text: '유지.' }]);
});
