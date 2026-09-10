import { createHash } from 'node:crypto';
import sanitize from 'sanitize-html';
import { canonical } from '../../shared/canonical.js';
function object(value:unknown):Record<string,unknown> {
 if(typeof value!=='object'||value===null||Array.isArray(value))throw new Error('INVALID_POLICY_ARTIFACT');
 return Object.fromEntries(Object.entries(value));
}
export function artifactChecksum(artifact:unknown):string {
 const {checksum:_checksum,...payload}=object(artifact);
 return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}
export function assertLegalConfig(input:unknown):void {
 const config=typeof input==='object'&&input!==null?Object.fromEntries(Object.entries(input)):{};
 for(const key of ['operatorDisplayName','contactEmail','rightsEmail','privacyEmail','privacyOfficer']) {
  const value:unknown=config[key];
  if(typeof value!=='string'||!value.trim()||/미정|입력 필요|출시 차단|\.invalid\b/.test(value))throw new Error('LEGAL_CONFIG_REQUIRED');
  if(key.endsWith('Email')&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('LEGAL_CONFIG_REQUIRED');
 }
}
export interface PolicyOptions {now?:Date;production?:boolean;legalConfig?:unknown;siteOrigin?:string}
export function policyArtifact(input:unknown,options:PolicyOptions={}) {
 const artifact=object(input),now=options.now??new Date();
 const {type,version,title,body}=artifact;
 if((type!=='terms'&&type!=='privacy')||typeof version!=='string'||version.length>20||!version.trim()||
   typeof title!=='string'||!title.trim()||title.length>200||typeof body!=='string'||!body.trim()||body.length>1000000)
  throw new Error('INVALID_POLICY_ARTIFACT');
 if(artifact.checksum!==artifactChecksum(artifact))throw new Error('POLICY_CHECKSUM_MISMATCH');
 const at=artifact.effectiveAt;
 if(typeof at!=='string'&&typeof at!=='number'&&!(at instanceof Date))throw new Error('POLICY_EFFECTIVE_WINDOW');
 const effective=new Date(at);
 if(!Number.isFinite(+effective)||effective>now||+now-+effective>300000)throw new Error('POLICY_EFFECTIVE_WINDOW');
 if(options.production){assertLegalConfig(options.legalConfig);if(/\[입력 필요|\[출시 차단/.test(body))throw new Error('POLICY_PLACEHOLDER');}
 const html=sanitize(body,{allowedTags:['h1','h2','h3','h4','p','ul','ol','li','strong','em','a','table','thead','tbody','tr','th','td','br','blockquote'],
  allowedAttributes:{a:['href','rel']},allowedSchemes:['https','mailto'],allowProtocolRelative:false,
  transformTags:{a:sanitize.simpleTransform('a',{rel:'noopener noreferrer'})}});
 if(!sanitize(html,{allowedTags:[],allowedAttributes:{}}).trim())throw new Error('INVALID_POLICY_ARTIFACT');
 return {type,version,title,bodyHtml:html,effectiveAt:effective};
}
