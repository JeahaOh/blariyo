#!/usr/bin/env node
'use strict';
// Pipe only; includes configured public contacts, never print to the terminal.
const fs=require('node:fs'),path=require('node:path');
const {prepare,validate}=require('./prepare-public-config.cjs');
const {renderTemplate}=require('./prepare-policy-review.cjs');
async function main(){
 if(process.argv[2]!=='--pipe'||process.stdout.isTTY)throw Error('PIPE_REQUIRED');
 const {config}=prepare();await validate(config);
 const policies=['terms','privacy'].map(type=>({type,version:'v0.1',title:type==='terms'?'이용약관':'개인정보처리방침',body:renderTemplate(fs.readFileSync(path.join(__dirname,'../../docs/legal/m0-core',type+'.html'),'utf8'),config)}));
 for(const p of policies)if(/\[출시 차단|\[입력 필요|{{|href="(?:terms|privacy|rights|cookies)\.html/.test(p.body))throw Error('UNRESOLVED_POLICY');
 process.stdout.write(JSON.stringify({policies}));
}
main().catch(()=>{console.error('POLICY_INPUT_FAILED');process.exitCode=1});
