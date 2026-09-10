import type { components } from '@blariyo/contracts/api';
import { schemaValidator } from '@blariyo/contracts';
import { fail } from '../../shared/errors.js';
import { stringField, type RequestInput } from '../../http/contracts.js';
import type { PostRecord, PostCommand, EditorBlock } from './posts.model.js';
function bodyIs<K extends keyof components['schemas']>(
  value: unknown,
  schema: K
): value is components['schemas'][K] {
  return schemaValidator({ $ref: `#/components/schemas/${schema}` })(value);
}
export function postCommand(input: RequestInput): PostCommand {
  const body = input.body,
    params = { postId: stringField(input.params, 'postId') };
  switch (input.operation.operationId) {
    case 'createPost':
      if (bodyIs(body, 'CreatePostRequest'))
        return { action: 'create', params: input.params, body };
      break;
    case 'updatePost':
      if (bodyIs(body, 'UpdatePostRequest')) return { action: 'update', params, body };
      break;
    case 'publishPost':
      if (bodyIs(body, 'PublishPostRequest')) return { action: 'publish', params, body };
      break;
    case 'hidePost':
      if (bodyIs(body, 'HidePostRequest')) return { action: 'hide', params, body };
      break;
    case 'republishPost':
      if (bodyIs(body, 'RepublishPostRequest')) return { action: 'republish', params, body };
      break;
    case 'removePost':
      if (bodyIs(body, 'RemovePostRequest')) return { action: 'remove', params, body };
      break;
    case 'unschedulePost':
      if (bodyIs(body, 'LockVersionRequest')) return { action: 'unschedule', params, body };
      break;
  }
  fail(400, 'VALIDATION_FAILED');
}
export function summaryDto(post: PostRecord): components['schemas']['AdminPostSearchItem'] {
  return {
    postId: Number(post.id),
    boardSlug: post.slug,
    title: post.title,
    status: post.status,
    lockVersion: post.lockVersion,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
  };
}
function blockDto(block: EditorBlock): components['schemas']['AdminBlock'] {
  if (block.type === 'TEXT' && block.text !== null) return { type: 'TEXT', text: block.text };
  const status = block.imageStatus;
  if (
    block.type !== 'IMAGE' ||
    block.imageId === null ||
    block.alt === null ||
    block.width === null ||
    block.height === null ||
    !bodyIs(status, 'ImageStatus')
  )
    throw new Error('INVALID_EDITOR_BLOCK');
  return {
    type: 'IMAGE',
    imageId: Number(block.imageId),
    alt: block.alt,
    status,
    width: block.width,
    height: block.height,
    previewPath: ['PRIVATE_DELETE_PENDING', 'DELETED'].includes(status)
      ? null
      : `/api/v1/admin/images/${block.imageId}/preview`,
  };
}
export function editorDto(value: {
  post: PostRecord;
  blocks: EditorBlock[];
}): components['schemas']['AdminPostEditorData'] {
  const post = value.post;
  return {
    ...summaryDto(post),
    source: post.sourceUrl ? { name: post.sourceName ?? '', url: post.sourceUrl } : null,
    pinnedPosition: post.pinnedPosition,
    createdAt: post.createdAt.toISOString(),
    blocks: value.blocks.map(blockDto),
  };
}
