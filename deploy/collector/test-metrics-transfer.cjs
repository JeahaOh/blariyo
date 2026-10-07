const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {transfer} = require('./metrics-transfer.cjs');
const body = Buffer.from('{"timestamp":"fixture"}\n');
const input = {endpoint:'https://abcdef.r2.cloudflarestorage.com',bucket:'private-fixture',accessKeyId:'fixture',secretAccessKey:'fixture',
  objects:[{key:'metrics/2026/10/07/production-20261007T120000Z-12345678.jsonl',body:body.toString('base64'),sha256:createHash('sha256').update(body).digest('hex')}]};
function sdk(mode) {
  class PutObjectCommand {constructor(input){this.input=input;}}
  class GetObjectCommand {constructor(input){this.input=input;}}
  class S3Client {
    async send(command) {
      if(command instanceof PutObjectCommand) {
        assert.equal(command.input.IfNoneMatch,'*');
        if(mode==='retry'||mode==='conflict')throw {$metadata:{httpStatusCode:412}};
        if(mode==='denied')throw {$metadata:{httpStatusCode:403}};
        return {};
      }
      return {Body:[mode==='conflict'?Buffer.from('different'):body]};
    }
    destroy() {}
  }
  return {S3Client,PutObjectCommand,GetObjectCommand};
}
test('new upload and identical retry require remote body hash verification', async()=>{
  for(const mode of ['new','retry'])assert.equal((await transfer(input,sdk(mode))).state,'VERIFIED');
});
test('existing different object and denied upload are failures', async()=>{
  for(const mode of ['conflict','denied'])await assert.rejects(transfer(input,sdk(mode)));
});
test('objects outside the metrics namespace cannot be written', async()=>{
  await assert.rejects(transfer({...input,objects:[{...input.objects[0],key:'collect/raw.json'}]},sdk('new')));
});
