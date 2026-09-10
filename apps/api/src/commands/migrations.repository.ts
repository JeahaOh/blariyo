export interface MigrationScript {version:string;filename:string;checksum:Buffer}
export interface AppliedMigration {version:string;filename:string;checksum:Buffer}
export abstract class MigrationsRepository {
 abstract lock():Promise<void>;
 abstract ensureLedger():Promise<void>;
 abstract scripts():Promise<MigrationScript[]>;
 abstract applied():Promise<AppliedMigration[]>;
 abstract checksum(filename:string):Promise<Buffer>;
 abstract apply(filename:string):Promise<void>;
 abstract record(script:MigrationScript,duration:number):Promise<void>;
 abstract rollback(migration:AppliedMigration):Promise<void>;
 abstract grantApplication(role:string):Promise<void>;
}
