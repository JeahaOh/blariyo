/** Application read models. IDs remain decimal strings until the HTTP mapping. */
export interface Board {
  id: string;
  slug: string;
  displayName: string;
  postingPolicy: 'ADMIN' | 'USER';
}
export interface PublishedPost {
  id: string;
  title: string;
  viewCount: string;
  publishedAt: Date;
  pinnedPosition: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
}
export type PublishedBlock =
  | { type: 'TEXT'; text: string }
  | {
      type: 'IMAGE';
      key: string;
      alt: string;
      width: number;
      height: number;
    };
export interface PublishedPolicy {
  version: string;
  effectiveAt: Date;
  endedAt: Date | null;
  status: 'EFFECTIVE' | 'RETIRED';
  title: string;
  bodyHtml: string;
}
export abstract class PublicRepository {
  abstract activeBoards(): Promise<Board[]>;
  abstract activeBoard(slug: string): Promise<Board | null>;
  abstract countPosts(boardId: string): Promise<number>;
  abstract pinnedPosts(boardId: string): Promise<PublishedPost[]>;
  abstract pagePosts(boardId: string, offset: number): Promise<PublishedPost[]>;
  abstract post(boardId: string, postId: string): Promise<PublishedPost | null>;
  abstract rank(boardId: string, post: PublishedPost): Promise<number>;
  abstract blocks(postId: string): Promise<PublishedBlock[]>;
  abstract incrementView(slug: string, postId: string): Promise<boolean>;
  abstract policies(type: 'TERMS' | 'PRIVACY'): Promise<PublishedPolicy[]>;
}
