import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { fileURLToPath } from 'node:url';
import { MigrationsModule } from './migrations.module.js';
import { MigrationsService } from './migrations.service.js';
import { resolveDatabaseUrl } from '../bootstrap/database-config.js';
export async function migrationContext(databaseUrl: string) {
  return NestFactory.createApplicationContext(MigrationsModule.register(databaseUrl), {
    logger: false,
    abortOnError: false,
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const app = await migrationContext(resolveDatabaseUrl(process.env, 'migration'));
    try {
      await app.get(MigrationsService).migrate(process.argv[2] || 'up');
      if (process.env.DB_APP_ROLE)
        await app.get(MigrationsService).grantApplication(process.env.DB_APP_ROLE);
      console.log('Migration complete');
    } finally {
      await app.close();
    }
  } catch (error) {
    console.error(
      error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'MIGRATION_FAILED'
    );
    process.exitCode = 1;
  }
}
