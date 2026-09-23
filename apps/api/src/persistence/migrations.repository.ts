import { Inject,Injectable } from '@nestjs/common';
import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MigrationsRepository,type MigrationScript,type AppliedMigration } from '../commands/migrations.repository.js';
import { DatabaseContext } from './database.js';
import { OpsSchemaMigrationEntity } from './entities.js';
import { apiCollectTables,batchResultTables,apiCollectSequences } from './collect-ownership.js';
const directory=new URL('../../migrations/',import.meta.url);
@Injectable()
export class TypeOrmMigrationsRepository extends MigrationsRepository {
 constructor(@Inject(DatabaseContext) private readonly db:DatabaseContext){super();}
 async lock(){await this.db.manager.query('SELECT pg_advisory_xact_lock(72498131)');}
 async ensureLedger(){await this.db.manager.query(`CREATE SCHEMA IF NOT EXISTS ops; CREATE TABLE IF NOT EXISTS ops.schema_migration (
   version VARCHAR(20) PRIMARY KEY CHECK(version ~ '^V[0-9]{3,}$'), filename VARCHAR(200) NOT NULL UNIQUE,
   checksum_sha256 BYTEA NOT NULL CHECK(octet_length(checksum_sha256)=32), applied_at TIMESTAMPTZ(3) NOT NULL,
   duration_ms INTEGER NOT NULL CHECK(duration_ms>=0)); REVOKE ALL ON ops.schema_migration FROM PUBLIC`);}
 async scripts(){
  const files=(await readdir(directory)).filter(file=>/^V\d+__.*\.sql$/.test(file)&&!file.endsWith('.down.sql')).sort();
  return Promise.all(files.map(async filename=>{const version=filename.split('__')[0];if(!version)throw new Error('INVALID_MIGRATION_FILENAME');return {version,filename,checksum:await this.checksum(filename)};}));
 }
 async applied(){return (await this.db.manager.find(OpsSchemaMigrationEntity,{order:{version:'ASC'}})).map(row=>({version:row.version,filename:row.filename,checksum:row.checksum_sha256}));}
 async checksum(filename:string){return createHash('sha256').update(await readFile(new URL(filename,directory))).digest();}
 async apply(filename:string){await this.db.manager.query(await readFile(new URL(filename,directory),'utf8'));}
 async record(script:MigrationScript,duration:number){await this.db.manager.query('INSERT INTO ops.schema_migration VALUES($1,$2,$3,now(),$4)',[script.version,script.filename,script.checksum,duration]);}
 async rollback(migration:AppliedMigration){await this.apply(migration.filename.replace('.sql','.down.sql'));await this.db.manager.delete(OpsSchemaMigrationEntity,{version:migration.version});}
 async grantApplication(role:string){
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(role))throw new Error('Invalid application role');
  await this.db.manager.query(`GRANT USAGE ON SCHEMA content,legal,ops,collect TO ${role};
 REVOKE ALL ON ALL TABLES IN SCHEMA collect FROM ${role};
 REVOKE ALL ON ALL SEQUENCES IN SCHEMA collect FROM ${role};
 REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA collect FROM ${role};
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA content,legal TO ${role};
 GRANT SELECT,INSERT,UPDATE,DELETE ON ops.outbox_task,ops.idempotency_request,ops.schedule_failure_alert TO ${role};
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA content,legal TO ${role};
 DO $grant$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY[${apiCollectTables.map(t=>`'${t}'`).join(',')}] LOOP
   IF to_regclass('collect.'||t) IS NOT NULL THEN
     EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON collect.%I TO ${role}',t);
   END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY[${batchResultTables.map(t=>`'${t}'`).join(',')}] LOOP
   IF to_regclass('collect.'||t) IS NOT NULL THEN
     EXECUTE format('GRANT SELECT ON collect.%I TO ${role}',t);
   END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY[${apiCollectSequences.map(t=>`'${t}'`).join(',')}] LOOP
   IF to_regclass('collect.'||t) IS NOT NULL THEN
     EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE collect.%I TO ${role}',t);
   END IF;
 END LOOP;
 END $grant$;
 REVOKE ALL ON ops.schema_migration FROM ${role};
 GRANT EXECUTE ON FUNCTION ops.is_schema_ready(TEXT) TO ${role}`);
 }
}
