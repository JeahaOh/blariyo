import { Module, type DynamicModule } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnitOfWork } from '../shared/unit-of-work.js';
import { createDataSource, DatabaseContext, TypeOrmUnitOfWork } from './database.js';

@Module({})
export class PersistenceModule {
  static forRoot(url: string, migration = false): DynamicModule {
    return {
      module: PersistenceModule,
      providers: [
        { provide: DataSource, useFactory: () => createDataSource(url, migration).initialize() },
        DatabaseContext,
        { provide: UnitOfWork, useClass: TypeOrmUnitOfWork },
      ],
      exports: [DatabaseContext, UnitOfWork],
    };
  }
}
