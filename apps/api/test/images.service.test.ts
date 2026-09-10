import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ImagesService } from '../dist/features/images/images.service.js';
import { imageRepository, objectStorage, outboxRepository, immediateWork as work } from './doubles.js';
import type { OutboxMessage } from '../dist/operations/outbox.repository.js';
import type { Bucket } from '../dist/shared/storage.js';
await test('image validation fails before storage; failed DB persistence compensates attempted objects',async()=>{
 const calls: [string, Bucket, string, Buffer?][] = [], outbox: OutboxMessage[] = [];
 const repository=imageRepository({async create(){throw new Error('db unavailable');}});
 const storage=objectStorage({async put(...args){calls.push(['put',...args]);},async delete(...args){calls.push(['delete',...args]);throw new Error('storage unavailable');}});
 const service=new ImagesService(repository,storage,work,outboxRepository({async enqueue(message){outbox.push(message);}}));
 await assert.rejects(service.upload([{bytes:Buffer.from('broken'),mime:'image/png'}],'actor'),{status:415});
 assert.equal(calls.length,0);
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'blue'}}).png().toBuffer();
 await assert.rejects(service.upload([{bytes,mime:'image/png'}],'actor'),{status:503,code:'DEPENDENCY_UNAVAILABLE'});
 assert.ok(calls[0] && calls[1] && outbox[0]);
 assert.equal(calls[0][0],'put');assert.equal(calls[1][0],'delete');assert.equal(calls[0][2],calls[1][2]);
 assert.equal(outbox[0].payload.privateStorageKey,calls[0][2]);assert.equal(outbox[0].payload.cleanupReason,'UPLOAD_ROLLBACK');
 assert.equal(outbox[0].aggregateType,'STORAGE_OBJECT');assert.equal(outbox[0].aggregateId,null);
});
await test('discard refuses attached images before changing state or scheduling deletion',async()=>{
 let mutation=false;
 const service=new ImagesService(imageRepository({async find(){return {id:'1',postId:'2',status:'STAGED',privateKey:'staging/fixture',publicKey:null,hash:Buffer.alloc(32),mime:'image/png',byteSize:1,width:1,height:1};},async markPrivateDelete(){mutation=true;}}),objectStorage(),work,outboxRepository({async enqueue(){mutation=true;}}));
 await assert.rejects(service.discard('1','actor'),{code:'IMAGE_STATE_CONFLICT'});
 assert.equal(mutation,false);
});
