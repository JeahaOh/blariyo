import { Controller, Get, Inject, Param } from '@nestjs/common';
import { SitemapService } from './sitemap.service.js';
import { BinaryResult } from '../../http/response.js';

// Public metadata only; the Core listener remains on the private app network.
@Controller('/internal/sitemaps')
export class SitemapController {
  constructor(@Inject(SitemapService) private readonly service: SitemapService) {}
  @Get(':name')
  async document(@Param('name') name: string) {
    return new BinaryResult(
      await this.service.document(name),
      'application/xml; charset=utf-8',
      'no-store'
    );
  }
}
