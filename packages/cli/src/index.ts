#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { loadConfig, exampleConfig } from '../../core/src/config.js';
import { plan, candidate, applyCandidate, saveReport, publicPlan, markdown } from '../../core/src/pipeline.js';
import { contextFor, assistedEdits, OpenAIProvider } from '../../core/src/llm/provider.js';
import { hash, contained } from '../../core/src/safety.js';
import { publish } from '../../core/src/github/publish.js';
import { assertClean } from '../../core/src/git.js';

const cli=new Command().name('changelume').description('Local, evidence-backed Stripe migration MVP').version('0.1.0');
for(const name of ['init','scan','plan','migrate']) {
  const command=cli.command(name).option('--cwd <path>','Customer repository',process.cwd()).option('--config <path>','Configuration file','changelume.yml').option('--json','Machine-readable output').option('--offline','Use bundled official historical snapshot');
  if(name==='plan'||name==='migrate') command.option('--inspect-llm-context','Print exact selected context without sending');
  if(name==='migrate') command.option('--dry-run','Generate patch without changing customer source').option('--publish-pr','Explicitly publish migration PR').option('--repository <owner/repo>','GitHub repository').option('--llm','Use explicitly configured LLM provider').option('--context-hash <sha256>','Hash of inspected context');
  command.action(async options=>{
    const root=resolve(options.cwd);
    if(name==='init') {const target=contained(root,options.config);if(existsSync(target)) throw new Error('Configuration already exists');writeFileSync(target,exampleConfig);console.log(options.json?JSON.stringify({created:target}):`Created ${target}. Commit it before migrating.`);return;}
    const config=loadConfig(root,options.config), p=await plan(root,config,options.offline);
    if(options.inspectLlmContext) {const context=contextFor(root,p);console.log(JSON.stringify({sha256:hash(context),context:JSON.parse(context)},null,2));return;}
    if(name!=='migrate') {saveReport(root,p);console.log(options.json?JSON.stringify(publicPlan(p),null,2):markdown(p));return;}
    if(options.dryRun&&options.publishPr) throw new Error('--dry-run cannot publish a PR');
    assertClean(root);
    if(options.llm) {if(!config.llm?.enabled||!options.contextHash) throw new Error('LLM requires enabled configuration, model, and inspected --context-hash');p.edits=await assistedEdits(root,p,new OpenAIProvider(config.llm),options.contextHash);}
    const b=candidate(root,p);
    if(b.verification.status==='failed') {process.exitCode=1;console.log(options.json?JSON.stringify({plan:publicPlan(p),verification:b.verification}):markdown(p,b.verification));return;}
    let pr:unknown;
    if(options.publishPr) {const repository=options.repository??process.env.GITHUB_REPOSITORY;if(!repository) throw new Error('--repository owner/repo required');pr=await publish(b,config,repository);}
    else if(!options.dryRun) applyCandidate(root,b);
    console.log(options.json?JSON.stringify({plan:publicPlan(p),verification:b.verification,pr},null,2):markdown(p,b.verification)+(pr?JSON.stringify(pr):'\nPatch: .changelume/migration.patch\n'));
  });
}
cli.parseAsync().catch(error=>{console.error('Changelume: '+(error instanceof Error?error.message:'Operation failed'));process.exitCode=1;});
