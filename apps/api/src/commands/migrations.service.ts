import { Inject,Injectable } from '@nestjs/common';
import { MigrationsRepository } from './migrations.repository.js';
import { UnitOfWork } from '../shared/unit-of-work.js';
@Injectable()
export class MigrationsService {
 constructor(@Inject(MigrationsRepository) private readonly repository:MigrationsRepository,@Inject(UnitOfWork) private readonly work:UnitOfWork){}
 migrate(direction='up'){
  return this.work.transaction(async()=>{
   await this.repository.lock();await this.repository.ensureLedger();
   const scripts=await this.repository.scripts(),applied=await this.repository.applied();
   for(const record of applied)if(!(await this.repository.checksum(record.filename)).equals(record.checksum))throw new Error('Migration checksum mismatch');
   if(direction==='down'){const last=applied.at(-1);if(last)await this.repository.rollback(last);return;}
   if(direction!=='up')throw new Error('Expected up or down');
   for(const script of scripts){if(applied.some(record=>record.version===script.version))continue;const started=Date.now();await this.repository.apply(script.filename);await this.repository.record(script,Date.now()-started);}
  });
 }
 grantApplication(role:string){return this.repository.grantApplication(role);}
}
