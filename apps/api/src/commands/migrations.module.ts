import { Module, type DynamicModule } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { TypeOrmMigrationsRepository } from '../persistence/migrations.repository.js';
import { MigrationsRepository } from './migrations.repository.js';
import { MigrationsService } from './migrations.service.js';
@Module({})
export class MigrationsModule {
  static register(url: string): DynamicModule {
    return {
      module: MigrationsModule,
      imports: [PersistenceModule.forRoot(url, true)],
      providers: [
        MigrationsService,
        { provide: MigrationsRepository, useClass: TypeOrmMigrationsRepository },
      ],
      exports: [MigrationsService],
    };
  }
}
