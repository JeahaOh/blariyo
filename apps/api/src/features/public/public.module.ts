import { Module, type DynamicModule } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';
import { PublicRepository } from './public.repository.js';
import { TypeOrmPublicRepository } from '../../persistence/public.repository.js';
import { PUBLIC_ORIGINS, type PublicOrigins } from './public.dto.js';
import { SitemapController } from './sitemap.controller.js';
import { SitemapService } from './sitemap.service.js';
import { SitemapRepository } from './sitemap.repository.js';
import { TypeOrmSitemapRepository } from '../../persistence/sitemap.repository.js';

@Module({})
export class PublicModule {
  static register(persistence: DynamicModule, origins: PublicOrigins): DynamicModule {
    return {
      module: PublicModule,
      imports: [persistence],
      controllers: [PublicController, SitemapController],
      providers: [
        PublicService,
        SitemapService,
        { provide: SitemapRepository, useClass: TypeOrmSitemapRepository },
        { provide: PublicRepository, useClass: TypeOrmPublicRepository },
        { provide: PUBLIC_ORIGINS, useValue: origins },
      ],
      exports: [PublicService],
    };
  }
}
