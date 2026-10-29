import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {z} from 'zod';
import {contained,hash} from './safety.js';
import type {Plan} from './models.js';
const schema=z.object({schemaVersion:z.literal(1),acknowledgements:z.array(z.object({id:z.string(),evidenceHash:z.string(),note:z.string().min(1).max(1000),reviewedAt:z.string()}))}).strict();
export function reviews(root:string){const file=contained(root,'changelume.review.json');try{return existsSync(file)?schema.parse(JSON.parse(readFileSync(file,'utf8'))):{schemaVersion:1 as const,acknowledgements:[]};}catch{throw new Error('Invalid changelume.review.json; restore a valid schema-1 review file before continuing');}}
export function reviewQueue(root:string,p:Plan){const state=reviews(root);return [
  ...p.findings.filter(f=>f.outcome!=='no detected impact within supported analysis').map(f=>({id:`finding-${hash(JSON.stringify(f)).slice(0,16)}`,category:f.outcome==='unsupported analysis'?'unsupported':f.changeId==='stripe-node-12-api-default'?'manual review':'supported',summary:f.explanation,location:f.location})),
  ...p.unclassified.map(summary=>({id:`unclassified-${hash(summary).slice(0,16)}`,category:'manual review',summary,location:undefined}))
].map(item=>{const evidenceHash=hash(JSON.stringify({evidence:p.evidence.map(e=>({url:e.url,sha256:e.sha256})),inventory:p.inventory,files:p.edits.map(e=>({path:e.path,beforeHash:e.beforeHash})),item}));return {...item,evidenceHash,sources:p.evidence.map(e=>({url:e.url,sha256:e.sha256})),sdkVersion:p.inventory.resolved,acknowledged:state.acknowledgements.some(a=>a.id===item.id&&a.evidenceHash===evidenceHash)};});}
export function acknowledge(root:string,p:Plan,id:string,note:string){const item=reviewQueue(root,p).find(i=>i.id===id);if(!item)throw new Error('Unknown review item; run review first');const state=reviews(root);state.acknowledgements=state.acknowledgements.filter(a=>a.id!==id);state.acknowledgements.push({id,evidenceHash:item.evidenceHash,note,reviewedAt:new Date().toISOString()});schema.parse(state);writeFileSync(contained(root,'changelume.review.json'),JSON.stringify(state,null,2)+'\n');}
