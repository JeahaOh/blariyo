import type { components } from '@blariyo/contracts/api';
export type PostStatus = components['schemas']['PostStatus'];
export type CreatePost = components['schemas']['CreatePostRequest'];
export type EditBlock = components['schemas']['EditBlock'];
export type PostCommand =
  | { action: 'create'; params: Record<string, string>; body: CreatePost }
  | {
      action: 'update';
      params: { postId: string };
      body: components['schemas']['UpdatePostRequest'];
    }
  | {
      action: 'publish';
      params: { postId: string };
      body: components['schemas']['PublishPostRequest'];
    }
  | { action: 'hide'; params: { postId: string }; body: components['schemas']['HidePostRequest'] }
  | {
      action: 'republish';
      params: { postId: string };
      body: components['schemas']['RepublishPostRequest'];
    }
  | {
      action: 'remove';
      params: { postId: string };
      body: components['schemas']['RemovePostRequest'];
    }
  | {
      action: 'unschedule' | 'due';
      params: { postId: string };
      body: components['schemas']['LockVersionRequest'];
    };
export interface PostRecord {
  id: string;
  boardId: string;
  slug: string;
  title: string;
  status: PostStatus;
  sourceName: string | null;
  sourceUrl: string | null;
  pinnedPosition: number | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface PostSearch {
  status?: string;
  board?: string;
  titlePrefix?: string;
  from?: string;
  to?: string;
  page?: string;
}
export interface EditorBlock {
  type: 'TEXT' | 'IMAGE';
  text: string | null;
  imageId: string | null;
  alt: string | null;
  imageStatus: string | null;
  width: number | null;
  height: number | null;
}
export interface DuePost {
  id: string;
  lockVersion: number;
  scheduledAt: Date;
}
