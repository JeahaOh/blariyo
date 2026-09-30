import type { components } from '@blariyo/contracts/collection-api';
export type DirectRequest=components['schemas']['DirectCollectionRequest'];
export type RuntimeSource=components['schemas']['DirectRuntimeSource'];
export interface RuntimeIdentity { data:RuntimeSource; parser:string|null; hosts:string[]; registeredEnabled:boolean; version:number }
export interface DirectRecord { data:DirectRequest; canonicalHash:Buffer; postHash:Buffer; normalizationVersion:number; retryUrl:string|null }
export interface DirectInsert { actor:string; key:string; hash:Buffer; source:string; url:string; canonicalHash:Buffer; postHash:Buffer; version:number; previous:string|null; duplicate:boolean }
export abstract class DirectRequestRepository {
 abstract ready():Promise<boolean>;
 abstract sources():Promise<RuntimeIdentity[]>;
 abstract request(id:string):Promise<DirectRecord|null>;
 abstract alias(actor:string,key:string):Promise<{id:string;hash:Buffer}|null>;
 abstract saveAlias(actor:string,key:string,hash:Buffer,id:string):Promise<void>;
 abstract active(source:string,version:number,canonicalHash:Buffer,postHash:Buffer):Promise<string[]>;
 abstract dedup(source:string,version:number,canonicalHash:Buffer,postHash:Buffer):Promise<boolean>;
 abstract insert(value:DirectInsert):Promise<string>;
 abstract rate(actor:string):Promise<void>;
 abstract cleanup():Promise<void>;
}
