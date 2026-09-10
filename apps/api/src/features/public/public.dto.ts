import type { components } from '@blariyo/contracts/api';
import type { Board, PublishedPost } from './public.repository.js';
import type { PublicList, PublicDetail, PublicPolicy } from './public.service.js';
export interface PublicOrigins {
  siteOrigin: string;
  imageOrigin: string;
}
export const PUBLIC_ORIGINS = Symbol('PUBLIC_ORIGINS');
const boardDto = (board: Board) => ({ slug: board.slug, displayName: board.displayName });
function itemDto(post: PublishedPost, board: Board): components['schemas']['PostListItem'] {
  return {
    postId: Number(post.id),
    title: post.title,
    viewCount: Number(post.viewCount),
    authorLabel: '운영자',
    publishedAt: post.publishedAt.toISOString(),
    path: `/${board.slug}/posts/${post.id}`,
  };
}
export function boardsDto(boards: Board[]): components['schemas']['BoardListData'] {
  return {
    items: boards.map((board) => {
      // The shared M0 contract only permits ADMIN boards; reject unsupported data at the HTTP boundary.
      if (board.postingPolicy !== 'ADMIN') throw new Error('UNSUPPORTED_BOARD_POLICY');
      return { ...boardDto(board), postingPolicy: board.postingPolicy, path: `/${board.slug}` };
    }),
  };
}
export function listDto(list: PublicList): components['schemas']['PostListData'] {
  return {
    board: boardDto(list.board),
    pinnedItems: list.pinnedItems.map((post) => itemDto(post, list.board)),
    items: list.items.map((post) => itemDto(post, list.board)),
  };
}
export function detailDto(
  value: PublicDetail,
  origins: PublicOrigins
): components['schemas']['PostDetailData'] {
  const { post, board, list } = value;
  const { path: _path, ...summary } = itemDto(post, board);
  const contextItem = (item: PublishedPost) => ({
    ...itemDto(item, board),
    ...(item.id === post.id ? { current: true } : {}),
  });
  return {
    post: {
      ...summary,
      board: boardDto(board),
      blocks: value.blocks.map((block) =>
        block.type === 'TEXT'
          ? { type: 'TEXT', text: block.text }
          : {
              type: 'IMAGE',
              image: {
                url: `${origins.imageOrigin}/${block.key}`,
                alt: block.alt,
                width: block.width,
                height: block.height,
              },
            }
      ),
      source: post.sourceUrl ? { name: post.sourceName ?? '', url: post.sourceUrl } : null,
      shareUrl: `${origins.siteOrigin}/${board.slug}/posts/${post.id}`,
    },
    context: {
      pinnedItems: list.pinnedItems.map(contextItem),
      items: list.items.map(contextItem),
      listPage: list.meta.page,
      pageSize: 20,
      totalItems: list.meta.totalItems,
      totalPages: list.meta.totalPages,
    },
  };
}
export function policyDto(value: PublicPolicy): components['schemas']['PolicyData'] {
  const history = (row: PublicPolicy['policy']) => ({
    version: row.version,
    effectiveAt: row.effectiveAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  });
  return {
    policy: {
      ...history(value.policy),
      type: value.type,
      title: value.policy.title,
      bodyHtml: value.policy.bodyHtml,
    },
    history: value.history.map(history),
  };
}
