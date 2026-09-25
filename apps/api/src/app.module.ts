import { BatchReviewModule } from './features/collection/batch-review.module.js';
import { CollectReader } from './shared/collect-reader.js';
import { DisabledCollectReader } from './adapters/collect-reader.js';
import type { CollectionOptions } from './features/collection/collection-admin.guard.js';
import { CollectionModule } from './features/collection/collection.module.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { HealthModule } from './features/health/health.module.js';
import { PoliciesModule } from './features/policies/policies.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { PostsModule } from './features/posts/posts.module.js';
import { ImagesModule } from './features/images/images.module.js';
import { localStorage, localCache } from './adapters/storage.js';
import type { Storage, EdgeCache } from './shared/storage.js';
import { PublicModule } from './features/public/public.module.js';
import { PersistenceModule } from './persistence/persistence.module.js';

export interface ApplicationOptions extends CollectionOptions {
  databaseUrl: string;
  collectReader?: CollectReader;
  collectorKeySecret?: string;
  collectManualUrlEnabled?: boolean;
  collectDiscordCommandEnabled?: boolean;
  siteOrigin?: string;
  imageOrigin?: string;
  analyticsContentKeySecret?: string;
  storage?: Storage;
  cache?: EdgeCache;
  serviceToken?: string;
  maintenance?: boolean;
}
@Module({})
export class AppModule {
  static register(options: ApplicationOptions): DynamicModule {
    const persistence = PersistenceModule.forRoot(options.databaseUrl);
    const storage = options.storage ?? localStorage('.local-data/media');
    const images = ImagesModule.register(persistence, storage, options);
    const posts = PostsModule.register(persistence, storage, options, {
      siteOrigin: options.siteOrigin ?? 'http://localhost:3000',
      imageOrigin: options.imageOrigin ?? 'http://localhost:3000/media',
    });
    const collection = CollectionModule.register(persistence, storage, options, images, posts);
    return {
      module: AppModule,
      imports: [
        collection,
        BatchReviewModule.register(persistence, images, posts, options.collectReader ?? new DisabledCollectReader(), options),
        HealthModule.register(persistence, options),
        PoliciesModule.register(persistence),
        PublicModule.register(persistence, {
          siteOrigin: options.siteOrigin ?? 'http://localhost:3000',
          imageOrigin: options.imageOrigin ?? 'http://localhost:3000/media',
          analyticsContentKeySecret:
            options.analyticsContentKeySecret ?? 'local-development-analytics-secret-32b',
        }),
        images,
        posts,
        OperationsModule.register(persistence, storage, options.cache ?? localCache(), collection),
      ],
    };
  }
}
