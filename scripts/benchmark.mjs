import {mkdtempSync,mkdirSync,cpSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';
mkdirSync('.demo',{recursive:true});const cohort=mkdtempSync(resolve('.demo/benchmark-'));const cli=resolve(process.env.CHANGELUME_BETA_CLI??'dist/cli.cjs');
const prefix="import S from 'stripe'; const s=new S(process.env.KEY!);";
const cases=[
 {name:'alias',source:"import S from 'stripe'; const s=new S.Stripe(process.env.KEY!);",after:"import S from 'stripe'; const s=new S(process.env.KEY!);",impacted:1},
 ...[['setTimeout','timeout','250'],['setMaxNetworkRetries','maxNetworkRetries','2'],['setTelemetryEnabled','telemetry','false']].map(([method,key,value])=>({name:method,source:prefix+`s.${method}(${value});`,after:`import S from 'stripe'; const s=new S(process.env.KEY!, {${key}: ${value}});`,impacted:1})),
 {name:'unrelated',source:"const d=new Date('2026-01-01'); const x={setTimeout(){}}; x.setTimeout();",impacted:0},
 {name:'mutated',source:"import S from 'stripe'; S.Stripe=Custom; const s=new S.Stripe(process.env.KEY!);",impacted:1},
 {name:'mixed-versions',source:"import S from 'stripe'; const s=new S.Stripe(process.env.KEY!);",nested:true,impacted:1},
 {name:'shared-client',source:"import S from 'stripe'; export const client=new S(process.env.KEY!);",extra:"import {client} from './index.js'; client.customers.list();",impacted:1},
 {name:'factory',source:"import S from 'stripe'; export function make(){return new S(process.env.KEY!);}",extra:"import {make} from './index.js'; const client=make(); client.customers.list();",impacted:1},
 {name:'nonadjacent-setter',source:prefix+"work();s.setTimeout(250);",impacted:1},
 {name:'python-oauth',python:true,source:'import stripe\ntry:\n    pass\nexcept stripe.oauth_error.UnsupportedGrantTypError:\n    pass\n',after:'import stripe\ntry:\n    pass\nexcept stripe.oauth_error.UnsupportedGrantTypeError:\n    pass\n',impacted:1},
 {name:'python-shadow',python:true,source:'import stripe\ndef f(stripe):\n    return stripe.oauth_error.UnsupportedGrantTypError\n',impacted:1}
];
let incorrectEdits=0,missedUsages=0,unnecessaryWarnings=0;const results=[];
for(const c of cases){const root=resolve(cohort,c.name);cpSync('fixtures/before',root,{recursive:true});const file=c.python?'src/index.py':'src/index.ts';if(c.python){writeFileSync(resolve(root,'src/index.ts'),'');writeFileSync(resolve(root,'requirements.txt'),'stripe==5.0.0\n');}writeFileSync(resolve(root,file),c.source);if(c.extra)writeFileSync(resolve(root,'src/route.ts'),c.extra);if(c.nested){const path=resolve(root,'package-lock.json');const lock=JSON.parse(readFileSync(path,'utf8'));lock.packages['packages/old/node_modules/stripe']={version:'9.0.0'};writeFileSync(path,JSON.stringify(lock));}
 const expected=c.after??c.source;writeFileSync(resolve(root,'verify.cjs'),`require('node:assert/strict').equal(require('node:fs').readFileSync(${JSON.stringify(file)},'utf8'),${JSON.stringify(expected)});`);
 writeFileSync(resolve(root,'changelume.yml'),`${c.python?"language: python\npythonCommand: "+JSON.stringify(process.env.CHANGELUME_PYTHON??'python')+"\n":''}include: ['src/**/*.${c.python?'py':'ts'}']\nverification:\n  - command: node\n    args: [verify.cjs]\n`);
 const run=(command,args)=>{const r=spawnSync(command,args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(c.name+': '+r.stderr+r.stdout);return r.stdout;};run('git',['init','-b','main']);run('git',['add','.']);run('git',['-c','user.name=Benchmark','-c','user.email=benchmark@example.invalid','commit','-m','fixture']);
 const p=JSON.parse(run(process.execPath,[cli,'plan','--cwd',root,'--offline','--json']));const edit=p.edits.find(e=>e.path===file);const correct=Boolean(edit)===Boolean(c.after);if(!correct)incorrectEdits++;
 const warnings=p.findings.filter(f=>f.location&&f.outcome!=='no detected impact within supported analysis');if(c.impacted&&!warnings.length)missedUsages++;if(!c.impacted)unnecessaryWarnings+=warnings.length;
 const dry=JSON.parse(run(process.execPath,[cli,'migrate','--cwd',root,'--offline','--dry-run','--json']));if(readFileSync(resolve(root,file),'utf8')!==c.source)throw new Error('Dry-run mutated source');run(process.execPath,[cli,'migrate','--cwd',root,'--offline','--json']);if(readFileSync(resolve(root,file),'utf8')!==expected)throw new Error('Incorrect source: '+c.name);
 run('git',['add','.']);run('git',['-c','user.name=Benchmark','-c','user.email=benchmark@example.invalid','commit','--allow-empty','-m','accepted']);const second=JSON.parse(run(process.execPath,[cli,'plan','--cwd',root,'--offline','--json']));if(second.edits.length)throw new Error('Not idempotent: '+c.name);
 results.push({name:c.name,expectedEdit:Boolean(c.after),proposedEdit:Boolean(edit),correct,locatedFindings:warnings.length,verification:dry.verification.status});}
const report={schemaVersion:1,kind:'controlled synthetic benchmark',independentParticipants:0,incorrectEdits,missedUsages,unnecessaryWarnings,results};writeFileSync(resolve(cohort,'results.json'),JSON.stringify(report,null,2));mkdirSync('.changelume',{recursive:true});writeFileSync('.changelume/benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(incorrectEdits||unnecessaryWarnings)process.exitCode=1;
