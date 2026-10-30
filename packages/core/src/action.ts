import {saveProposal} from './proposal.js';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { plan, candidate, applyCandidate, verify, saveReport, assertVerificationCoverage } from './pipeline.js';
import { hash, contained } from './safety.js';
import { publish } from './github/publish.js';
import { revision, assertClean, git } from './git.js';
import {reviewQueue} from './review.js';
import { redactDiagnostics } from './diagnostics.js';
const input=(key:string)=>process.env['INPUT_'+key.toUpperCase().replaceAll('-','_')]??process.env['INPUT_'+key.toUpperCase()]??'';
function output(key:string,value:string) {if(process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);}
async function main() {
  const stage=z.enum(['analyze','verify','publish']).parse(input('stage')||'analyze');
  const root=resolve(input('cwd')||process.env.GITHUB_WORKSPACE||'.');
  const config=loadConfig(root,input('config')||'changelume.yml');
  assertClean(root);
  if(stage==='analyze') {
    const p=await plan(root,config,input('offline')==='true');const b=candidate(root,p,false);
    if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Changelume: ${p.newlyObserved.length} newly observed releases; ${reviewQueue(root,p).filter(i=>!i.acknowledged).length} pending review items; ${p.edits.length} proposed files. Download changelume-candidate for queue.json and report.md.\n`);
    output('revision',b.revision);output('patch-hash',b.patchHash);output('bundle-hash',hash(readFileSync(contained(root,'.changelume/bundle.json'))));output('has-edits',String(b.edits.length>0));return;
  }
  const data=readFileSync(contained(root,'.changelume/bundle.json'));
  if(data.length>2000000||hash(data)!==input('bundle-hash')) throw new Error('Artifact digest does not match trusted analysis job output');
  const raw:unknown=JSON.parse(data.toString('utf8'));
  const envelope=z.object({schemaVersion:z.literal(1),revision:z.string().regex(/^[a-f0-9]{40}$/),patchHash:z.string().regex(/^[a-f0-9]{64}$/),edits:z.array(z.unknown())}).parse(raw);
  if(envelope.revision!==revision(root)||envelope.revision!==input('revision')) throw new Error('Artifact analyzed revision mismatch');
  if(envelope.patchHash!==input('patch-hash')||hash(readFileSync(contained(root,'.changelume/migration.patch')))!==envelope.patchHash) throw new Error('Patch integrity mismatch');
  // Regenerate using trusted implementation and checked-out configuration. Never apply downloaded patch text.
  const p=await plan(root,config,true), expected=candidate(root,p,false);
  if(JSON.stringify(envelope.edits)!==JSON.stringify(expected.edits)||envelope.patchHash!==expected.patchHash) throw new Error('Artifact exceeds deterministic recipe scope');
  assertVerificationCoverage(p);
  if(stage==='verify') {
    applyCandidate(root,expected);const trackedBefore=git(root,'diff','--no-ext-diff','--no-textconv','--binary','HEAD');const result=verify(root,p.verification);
    if(git(root,'diff','--no-ext-diff','--no-textconv','--binary','HEAD')!==trackedBefore)result.status='failed';
    if(expected.edits.some(e=>readFileSync(contained(root,e.path),'utf8')!==e.content)) result.status='failed';
    saveReport(root,p,result);
    output('verification',result.status);output('verified-patch-hash',expected.patchHash);
    if(result.status==='failed') throw new Error('Candidate verification failed');return;
  }
  if(input('publish-pr')!=='true') throw new Error('Publishing requires explicit publish-pr input');
  if(input('verification')!=='passed'||input('verified-patch-hash')!==expected.patchHash) throw new Error('Publication requires passed verification tied to this patch');
  expected.verification={status:'passed',results:p.verification.map(c=>({cwd:c.cwd,command:[c.command,...c.args].join(' '),exitCode:0,timedOut:false}))};
  if(!p.verification.length) throw new Error('No configured verification');
  const pr=await publish(expected,config,process.env.GITHUB_REPOSITORY??'');saveProposal(root,p,expected.verification,pr);output('pr-url',pr.url);
}
main().catch(error=>{console.error('Changelume Action failed: '+redactDiagnostics(error instanceof Error?error.message:'Unknown failure').slice(0,2048));console.error('Inspect the analysis/verification artifacts; confirm revision, digests, configuration, and repository permissions before retrying.');process.exitCode=1;});
