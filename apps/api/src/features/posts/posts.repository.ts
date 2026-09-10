import type {
  PostRecord,
  CreatePost,
  EditBlock,
  PostSearch,
  EditorBlock,
  DuePost,
  PostStatus,
} from './posts.model.js';
export abstract class PostsRepository {
  abstract find(id: string, lock?: boolean): Promise<PostRecord | null>;
  abstract postingBoard(slug: string): Promise<{ id: string; slug: string } | null>;
  abstract create(
    boardId: string,
    slug: string,
    body: CreatePost,
    actor: string
  ): Promise<PostRecord>;
  abstract update(post: PostRecord, actor: string, publishNow: boolean): Promise<PostRecord>;
  abstract deleteBlocks(postId: string): Promise<void>;
  abstract addBlock(
    postId: string,
    position: number,
    block: EditBlock,
    actor: string
  ): Promise<void>;
  abstract history(
    post: PostRecord,
    from: PostStatus | null,
    reason: string,
    actor: string
  ): Promise<void>;
  abstract search(query: PostSearch): Promise<{ items: PostRecord[]; total: number }>;
  abstract editorBlocks(postId: string): Promise<EditorBlock[]>;
  abstract due(): Promise<DuePost[]>;
  abstract cancelConflictedSchedule(id: string, lockVersion: number): Promise<PostRecord | null>;
  abstract recordScheduleFailure(post: DuePost, code: string, attemptedAt: Date): Promise<void>;
}
