import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicService } from '../dist/features/public/public.service.js';
import { PublicRepository, type Board, type PublishedPost, type PublishedBlock, type PublishedPolicy } from '../dist/features/public/public.repository.js';
import { UnitOfWork, type TransactionOptions } from '../dist/shared/unit-of-work.js';

class MemoryWork extends UnitOfWork {
  calls: (TransactionOptions | undefined)[] = [];
  async transaction<T>(work: () => Promise<T>, options?: TransactionOptions): Promise<T> { this.calls.push(options); return work(); }
  async transactionLock(): Promise<void> { throw new Error('Unexpected lock'); }
  async lock<T>(): Promise<T> { throw new Error('Unexpected lock'); }
}
class MockPublicRepository extends PublicRepository {
  calls: unknown[][] = [];
  board: Board = {id: '7', slug: 'meme', displayName: '짤', postingPolicy: 'ADMIN'};
  current: PublishedPost = {id: '21', title: 'example', viewCount: '3', publishedAt: new Date('2026-01-01T00:00:00Z'), pinnedPosition: null, sourceName: null, sourceUrl: null};
  async activeBoards() { return [this.board]; }
  async activeBoard(slug: string) { this.calls.push(['board', slug]); return slug === 'meme' ? this.board : null; }
  async countPosts() { return 21; }
  async pinnedPosts() { return []; }
  async pagePosts(board: string, offset: number) { this.calls.push(['page', board, offset]); return [this.current]; }
  async post(_board: string, id: string) { return id === this.current.id ? this.current : null; }
  async rank() { return 20; }
  async blocks(): Promise<PublishedBlock[]> { return [{type: 'TEXT', text: 'body'}]; }
  async incrementView(slug: string) { return slug === 'meme'; }
  async policies(): Promise<PublishedPolicy[]> { return [{version: 'old', status: 'RETIRED', effectiveAt: new Date(0), endedAt: new Date(1), title: 'old', bodyHtml: '<p>old</p>'}, {version: 'current', status: 'EFFECTIVE', effectiveAt: new Date(1), endedAt: null, title: 'current', bodyHtml: '<p>current</p>'}]; }
}
await test('public detail chooses the contextual page inside a read-only repeatable snapshot', async () => {
  const repository = new MockPublicRepository(), work = new MemoryWork();
  const service = new PublicService(repository, work);
  const value = await service.detail('meme', '21');
  assert.equal(value.list.meta.page, 2);
  assert.deepEqual(repository.calls.at(-1), ['page', '7', 20]);
  assert.deepEqual(work.calls, [{isolation: 'REPEATABLE READ', readOnly: true}]);
  repository.current.pinnedPosition = 1;
  assert.equal((await service.detail('meme', '21')).list.meta.page, 1);
});
await test('invalid, unpublished and wrong-board details keep generalized errors', async () => {
  const service = new PublicService(new MockPublicRepository(), new MemoryWork());
  for (const [board,id] of [['meme','bad'],['missing','21'],['meme','999']] as const)
    await assert.rejects(service.detail(board,id), {status: 404, code: 'POST_NOT_FOUND'});
  await assert.rejects(service.list('meme',3), {code: 'PAGE_NOT_FOUND'});
  await assert.rejects(service.view('missing','21'), {code: 'POST_NOT_FOUND'});
});
await test('public policy selects the effective version or explicit historical version', async () => {
  const service = new PublicService(new MockPublicRepository(), new MemoryWork());
  assert.equal((await service.policy('terms')).policy.version, 'current');
  assert.equal((await service.policy('privacy','old')).policy.version, 'old');
  await assert.rejects(service.policy('terms','absent'), {code: 'POLICY_NOT_FOUND'});
  await assert.rejects(service.policy('unknown'), {code: 'POLICY_NOT_FOUND'});
});
