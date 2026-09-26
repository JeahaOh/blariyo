import { Controller, Get, Post, Inject } from '@nestjs/common';
import { PublicService } from './public.service.js';
import { Input, ContractPipe, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import {
  boardsDto,
  listDto,
  detailDto,
  policyDto,
  PUBLIC_ORIGINS,
  type PublicOrigins,
} from './public.dto.js';

@Controller('/api/v1')
export class PublicController {
  constructor(
    @Inject(PublicService) private readonly service: PublicService,
    @Inject(PUBLIC_ORIGINS) private readonly origins: PublicOrigins
  ) {}
  @Get('boards')
  async boards(@Input(ContractPipe) _input: RequestInput) {
    return new HttpResult(
      boardsDto(await this.service.boards()),
      {},
      200,
      'public, max-age=60, s-maxage=300'
    );
  }
  @Get('boards/:boardSlug/posts')
  async list(@Input(ContractPipe) input: RequestInput) {
    const result = await this.service.list(
      stringField(input.params, 'boardSlug'),
      Number(stringField(input.query, 'page', '1'))
    );
    return new HttpResult(listDto(result, this.origins), result.meta);
  }
  @Get('boards/:boardSlug/posts/:postId')
  async detail(@Input(ContractPipe) input: RequestInput) {
    return new HttpResult(
      detailDto(
        await this.service.detail(
          stringField(input.params, 'boardSlug'),
          stringField(input.params, 'postId')
        ),
        this.origins
      )
    );
  }
  @Post('boards/:boardSlug/posts/:postId/views')
  async view(@Input(ContractPipe) input: RequestInput) {
    await this.service.view(
      stringField(input.params, 'boardSlug'),
      stringField(input.params, 'postId')
    );
    return new HttpResult(undefined, {}, 204);
  }
  @Get('policies/:type')
  async policy(@Input(ContractPipe) input: RequestInput) {
    return new HttpResult(
      policyDto(
        await this.service.policy(
          stringField(input.params, 'type'),
          stringField(input.query, 'version')
        )
      ),
      {},
      200,
      'public, max-age=60, s-maxage=300'
    );
  }
}
