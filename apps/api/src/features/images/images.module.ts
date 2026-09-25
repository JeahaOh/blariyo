import { LocalMediaController } from './local-media.controller.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { ImagesController } from './images.controller.js';
import { ImagesService } from './images.service.js';
import { ImagesRepository } from './images.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { TypeOrmImagesRepository } from '../../persistence/images.repository.js';
import { TypeOrmOutboxRepository } from '../../persistence/outbox.repository.js';
import { Storage } from '../../shared/storage.js';
import { HTTP_OPTIONS, AdminGuard, type HttpOptions } from '../../http/auth.guard.js';
@Module({})
export class ImagesModule {
  static register(
    persistence: DynamicModule,
    storage: Storage,
    options: HttpOptions
  ): DynamicModule {
    return {
      module: ImagesModule,
      imports: [persistence],
      controllers: [
        ImagesController,
        ...(options.localMedia && process.env.NODE_ENV !== 'production'
          ? [LocalMediaController]
          : []),
      ],
      providers: [
        ImagesService,
        AdminGuard,
        { provide: ImagesRepository, useClass: TypeOrmImagesRepository },
        { provide: OutboxRepository, useClass: TypeOrmOutboxRepository },
        { provide: Storage, useValue: storage },
        { provide: HTTP_OPTIONS, useValue: options },
      ],
      exports: [ImagesService, ImagesRepository],
    };
  }
}
