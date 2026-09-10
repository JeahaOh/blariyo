import { Inject, Injectable } from '@nestjs/common';
import { PublicRepository, type Board } from './public.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail, validId, validSlug, pagination } from '../../shared/errors.js';

@Injectable()
export class PublicService {
  constructor(
    @Inject(PublicRepository) private readonly repository: PublicRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  boards() {
    return this.repository.activeBoards();
  }
  private async board(name: string, error = 'BOARD_NOT_FOUND') {
    if (!validSlug(name)) fail(404, error);
    const value = await this.repository.activeBoard(name);
    if (!value) fail(404, error);
    return value;
  }
  private async page(board: Board, page: number) {
    const total = await this.repository.countPosts(board.id);
    if (page > Math.max(1, Math.ceil(total / 20))) fail(404, 'PAGE_NOT_FOUND');
    const pinnedItems = await this.repository.pinnedPosts(board.id);
    const items = await this.repository.pagePosts(board.id, (page - 1) * 20);
    return { board, pinnedItems, items, meta: pagination(page, total) };
  }
  list(name: string, page = 1) {
    return this.work.transaction(async () => this.page(await this.board(name), page), {
      isolation: 'REPEATABLE READ',
      readOnly: true,
    });
  }
  detail(name: string, postId: string) {
    return this.work.transaction(
      async () => {
        if (!validId(postId)) fail(404, 'POST_NOT_FOUND');
        const board = await this.board(name, 'POST_NOT_FOUND');
        const post = await this.repository.post(board.id, postId);
        if (!post) fail(404, 'POST_NOT_FOUND');
        const rank = post.pinnedPosition ? 0 : await this.repository.rank(board.id, post);
        const list = await this.page(board, Math.floor(rank / 20) + 1);
        const blocks = await this.repository.blocks(post.id);
        return { post, board, blocks, list };
      },
      { isolation: 'REPEATABLE READ', readOnly: true }
    );
  }
  async view(name: string, postId: string): Promise<void> {
    if (!validSlug(name) || !validId(postId)) fail(404, 'POST_NOT_FOUND');
    if (!(await this.repository.incrementView(name, postId))) fail(404, 'POST_NOT_FOUND');
  }
  async policy(type: string, version?: string) {
    if (type !== 'terms' && type !== 'privacy') fail(404, 'POLICY_NOT_FOUND');
    const rows = await this.repository.policies(type === 'terms' ? 'TERMS' : 'PRIVACY');
    const policy = version
      ? rows.find((row) => row.version === version)
      : rows.find((row) => row.status === 'EFFECTIVE');
    if (!policy) fail(404, 'POLICY_NOT_FOUND');
    return {
      type: type === 'terms' ? ('terms' as const) : ('privacy' as const),
      policy,
      history: rows,
    };
  }
}
export type PublicList = Awaited<ReturnType<PublicService['list']>>;
export type PublicDetail = Awaited<ReturnType<PublicService['detail']>>;
export type PublicPolicy = Awaited<ReturnType<PublicService['policy']>>;
