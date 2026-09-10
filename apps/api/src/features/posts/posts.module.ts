import { Module, type DynamicModule } from '@nestjs/common';
import { PostsController } from './posts.controller.js';
import { PostsService, POST_ORIGINS, type PostOrigins } from './posts.service.js';
import { PostsRepository } from './posts.repository.js';
import { ImagesRepository } from '../images/images.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { IdempotencyRepository } from '../../shared/idempotency.repository.js';
import { TypeOrmPostsRepository } from '../../persistence/posts.repository.js';
import { TypeOrmImagesRepository } from '../../persistence/images.repository.js';
import { TypeOrmOutboxRepository } from '../../persistence/outbox.repository.js';
import { TypeOrmIdempotencyRepository } from '../../persistence/idempotency.repository.js';
import { Storage } from '../../shared/storage.js';
import { HTTP_OPTIONS, AdminGuard, type HttpOptions } from '../../http/auth.guard.js';
@Module({})
export class PostsModule {
  static register(
    persistence: DynamicModule,
    storage: Storage,
    options: HttpOptions,
    origins: PostOrigins
  ): DynamicModule {
    return {
      module: PostsModule,
      imports: [persistence],
      controllers: [PostsController],
      providers: [
        PostsService,
        AdminGuard,
        { provide: PostsRepository, useClass: TypeOrmPostsRepository },
        { provide: ImagesRepository, useClass: TypeOrmImagesRepository },
        { provide: OutboxRepository, useClass: TypeOrmOutboxRepository },
        { provide: IdempotencyRepository, useClass: TypeOrmIdempotencyRepository },
        { provide: Storage, useValue: storage },
        { provide: HTTP_OPTIONS, useValue: options },
        { provide: POST_ORIGINS, useValue: origins },
      ],
      exports: [PostsService],
    };
  }
}
