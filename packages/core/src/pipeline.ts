import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import type { Config } from './config.js';
import type { Plan, Bundle, Verification } from './models.js';
import pythonSnapshot from '../../../fixtures/sources/stripe-python-v5-changelog.md';
import {reviewQueue} from './review.js';
import {collectSDKSource} from './vendors/stripe/ecosystem-sources.js';
import {projectConfigs} from './projects.js';
import {saveProposal} from './proposal.js';
import {upgradeEdits} from './upgrade.js';
import { adapters } from './languages/index.js';
import { collectSources, CHANGE_ID } from './vendors/stripe/sources.js';
import { hash, contained, validateEdits } from './safety.js';
import { git, revision, assertClean } from './git.js';
import { assertNoCredentials } from './llm/provider.js';
import { redactDiagnostics } from './diagnostics.js';

export const baselineSchema=z.object({schemaVersion:z.literal(1),accepted:z.array(z.string()),sources:z.array(z.object({url:z.string().url(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})),observedReleases:z.array(z.string())}).strict();
export function baseline(root:string) {const path=contained(root,'changelume.lock.json');return existsSync(path)?baselineSchema.parse(JSON.parse(readFileSync(path,'utf8'))):{schemaVersion:1 as const,accepted:[],sources:[],observedReleases:[]};}
export async function plan(root:string,config:Config,offline=false,stateRoot=root):Promise<Plan> {
  if(config.projects){const units=projectConfigs(root,config);if(!units.length)throw new Error('No recognized project manifests found');const plans:Plan[]=[];for(const unit of units){const childRoot=unit.path==='.'?root:contained(root,unit.path);plans.push(await plan(childRoot,unit.config,offline,root));}
   const prefix=(path:string,file:string)=>path==='.'?file:path+'/'+file;const first=plans[0]!;
   const projects=units.map((unit,index)=>({path:unit.path,language:unit.language,inventory:plans[index]!.inventory,upgrade:plans[index]!.upgrade,verificationCount:plans[index]!.verification.length,editedFiles:plans[index]!.edits.map(e=>prefix(unit.path,e.path)),evidence:plans[index]!.evidence,observedReleases:plans[index]!.observedReleases,newlyObserved:plans[index]!.newlyObserved}));
   const edits=plans.flatMap((p,index)=>p.edits.map(e=>({...e,path:prefix(units[index]!.path,e.path)})));if(new Set(edits.map(e=>process.platform==='win32'?e.path.toLowerCase():e.path)).size!==edits.length)throw new Error('Overlapping project edits; select one adapter or upgrade per file');
   const usages=plans.flatMap((p,index)=>p.inventory.usages.map(u=>({...u,file:prefix(units[index]!.path,u.file)})));
   const findings=plans.flatMap((p,index)=>p.findings.map(f=>({...f,location:f.location?{...f.location,file:prefix(units[index]!.path,f.location.file)}:undefined})));
   const evidence=[...new Map(plans.flatMap(p=>p.evidence).map(e=>[e.url+e.sha256,e])).values()];
   return {...first,revision:revision(root),id:'stripe-multi-project-v1',upgrade:undefined,projects,inventory:{vendor:'stripe',sdkPackage:'stripe (multiple ecosystems)',versionOrigin:'per-project inventory',webhookVersion:'per-project review required',usages,limitations:projects.flatMap(p=>p.inventory.limitations.map(l=>p.path+' ['+p.language+']: '+l))},findings,edits,evidence,observedReleases:[...new Set(plans.flatMap((p,index)=>p.observedReleases.map(r=>(['typescript','javascript'].includes(units[index]!.language)?'node':units[index]!.language)+':'+r)))],newlyObserved:[...new Set(plans.flatMap((p,index)=>p.newlyObserved.map(r=>(['typescript','javascript'].includes(units[index]!.language)?'node':units[index]!.language)+':'+r)))],unclassified:plans.flatMap((p,index)=>p.unclassified.map(s=>units[index]!.path+' ['+units[index]!.language+']: '+s)),verification:plans.flatMap((p,index)=>p.verification.map(c=>({...c,cwd:units[index]!.path==='.'?c.cwd:c.cwd&&c.cwd!=='.'?prefix(units[index]!.path,c.cwd):units[index]!.path}))),manualSteps:['Review each project capability and unresolved finding. Automatic edits are limited to documented recipes.','Configure verification explicitly for every edited project; discovery never executes suggested commands.','Node evidence applies to JavaScript/TypeScript recipes; Python has separate historical evidence. Other SDK release feeds provide observations for manual review, not migration evidence.']};
  }
  const dependencyEdits=upgradeEdits(root,config);
  const accepted=baseline(stateRoot), {inventory,edits}=adapters[config.language]!.analyze(root,config.upgrade?{...config,vendors:{stripe:{...config.vendors.stripe,sdkVersion:config.upgrade.to}}}:config);
  edits.push(...dependencyEdits);
  const sources=!['typescript','javascript'].includes(config.language)?{evidence:[] as Plan['evidence'],releases:[] as string[],newlyObserved:[] as string[],unclassified:[] as string[]}:await collectSources(stateRoot,offline,config);
  if(config.language==='python') {sources.evidence=[{url:'https://raw.githubusercontent.com/stripe/stripe-python/v5.0.0/CHANGELOG.md',sha256:hash(pythonSnapshot),origin:'offline snapshot',release:'5.0.0'}];sources.unclassified=['Python preview classifies only the two OAuth exception spelling corrections; all other changes require manual review.'];sources.releases=[];sources.newlyObserved=[];}
  if(!['typescript','javascript'].includes(config.language)){const sdk=await collectSDKSource(stateRoot,config.language,offline,config);sources.evidence.push(...sdk.evidence);sources.releases=sdk.releases;sources.newlyObserved=sdk.newlyObserved;sources.unclassified.push(...sdk.unclassified);}
  inventory.language=config.language;
  if(!['typescript','javascript','python'].includes(config.language)&&!inventory.usages.some(u=>u.changeId))sources.unclassified.unshift(config.language+': no matching versioned recipe was found; review official SDK changes manually.');
  const major=Number(inventory.resolved?.split('.')[0]);
  const findings:Plan['findings']=inventory.usages.filter(u=>u.kind==='field'&&u.replacement&&!u.changeId).map(u=>({changeId:CHANGE_ID,location:{file:u.file,line:u.line,symbol:u.symbol},outcome:major===12&&inventory.moduleMode==='esm'?'confirmed impact':major===11||major===12?'possible impact':'unsupported analysis',explanation:major===12?`Stripe 12 ESM removed this constructor alias; CommonJS retains it. Detected module mode: ${inventory.moduleMode}. The source cleanup is compatible with either build; review module-mode evidence.`:major===11?'Stripe 11 still supports this alias; removing it prepares this usage for v12 ESM. No dependency upgrade is performed.':'Recipe applicability cannot be established outside resolved SDK majors 11 and 12.'}));
  for(const u of inventory.usages.filter(u=>u.changeId)) findings.push({changeId:u.changeId!,location:{file:u.file,line:u.line,symbol:u.symbol},outcome:u.kind==='unsupported'?'unsupported analysis':major>=11||config.language==='python'&&major===5?'confirmed impact':'possible impact',explanation:u.kind==='unsupported'?'Recipe preconditions are not satisfied; manual review required.':u.sourceUrl?`The supported ${config.language} recipe changes ${u.symbol} to ${u.replacement}. No SDK upgrade is performed. Official changelog: ${u.sourceUrl}`:u.changeId!.startsWith('stripe-python')?'Stripe Python 5 corrected the OAuth exception spelling. No SDK upgrade is performed.':u.changeId!.includes('setter')?'Stripe Node 11 removed configuration setters; move the adjacent literal option into construction.':'Stripe Node removed a legacy identifier; apply the documented source rename.'});
  for(const u of inventory.usages.filter(u=>u.kind==='unsupported'&&!u.changeId)) findings.push({changeId:['typescript','javascript'].includes(config.language)?CHANGE_ID:config.language+'-stripe-review',location:{file:u.file,line:u.line,symbol:u.symbol},outcome:'unsupported analysis',explanation:u.symbol});
  for(const u of inventory.usages.filter(u=>u.kind==='client'&&u.requestApiVersion==='unknown')) findings.push({changeId:'stripe-node-12-api-default',location:{file:u.file,line:u.line,symbol:u.symbol},outcome:'possible impact',explanation:'Request API version is unknown; SDK, account and webhook versions are independent.'});
  if(!findings.length) findings.push({changeId:config.language+'-stripe-review',outcome:['typescript','javascript','python'].includes(config.language)?'no detected impact within supported analysis':'unsupported analysis',explanation:['typescript','javascript','python'].includes(config.language)?'No documented obsolete patterns found within this adapter; overall compatibility remains unverified.':'Dependency inventory only; semantic impact and migration require manual review.'});
  return {upgrade:config.upgrade,id:!['typescript','javascript','python'].includes(config.language)?config.language+'-stripe-review':config.upgrade?`stripe-node-upgrade-${config.upgrade.from}-to-${config.upgrade.to}`:config.language==='python'?'stripe-python-5-oauth-exceptions':inventory.usages.some(u=>u.changeId)?'stripe-supported-recipes-v1':CHANGE_ID,revision:revision(root),inventory,evidence:sources.evidence,observedReleases:sources.releases,newlyObserved:sources.newlyObserved,unclassified:sources.unclassified,findings,edits,preconditions:['Clean Git working tree for migration','Selected language adapter and recipe-specific import/usage pattern','Recipe-specific SDK versions and unambiguous package resolution; see preview support matrix','Expected file hashes and canonical source paths match'],manualSteps:[...(config.upgrade?[`SDK upgrade ${config.upgrade.from} -> ${config.upgrade.to}; configured installation and behavioral verification must pass.`]:[]),'Review Stripe API compatibility and webhook endpoint versions separately.',config.upgrade?'Review remaining v12 changes before accepting the upgrade.':'No SDK upgrade is performed.','Review unclassified release changes; accepting this recipe does not accept them.'],verification:config.verification,acceptedBaseline:accepted,llm:{used:false}};
}
export function verify(root:string,commands:Config['verification']):Verification {
  const results:Verification['results']=[];
  for(const c of commands) {
    const env:NodeJS.ProcessEnv={};for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','PATHEXT']) if(process.env[key]) env[key]=process.env[key];
    const result=spawnSync(c.command,c.args,{cwd:c.cwd&&c.cwd!=='.'?contained(root,c.cwd):root,env,timeout:c.timeoutMs,encoding:'utf8',maxBuffer:65536,stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true});
    const sanitize=redactDiagnostics;
    const stdout=result.stdout??'', stderr=result.stderr??'';
    const errorCode=(result.error as NodeJS.ErrnoException|undefined)?.code;
    results.push({cwd:c.cwd,command:sanitize([c.command,...c.args].join(' ')),exitCode:result.error?null:result.status,timedOut:errorCode==='ETIMEDOUT',stdout:sanitize(stdout),stderr:sanitize(stderr+(result.error?'\nVerification process error: '+errorCode:'')),outputTruncated:stdout.length>16384||stderr.length>16384||errorCode==='ENOBUFS'});
    if(result.status!==0) break;
  }
  return {status:results.length===0?'skipped':results.every(r=>r.exitCode===0)?'passed':'failed',results};
}
export function markdown(p:Plan,verification:Verification={status:'skipped',results:[]}):string {
  const projectSummary=p.projects?'\n## Project units\n'+p.projects.map(unit=>`- ${unit.path}: ${unit.language}; ${unit.inventory.sdkPackage}; declared ${unit.inventory.declared??'unknown'}, resolved ${unit.inventory.resolved??'unknown'}; ${unit.verificationCount} verification commands`).join('\n')+'\n':'';
  return `# Changelume migration report\n\nRevision: ${p.revision}\n${projectSummary}\nRecipe: ${p.id}\n\nSDK declared: ${p.inventory.declared??'unknown'}; resolved: ${p.inventory.resolved??'unknown'} (${p.inventory.versionOrigin}).\nWebhook: ${p.inventory.webhookVersion}\n\n## Findings\n${p.findings.map(f=>`- **${f.outcome}** ${f.location?`${f.location.file}:${f.location.line} (${f.location.symbol})`:''}: ${f.explanation}`).join('\n')}\n\n## Source evidence\n${p.evidence.map(e=>`- ${e.url} — SHA-256 ${e.sha256} (${e.origin})`).join('\n')}\n\n## Proposed files\n${p.edits.map(e=>'- '+e.path).join('\n')||'No reliable patch available.'}\n\n## Verification\n${verification.status==='passed'?'Configured checks passed.':verification.status==='failed'?'Verification failed. Do not publish as ready for review.':'Verification skipped; no checks passed claim.'}\n${verification.results.map(r=>`- ${r.cwd?`[${r.cwd}] `:''}${r.command}: exit ${r.exitCode}, timed out ${r.timedOut}`).join('\n')}\n\n## Limits and manual steps\n${[...p.inventory.limitations,...p.manualSteps,...p.unclassified].map(x=>'- '+x).join('\n')}\n\nLLM used: ${p.llm.used}\n`;
}
export function publicPlan(p:Plan) {return {...p,edits:p.edits.map(e=>({path:e.path,beforeHash:e.beforeHash,afterHash:hash(e.content)}))};}
export function saveReport(root:string,p:Plan,verification:Verification={status:'skipped',results:[]}) {
  const dir=contained(root,'.changelume');mkdirSync(dir,{recursive:true});
  persistQueue(root,p);saveProposal(root,p,verification);
  writeFileSync(contained(root,'.changelume/report.json'),JSON.stringify({plan:publicPlan(p),verification},null,2)+'\n');
  const diagnostics=verification.results.map((r,i)=>`\n### Command ${i+1} diagnostics${r.outputTruncated?' (truncated)':''}\n\n`+[r.stdout,r.stderr].filter(Boolean).join('\n').split('\n').map(line=>'    '+line).join('\n')).join('\n');
  writeFileSync(contained(root,'.changelume/report.md'),markdown(p,verification)+(diagnostics?'\n## Verification output\n'+diagnostics+'\n':''));
}
export function candidate(root:string,p:Plan,runVerification=true,cleanup=(path:string)=>rmSync(path,{recursive:true,force:true})):Bundle {
  if(runVerification)assertVerificationCoverage(p);
  if(p.upgrade&&runVerification&&!p.verification.length)throw new Error('SDK upgrades require configured installation and behavioral verification');
  assertClean(root); if(revision(root)!==p.revision) throw new Error('Repository revision changed');
  validateEdits(root,{edits:p.edits},p.edits.map(e=>e.path),false,Boolean(p.upgrade||p.projects?.some(unit=>unit.upgrade)));
  for(const e of p.edits) if(!git(root,'ls-files','--stage','--',e.path).startsWith('100644 ')) throw new Error('Migration only edits regular tracked source files');
  const edits=[...p.edits];
  for(const e of edits) assertNoCredentials(e.content);
  if(edits.length) {
    const previous=baseline(root), path=contained(root,'changelume.lock.json');
    const next={schemaVersion:1,accepted:[...new Set([...previous.accepted,...p.inventory.usages.filter(u=>u.editPlanned&&p.edits.some(e=>e.path===u.file)).map(u=>u.changeId??CHANGE_ID),p.id])],sources:p.evidence.filter(e=>e.origin==='offline snapshot').map(({url,sha256})=>({url,sha256})),observedReleases:previous.observedReleases};
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
  } finally {try {cleanup(temp);}catch {p.manualSteps.push(`Temporary checkout cleanup failed: remove ${temp} after inspecting the preserved report and patch.`);}}
  const bundle:Bundle={schemaVersion:1,revision:p.revision,plan:p,edits,patchHash:hash(patch),verification};
  mkdirSync(contained(root,'.changelume'),{recursive:true});
  writeFileSync(contained(root,'.changelume/migration.patch'),patch);
  writeFileSync(contained(root,'.changelume/bundle.json'),JSON.stringify(bundle,null,2)+'\n');saveReport(root,p,verification);
  return bundle;
}
export function applyCandidate(root:string,b:Bundle,replace:typeof renameSync=renameSync) {
  assertClean(root);if(revision(root)!==b.revision) throw new Error('Repository revision changed');
  if(b.verification.status==='failed') throw new Error('Verification failed; patch and report preserved, source not changed');
  validateEdits(root,{edits:b.edits},[...b.plan.edits.map(e=>e.path),'changelume.lock.json'],true,Boolean(b.plan.upgrade||b.plan.projects?.some(unit=>unit.upgrade)));
  const recovery=contained(root,`.changelume/recovery/${randomUUID()}`);mkdirSync(recovery,{recursive:true});
  const originals=b.edits.map((e,i)=>{const path=contained(root,e.path), existed=existsSync(path);if(existed) writeFileSync(resolve(recovery,`${i}.original`),readFileSync(path));writeFileSync(resolve(recovery,`${i}.candidate`),e.content);return {path:e.path,existed};});
  writeFileSync(resolve(recovery,'manifest.json'),JSON.stringify({revision:b.revision,originals},null,2));
  const applied:number[]=[];
  try {
    for(const [i,e] of b.edits.entries()) {replace(resolve(recovery,`${i}.candidate`),contained(root,e.path));applied.push(i);}
  } catch {
    let restored=true;
    for(const i of applied.reverse()) {try {const original=originals[i]!;const path=contained(root,original.path);if(original.existed) writeFileSync(path,readFileSync(resolve(recovery,`${i}.original`)));else rmSync(path);}catch {restored=false;}}
    throw new Error(`Migration application failed; ${restored?'original files restored':'rollback incomplete'}. Recovery copies and manifest: ${recovery}. Report and patch preserved.`);
  }
  try {rmSync(recovery,{recursive:true,force:true});}catch {/* Successful application; recovery copies remain available. */}
}

function persistQueue(root:string,p:Plan){
 const path=contained(root,'.changelume/monitor/queue.json');mkdirSync(dirname(path),{recursive:true});
 let previous:Record<string,{firstSeen:string}>={};try{previous=JSON.parse(readFileSync(path,'utf8')).history??{};}catch{/* Cache is disposable. */}
 const now=new Date().toISOString();const items=reviewQueue(root,p).map(item=>({...item,firstSeen:previous[item.id]?.firstSeen??now,lastSeen:now}));
 const history={...previous,...Object.fromEntries(items.map(item=>[item.id,{firstSeen:item.firstSeen}]))};
 writeFileSync(path,JSON.stringify({schemaVersion:1,revision:p.revision,items,history},null,2)+'\n');
 writeFileSync(contained(root,'.changelume/queue.json'),JSON.stringify({schemaVersion:1,revision:p.revision,items},null,2)+'\n');
}

export function assertVerificationCoverage(p:Plan){for(const unit of p.projects??[]){const affected=unit.editedFiles?unit.editedFiles.length>0:p.edits.some(e=>unit.path==='.'?!p.projects!.some(other=>other.path!=='.'&&e.path.startsWith(other.path+'/')):e.path.startsWith(unit.path+'/'));if(affected&&!unit.verificationCount)throw new Error('Configure trusted verification commands for edited project '+unit.path+' ['+unit.language+'] before migration');}}
