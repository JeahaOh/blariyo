import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { fileURLToPath } from 'node:url';
import { MigrationsModule } from './migrations.module.js';
import { MigrationsService } from './migrations.service.js';
export async function migrationContext(databaseUrl:string){
 return NestFactory.createApplicationContext(MigrationsModule.register(databaseUrl),{logger:false,abortOnError:false});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL is required');
 const app=await migrationContext(url);
 try{
  await app.get(MigrationsService).migrate(process.argv[2]||'up');
  if(process.env.DB_APP_ROLE)await app.get(MigrationsService).grantApplication(process.env.DB_APP_ROLE);
  console.log('Migration complete');
 }finally{await app.close();}
}
