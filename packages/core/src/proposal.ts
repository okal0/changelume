import {Octokit} from '@octokit/rest';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {contained,hash} from './safety.js';import {reviewQueue} from './review.js';import type {Plan,Verification} from './models.js';
export function saveProposal(root:string,p:Plan,v:Verification={status:'skipped',results:[]},pr?:{url:string;reused?:boolean}){
 const files=p.edits.map(e=>({path:e.path,beforeHash:e.beforeHash,afterHash:hash(e.content)}));const id=hash(JSON.stringify({language:p.id,upgrade:p.upgrade,files,verification:p.verification}));
 const path=contained(root,'.changelume/proposal.json');let previous:any;try{previous=JSON.parse(readFileSync(existsSync(path)?path:contained(root,'.changelume/monitor/proposal.json'),'utf8'));}catch{/* Disposable state. */}
 const same=previous?.id===id;const queue=reviewQueue(root,p);const current=p.upgrade?(p.inventory.declared===p.upgrade.to?p.upgrade.to:p.upgrade.from):p.inventory.resolved;
 const newer=p.observedReleases.filter(version=>{if(!current)return false;const a=version.split('.').map(Number),b=(current??'0.0.0').split('.').map(Number);return a[0]!>b[0]!||a[0]===b[0]&&a[1]!>b[1]!||a[0]===b[0]&&a[1]===b[1]&&a[2]!>b[2]!;});
 const proposal={schemaVersion:1,id,revision:p.revision,currentVersion:current,targetVersion:p.upgrade?.to,availableUpgrade:current==='11.18.0'?{from:current,to:'12.0.0',configuration:"upgrade: {from: '11.18.0', to: '12.0.0'}",requires:'Review unresolved API changes and configure installation plus behavioral checks'}:null,newerObservedReleases:newer,affected:p.findings.filter(f=>f.location),recipes:[...new Set(p.inventory.usages.filter(u=>u.editPlanned).map(u=>u.changeId??p.id))],files,review:{pending:queue.filter(i=>!i.acknowledged).length,unresolved:p.unclassified},history:[...(previous?.history??[]),...(!same&&previous?.pr?[{id:previous.id,revision:previous.revision,verification:previous.verification,pr:previous.pr}]:[])].slice(-10),verification:v.status==='skipped'&&same&&previous.revision===p.revision?previous.verification:v.status,pr:pr??(same?previous.pr:undefined)};
 mkdirSync(contained(root,'.changelume/monitor'),{recursive:true});writeFileSync(path,JSON.stringify(proposal,null,2)+'\n');writeFileSync(contained(root,'.changelume/monitor/proposal.json'),JSON.stringify(proposal,null,2)+'\n');return proposal;
}

export async function refreshProposal(root:string,client=new Octokit({auth:process.env.GITHUB_TOKEN})){
 const path=contained(root,'.changelume/proposal.json');const proposal=JSON.parse(readFileSync(path,'utf8'));const record=proposal.pr?proposal:proposal.history?.at(-1);if(!record?.pr?.url)throw new Error('No published proposal PR to refresh');
 const url=new URL(record.pr.url);const match=/^\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/.exec(url.pathname);if(url.hostname!=='github.com'||!match)throw new Error('Invalid proposal PR URL');
 const {data}=await client.rest.pulls.get({owner:match[1]!,repo:match[2]!,pull_number:Number(match[3])});record.pr={...record.pr,state:data.merged?'merged':data.state,draft:data.draft,head:data.head.sha};writeFileSync(path,JSON.stringify(proposal,null,2)+'\n');mkdirSync(contained(root,'.changelume/monitor'),{recursive:true});writeFileSync(contained(root,'.changelume/monitor/proposal.json'),JSON.stringify(proposal,null,2)+'\n');return proposal;
}
