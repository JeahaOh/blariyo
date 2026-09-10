import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CoreRequest } from './contracts.js';
import { fail } from '../shared/errors.js';
import type { ImageFile } from '../features/images/image-validation.js';
/** Streaming transport exception: raw Request never escapes this file. */
export async function multipart(request: CoreRequest, limit: number): Promise<FormData> {
  if (Number(request.get('content-length') || 0) > limit) fail(413, 'UPLOAD_TOO_LARGE');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk: unknown = value;
    if (!Buffer.isBuffer(chunk)) fail(400, 'VALIDATION_FAILED');
    size += chunk.length;
    if (size > limit) fail(413, 'UPLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  try {
    return await new Response(new Uint8Array(Buffer.concat(chunks)), {
      headers: { 'content-type': request.get('content-type') ?? '' },
    }).formData();
  } catch {
    fail(400, 'VALIDATION_FAILED');
  }
}
export const ImageFiles = createParamDecorator(
  async (_data: unknown, context: ExecutionContext): Promise<ImageFile[]> => {
    const request = context.switchToHttp().getRequest<CoreRequest>();
    const form = await multipart(request, 101 * 1024 * 1024);
    const files: ImageFile[] = [];
    for (const [name, value] of form.entries()) {
      if (name !== 'files' || !(value instanceof File)) fail(400, 'VALIDATION_FAILED');
      files.push({ bytes: Buffer.from(await value.arrayBuffer()), mime: value.type });
    }
    return files;
  }
);
