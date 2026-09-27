import { DatabaseContext, TypeOrmUnitOfWork } from '../dist/persistence/database.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';

// Historical rollback coverage runs on the exact immutable V001–V008 scripts.
// Production migration discovery continues to include every additive migration.
export class LegacyMigrationRepository extends TypeOrmMigrationsRepository {
  override async scripts() {
    return (await super.scripts()).filter(script => script.version <= 'V008');
  }
}
export function legacyMigrations(db: DatabaseContext) {
  return new MigrationsService(new LegacyMigrationRepository(db), new TypeOrmUnitOfWork(db));
}
