'use strict';
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const {createRequire} = require('node:module');

async function transfer(input, sdk) {
  if (!/^https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/?$/.test(input.endpoint)
      || !input.bucket || !Array.isArray(input.objects) || input.objects.length > 3) throw Error('INPUT');
  const client = new sdk.S3Client({region:'auto', endpoint:input.endpoint, maxAttempts:2,
    credentials:{accessKeyId:input.accessKeyId, secretAccessKey:input.secretAccessKey}});
  const send = command => client.send(command, {abortSignal:AbortSignal.timeout(15000)});
  const verified = [];
  try {
    for (const object of input.objects) {
      if (!/^metrics\/\d{4}\/\d{2}\/\d{2}\/production-\d{8}T\d{6}Z-[a-f0-9]{8}\.jsonl$/.test(object.key)) throw Error('KEY');
      const body = Buffer.from(object.body, 'base64');
      const hash = createHash('sha256').update(body).digest('hex');
      if (body.length < 1 || body.length > 1048576 || hash !== object.sha256) throw Error('HASH');
      try {
        await send(new sdk.PutObjectCommand({Bucket:input.bucket, Key:object.key, Body:body,
          ContentType:'application/x-ndjson', IfNoneMatch:'*', Metadata:{sha256:hash}}));
      } catch (error) {
        // A prior attempt may have completed PUT but lost the response. Verify its bytes.
        if (error?.$metadata?.httpStatusCode !== 412) throw error;
      }
      const response = await send(new sdk.GetObjectCommand({Bucket:input.bucket, Key:object.key}));
      const remote = createHash('sha256'); let bytes = 0;
      for await (const chunk of response.Body) {
        bytes += chunk.length;
        if (bytes > body.length) throw Error('REMOTE_SIZE');
        remote.update(chunk);
      }
      if (bytes !== body.length || remote.digest('hex') !== hash) throw Error('REMOTE_HASH');
      verified.push({key:object.key, bytes, sha256:hash});
    }
    return {state:'VERIFIED', objects:verified};
  } finally { client.destroy(); }
}

module.exports = {transfer};
if (require.main === module) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  transfer(input, createRequire('/app/package.json')('@aws-sdk/client-s3'))
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error('METRICS_UPLOAD_FAILED'); process.exitCode = 1; });
}
