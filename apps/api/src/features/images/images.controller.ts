import { Controller, Get, Post, Delete, Inject, UseGuards } from '@nestjs/common';
import { ImagesService } from './images.service.js';
import { AdminGuard, Actor } from '../../http/auth.guard.js';
import { Input, ContractPipe, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult, BinaryResult } from '../../http/response.js';
import { ImageFiles } from '../../http/multipart.js';
import type { ImageFile } from './image-validation.js';
@Controller('/api/v1/admin/images')
@UseGuards(AdminGuard)
export class ImagesController {
  constructor(@Inject(ImagesService) private readonly service: ImagesService) {}
  @Post()
  async upload(
    @Input(ContractPipe) _input: RequestInput,
    @ImageFiles() files: ImageFile[],
    @Actor() actor: string
  ) {
    return new HttpResult(await this.service.upload(files, actor), {}, 200, 'private, no-store');
  }
  @Get(':imageId/preview')
  async preview(@Input(ContractPipe) input: RequestInput) {
    const result = await this.service.preview(stringField(input.params, 'imageId'));
    return new BinaryResult(result.bytes, result.mime);
  }
  @Delete(':imageId')
  async discard(@Input(ContractPipe) input: RequestInput, @Actor() actor: string) {
    return new HttpResult(
      await this.service.discard(stringField(input.params, 'imageId'), actor),
      {},
      202,
      'private, no-store'
    );
  }
}
