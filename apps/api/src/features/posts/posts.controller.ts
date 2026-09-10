import { Controller, Get, Post, Patch, Delete, Inject, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { AdminGuard, Actor } from '../../http/auth.guard.js';
import { Input, ContractPipe, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import { postCommand, summaryDto, editorDto } from './posts.dto.js';
@Controller('/api/v1/admin/posts')
@UseGuards(AdminGuard)
export class PostsController {
  constructor(@Inject(PostsService) private readonly service: PostsService) {}
  @Get()
  async search(@Input(ContractPipe) input: RequestInput) {
    const result = await this.service.search({
      status: stringField(input.query, 'status'),
      board: stringField(input.query, 'board'),
      titlePrefix: stringField(input.query, 'titlePrefix'),
      from: stringField(input.query, 'from'),
      to: stringField(input.query, 'to'),
      page: stringField(input.query, 'page', '1'),
    });
    return new HttpResult(
      { items: result.items.map(summaryDto) },
      result.meta,
      200,
      'private, no-store'
    );
  }
  @Get(':postId')
  async detail(@Input(ContractPipe) input: RequestInput) {
    return new HttpResult(
      editorDto(await this.service.detail(stringField(input.params, 'postId'))),
      {},
      200,
      'private, no-store'
    );
  }
  private async execute(input: RequestInput, actor: string) {
    const result = await this.service.command(
      postCommand(input),
      actor,
      stringField(input.headers, 'idempotency-key'),
      `${input.method} ${input.operation.pattern}`
    );
    return new HttpResult(result.data, {}, result.status, 'private, no-store');
  }
  @Post() create(@Input(ContractPipe) input: RequestInput, @Actor() actor: string) {
    return this.execute(input, actor);
  }
  @Patch(':postId') update(@Input(ContractPipe) input: RequestInput, @Actor() actor: string) {
    return this.execute(input, actor);
  }
  @Delete(':postId') remove(@Input(ContractPipe) input: RequestInput, @Actor() actor: string) {
    return this.execute(input, actor);
  }
  @Post(':postId/publish') publish(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    return this.execute(input, actor);
  }
  @Post(':postId/unschedule') unschedule(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    return this.execute(input, actor);
  }
  @Post(':postId/hide') hide(@Input(ContractPipe) input: RequestInput, @Actor() actor: string) {
    return this.execute(input, actor);
  }
  @Post(':postId/republish') republish(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    return this.execute(input, actor);
  }
}
