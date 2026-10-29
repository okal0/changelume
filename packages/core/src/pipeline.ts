import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import type { Config } from './config.js';
import type { Plan, Bundle, Verification } from './models.js';
import { analyze } from './languages/typescript/analyze.js';
import { collectSources, CHANGE_ID } from './vendors/stripe/sources.js';
import { hash, contained, validateEdits } from './safety.js';
import { git, revision, assertClean } from './git.js';
import { assertNoCredentials } from './llm/provider.js';

export const baselineSchema=z.object({schemaVersion:z.literal(1),accepted:z.array(z.string()),sources:z.array(z.object({url:z.string().url(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})),observedReleases:z.array(z.string())}).strict();
export function baseline(root:string) {const path=contained(root,'changelume.lock.json');return existsSync(path)?baselineSchema.parse(JSON.parse(readFileSync(path,'utf8'))):{schemaVersion:1 as const,accepted:[],sources:[],observedReleases:[]};}
export async function plan(root:string,config:Config,offline=false):Promise<Plan> {
  const accepted=baseline(root), {inventory,edits}=analyze(root,config);
  const sources=await collectSources(root,offline,config);
  const major=Number(inventory.resolved?.split('.')[0]);
  const findings:Plan['findings']=inventory.usages.filter(u=>u.kind==='field'&&u.replacement).map(u=>({changeId:CHANGE_ID,location:{file:u.file,line:u.line,symbol:u.symbol},outcome:major===12?'confirmed impact':major===11?'possible impact':'unsupported analysis',explanation:major===12?'Resolved Stripe 12 removed this constructor alias.':major===11?'Stripe 11 still supports this alias; removing it prepares this usage for v12. No dependency upgrade is performed.':'Recipe applicability cannot be established outside resolved SDK majors 11 and 12.'}));
  for(const u of inventory.usages.filter(u=>u.kind==='unsupported')) findings.push({changeId:CHANGE_ID,location:{file:u.file,line:u.line,symbol:u.symbol},outcome:'unsupported analysis',explanation:u.symbol});
  for(const u of inventory.usages.filter(u=>u.kind==='client'&&u.requestApiVersion==='unknown')) findings.push({changeId:'stripe-node-12-api-default',location:{file:u.file,line:u.line,symbol:u.symbol},outcome:'possible impact',explanation:'Request API version is unknown; SDK, account and webhook versions are independent.'});
  if(!findings.length) findings.push({changeId:CHANGE_ID,outcome:'no detected impact within supported analysis',explanation:'No supported obsolete constructor aliases found; this does not establish overall Stripe compatibility.'});
  return {id:CHANGE_ID,revision:revision(root),inventory,evidence:sources.evidence,observedReleases:sources.releases,newlyObserved:sources.releases.filter(r=>!accepted.observedReleases.includes(r)),unclassified:sources.unclassified,findings,edits,preconditions:['Clean Git working tree for migration','Runtime default Stripe import and direct new expression','Resolved SDK major 11 or 12; no ambiguous nested installation','Expected file hashes and canonical source paths match'],manualSteps:['Review Stripe API compatibility and webhook endpoint versions separately.','No SDK upgrade is performed. For Stripe 11, update dependencies and lockfile separately after reviewing all v12 changes.','Review unclassified release changes; accepting this recipe does not accept them.'],verification:config.verification,acceptedBaseline:accepted,llm:{used:false}};
}
export function verify(root:string,commands:Config['verification']):Verification {
  const results:Verification['results']=[];
  for(const c of commands) {
    const env:NodeJS.ProcessEnv={};for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','PATHEXT']) if(process.env[key]) env[key]=process.env[key];
    const result=spawnSync(c.command,c.args,{cwd:root,env,timeout:c.timeoutMs,encoding:'utf8',maxBuffer:65536,stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true});
    const sanitize=(value:string)=>{
      let text=value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/(?:sk|rk)_(?:live|test)_[\w-]+|sk-[\w-]{12,}|gh[pousr]_[\w]+/g,'[REDACTED]').replace(/((?:authorization|api[_-]?key|password|secret|token)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi,'$1[REDACTED]');
      for(const [name,secret] of Object.entries(process.env)) if(secret&&secret.length>=4&&/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)) text=text.split(secret).join('[REDACTED]');
      return text.slice(0,16384);
    };
    const stdout=result.stdout??'', stderr=result.stderr??'';
    const errorCode=(result.error as NodeJS.ErrnoException|undefined)?.code;
    results.push({command:sanitize([c.command,...c.args].join(' ')),exitCode:result.error?null:result.status,timedOut:errorCode==='ETIMEDOUT',stdout:sanitize(stdout),stderr:sanitize(stderr+(result.error?'\nVerification process error: '+errorCode:'')),outputTruncated:stdout.length>16384||stderr.length>16384||errorCode==='ENOBUFS'});
    if(result.status!==0) break;
  }
  return {status:results.length===0?'skipped':results.every(r=>r.exitCode===0)?'passed':'failed',results};
}
export function markdown(p:Plan,verification:Verification={status:'skipped',results:[]}):string {
  return `# Changelume migration report\n\nRevision: ${p.revision}\n\nRecipe: ${p.id}\n\nSDK declared: ${p.inventory.declared??'unknown'}; resolved: ${p.inventory.resolved??'unknown'} (${p.inventory.versionOrigin}).\nWebhook: ${p.inventory.webhookVersion}\n\n## Findings\n${p.findings.map(f=>`- **${f.outcome}** ${f.location?`${f.location.file}:${f.location.line} (${f.location.symbol})`:''}: ${f.explanation}`).join('\n')}\n\n## Source evidence\n${p.evidence.map(e=>`- ${e.url} — SHA-256 ${e.sha256} (${e.origin})`).join('\n')}\n\n## Proposed files\n${p.edits.map(e=>'- '+e.path).join('\n')||'No reliable patch available.'}\n\n## Verification\n${verification.status==='passed'?'Configured checks passed.':verification.status==='failed'?'Verification failed. Do not publish as ready for review.':'Verification skipped; no checks passed claim.'}\n${verification.results.map(r=>`- ${r.command}: exit ${r.exitCode}, timed out ${r.timedOut}`).join('\n')}\n\n## Limits and manual steps\n${[...p.inventory.limitations,...p.manualSteps,...p.unclassified].map(x=>'- '+x).join('\n')}\n\nLLM used: ${p.llm.used}\n`;
}
export function publicPlan(p:Plan) {return {...p,edits:p.edits.map(e=>({path:e.path,beforeHash:e.beforeHash,afterHash:hash(e.content)}))};}
export function saveReport(root:string,p:Plan,verification:Verification={status:'skipped',results:[]}) {
  const dir=contained(root,'.changelume');mkdirSync(dir,{recursive:true});
  writeFileSync(contained(root,'.changelume/report.json'),JSON.stringify({plan:publicPlan(p),verification},null,2)+'\n');
  const diagnostics=verification.results.map((r,i)=>`\n### Command ${i+1} diagnostics${r.outputTruncated?' (truncated)':''}\n\n`+[r.stdout,r.stderr].filter(Boolean).join('\n').split('\n').map(line=>'    '+line).join('\n')).join('\n');
  writeFileSync(contained(root,'.changelume/report.md'),markdown(p,verification)+(diagnostics?'\n## Verification output\n'+diagnostics+'\n':''));
}
export function candidate(root:string,p:Plan,runVerification=true):Bundle {
  assertClean(root); if(revision(root)!==p.revision) throw new Error('Repository revision changed');
  validateEdits(root,{edits:p.edits},p.edits.map(e=>e.path));
  for(const e of p.edits) if(!git(root,'ls-files','--stage','--',e.path).startsWith('100644 ')) throw new Error('Migration only edits regular tracked source files');
  const edits=[...p.edits];
  for(const e of edits) assertNoCredentials(e.content);
  if(edits.length) {
    const previous=baseline(root), path=contained(root,'changelume.lock.json');
    const next={schemaVersion:1,accepted:[...new Set([...previous.accepted,p.id])],sources:p.evidence.filter(e=>e.release==='12.0.0').map(({url,sha256})=>({url,sha256})),observedReleases:previous.observedReleases};
    // Only this recipe is accepted. Observing other releases never accepts them.
    edits.push({path:'changelume.lock.json',beforeHash:hash(existsSync(path)?readFileSync(path):''),content:JSON.stringify(next,null,2)+'\n'});
  }
  const temp=mkdtempSync(resolve(tmpdir(),'changelume-'));
  let patch='', verification:Verification={status:'skipped',results:[]};
  try {
    git(temp,'clone','--quiet','--no-hardlinks','--',root,'candidate'); const checkout=resolve(temp,'candidate');
    git(checkout,'checkout','--quiet','--detach',p.revision);
    for(const e of edits) {const path=contained(checkout,e.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,e.content);}
    if(edits.length) git(checkout,'add','--intent-to-add','--',...edits.map(e=>e.path));
    patch=git(checkout,'diff','--no-ext-diff','--no-textconv','--binary','--unified=0','HEAD')+'\n';
    if(!edits.length) patch='';
    if(runVerification&&edits.length) {
      verification=verify(checkout,p.verification);
      if(git(checkout,'diff','--no-ext-diff','--no-textconv','--binary','--unified=0','HEAD')+'\n'!==patch) verification={status:'failed',results:[...verification.results,{command:'Candidate tracked files unchanged by verification',exitCode:1,timedOut:false}]};
    }
    // Verification can mutate files: its edits never enter the generated patch.
  } finally {rmSync(temp,{recursive:true,force:true});}
  const bundle:Bundle={schemaVersion:1,revision:p.revision,plan:p,edits,patchHash:hash(patch),verification};
  mkdirSync(contained(root,'.changelume'),{recursive:true});
  writeFileSync(contained(root,'.changelume/migration.patch'),patch);
  writeFileSync(contained(root,'.changelume/bundle.json'),JSON.stringify(bundle,null,2)+'\n');saveReport(root,p,verification);
  return bundle;
}
export function applyCandidate(root:string,b:Bundle) {
  assertClean(root);if(revision(root)!==b.revision) throw new Error('Repository revision changed');
  if(b.verification.status==='failed') throw new Error('Verification failed; patch and report preserved, source not changed');
  validateEdits(root,{edits:b.edits},[...b.plan.edits.map(e=>e.path),'changelume.lock.json'],true);
  for(const e of b.edits) writeFileSync(contained(root,e.path),e.content);
}
