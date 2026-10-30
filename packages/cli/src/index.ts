#!/usr/bin/env node
import {discoverProjects} from '../../core/src/projects.js';
import {adapters} from '../../core/src/languages/index.js';
import {saveProposal,refreshProposal} from '../../core/src/proposal.js';
import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { loadConfig, exampleConfig, configSchema } from '../../core/src/config.js';
import { plan, candidate, applyCandidate, saveReport, publicPlan, markdown } from '../../core/src/pipeline.js';
import { contextFor, assistedEdits, OpenAIProvider } from '../../core/src/llm/provider.js';
import { hash, contained } from '../../core/src/safety.js';
import { publish } from '../../core/src/github/publish.js';
import { assertClean } from '../../core/src/git.js';
import {git} from '../../core/src/git.js';
import {reviewQueue,acknowledge} from '../../core/src/review.js';
import {redactDiagnostics} from '../../core/src/diagnostics.js';

const cli=new Command().name('changelume').description('Local, evidence-backed Stripe migration MVP').version('0.5.0-rc.1');
for(const name of ['languages','discover','init','doctor','proposal','review','scan','plan','migrate']) {
  const command=cli.command(name).option('--cwd <path>','Customer repository',process.cwd()).option('--config <path>','Configuration file','changelume.yml').option('--json','Machine-readable output').option('--offline','Use bundled official historical snapshot');
  if(name==='init')command.option('--workspace','Discover multiple project units').option('--language <name>','Select a language for a single project');
  if(name==='plan'||name==='migrate') command.option('--inspect-llm-context','Print exact selected context without sending');
  if(name==='proposal')command.option('--refresh-pr','Refresh recorded PR state from GitHub');
  if(name==='review') command.option('--acknowledge <id>','Record human acknowledgement, separate from migration acceptance').option('--note <text>','Reason for acknowledgement').option('--pending','Show only pending items').option('--category <name>','supported, unsupported, or manual review');
  if(name==='migrate') command.option('--dry-run','Generate patch without changing customer source').option('--publish-pr','Explicitly publish migration PR').option('--repository <owner/repo>','GitHub repository').option('--llm','Use explicitly configured LLM provider').option('--context-hash <sha256>','Hash of inspected context');
  command.action(async options=>{
    const root=resolve(options.cwd);
    if(name==='languages'){console.log(JSON.stringify(Object.keys(adapters).map(language=>({language,capabilities:adapters[language]!.capabilities,capability:['typescript','javascript','python'].includes(language)?'documented recipe migrations':'dependency inventory and lexical reference review'})),null,2));return;}
    if(name==='discover'){console.log(JSON.stringify(discoverProjects(root),null,2));return;}
    if(name==='init') {const target=contained(root,options.config);if(existsSync(target)) throw new Error('Configuration already exists');if(options.workspace&&options.language)throw new Error('Choose --workspace or --language');const selected=options.language?configSchema.parse({language:options.language}):undefined;writeFileSync(target,options.workspace?'projects: auto\n# Run changelume discover, then configure trusted verification per edited project.\n':selected?`language: ${selected.language}\ninclude: ${JSON.stringify(selected.include)}\nverification: []\n`:exampleConfig);console.log(options.json?JSON.stringify({created:target}):`Created ${target}. Commit it before migrating.`);return;}
    const config=loadConfig(root,options.config), p=await plan(root,config,options.offline);
    if(name==='proposal'){saveReport(root,p);console.log(JSON.stringify(options.refreshPr?await refreshProposal(root):saveProposal(root,p),null,2));return;}
    if(name==='doctor'){const checks={node:process.version,git:git(root,'--version'),revision:p.revision,projects:p.projects?.map(unit=>({path:unit.path,language:unit.language,sdkVersion:unit.inventory.resolved??'unknown',limitations:unit.inventory.limitations,verificationCommands:unit.verificationCount})),language:config.language,lockfile:existsSync(resolve(root,config.language==='python'?'requirements.txt':'package-lock.json')),verificationCommands:config.verification.length,moduleMode:p.inventory.moduleMode,limitations:p.inventory.limitations};console.log(JSON.stringify(checks,null,2));return;}
    if(name==='review'){if(options.acknowledge){if(!options.note)throw new Error('--note is required for acknowledgement');acknowledge(root,p,options.acknowledge,options.note);}if(options.category&&!['supported','unsupported','manual review'].includes(options.category))throw new Error('Unknown review category');const queue=reviewQueue(root,p).filter(i=>(!options.pending||!i.acknowledged)&&(!options.category||i.category===options.category));console.log(options.json?JSON.stringify(queue,null,2):queue.map(i=>`${i.acknowledged?'[reviewed]':'[pending]'} ${i.id} | ${i.category}\n${i.summary}`).join('\n\n'));return;}
    if(options.inspectLlmContext) {const context=contextFor(root,p);console.log(JSON.stringify({sha256:hash(context),context:JSON.parse(context)},null,2));return;}
    if(name!=='migrate') {saveReport(root,p);console.log(options.json?JSON.stringify(publicPlan(p),null,2):markdown(p));return;}
    if(options.dryRun&&options.publishPr) throw new Error('--dry-run cannot publish a PR');
    assertClean(root);
    if(options.llm) {if(config.projects)throw new Error('Multi-project migrations require deterministic edits');if(config.upgrade)throw new Error('Upgrade plans require deterministic edits');if(config.language!=='typescript')throw new Error('LLM assistance is limited to single-project TypeScript recipes');if(!config.llm?.enabled||!options.contextHash) throw new Error('LLM requires enabled configuration, model, and inspected --context-hash');p.edits=await assistedEdits(root,p,new OpenAIProvider(config.llm),options.contextHash);}
    const b=candidate(root,p);
    if(b.verification.status==='failed'||config.upgrade&&b.verification.status!=='passed') {process.exitCode=1;console.log(options.json?JSON.stringify({plan:publicPlan(p),verification:b.verification}):markdown(p,b.verification));return;}
    let pr:unknown;
    if(options.publishPr) {const repository=options.repository??process.env.GITHUB_REPOSITORY;if(!repository) throw new Error('--repository owner/repo required');pr=await publish(b,config,repository);saveProposal(root,p,b.verification,pr as {url:string});}
    else if(!options.dryRun) applyCandidate(root,b);
    console.log(options.json?JSON.stringify({plan:publicPlan(p),verification:b.verification,pr},null,2):markdown(p,b.verification)+(pr?JSON.stringify(pr):'\nPatch: .changelume/migration.patch\n'));
  });
}
cli.parseAsync().catch(error=>{console.error('Changelume: '+redactDiagnostics(error instanceof Error?error.message:'Operation failed'));process.exitCode=1;});
