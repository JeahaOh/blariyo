import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ImagesService } from './images.service.js';
import { BinaryResult } from '../../http/response.js';
import { fail } from '../../shared/errors.js';
@Controller('/internal/local-media')
export class LocalMediaController {
  constructor(@Inject(ImagesService) private readonly service: ImagesService) {}
  @Get('{*key}') async read(@Param('key') value: unknown) {
    if (!Array.isArray(value) || !value.every((part: unknown): part is string => typeof part === 'string')) fail(404, 'IMAGE_NOT_FOUND');
    const result = await this.service.localMedia(value.join('/'));
    return new BinaryResult(result.bytes, result.mime, 'no-store', false);
  }
}
