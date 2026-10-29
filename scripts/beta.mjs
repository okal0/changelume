import {mkdtempSync,mkdirSync,cpSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
mkdirSync('.demo',{recursive:true});const cohort=mkdtempSync(resolve('.demo/beta-'));const cli=resolve(process.env.CHANGELUME_BETA_CLI??'dist/cli.cjs');
const cases=[
 {name:'esm-alias',source:"import S from 'stripe'; const s=new S.Stripe(process.env.KEY!);",expected:1},
 {name:'commonjs-direct',source:"import S from 'stripe'; const s=new S(process.env.KEY!);",expected:0},
 {name:'legacy-options',source:"import S from 'stripe'; const s=new S(process.env.KEY!); s.customers.create({}, {stripe_account: process.env.ACCOUNT});",expected:1},
 {name:'mutated-constructor',source:"import S from 'stripe'; S.Stripe=Custom; const s=new S.Stripe(process.env.KEY!);",expected:0},
 {name:'ambiguous-options',source:"import S from 'stripe'; const s=new S(process.env.KEY!); s.customers.create({}, {...opts, stripe_version: version});",expected:0},
 {name:'named-import',source:"import {Stripe as S} from 'stripe'; const s=new S.Stripe(process.env.KEY!);",expected:1}
];
const results=[];for(const entry of cases){const root=resolve(cohort,entry.name);cpSync('fixtures/before',root,{recursive:true});writeFileSync(resolve(root,'src/index.ts'),entry.source);if(entry.name==='esm-alias'){const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));pkg.type='module';writeFileSync(resolve(root,'package.json'),JSON.stringify(pkg));}
 const expected=entry.expected?entry.source.replace('new S.Stripe(', 'new S(').replace('stripe_account:', 'stripeAccount:'):entry.source;
 writeFileSync(resolve(root,'beta-verify.cjs'),`require('node:assert/strict').equal(require('node:fs').readFileSync('src/index.ts','utf8'),${JSON.stringify(expected)});`);
 writeFileSync(resolve(root,'changelume.yml'),"include: ['src/**/*.ts']\nverification:\n  - command: node\n    args: [beta-verify.cjs]\n");
 function run(command,args){const r=spawnSync(command,args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout;}
 run('git',['init','-b','main']);run('git',['add','.']);run('git',['-c','user.name=Beta','-c','user.email=beta@example.invalid','commit','-m','controlled fixture']);
 const p=JSON.parse(run(process.execPath,[cli,'plan','--cwd',root,'--offline','--json']));const passed=p.edits.length===entry.expected;if(!passed)throw new Error('Controlled beta regression: '+entry.name);
 const dry=JSON.parse(run(process.execPath,[cli,'migrate','--cwd',root,'--offline','--dry-run','--json']));if(readFileSync(resolve(root,'src/index.ts'),'utf8')!==entry.source)throw new Error('Dry-run modified source');
 run(process.execPath,[cli,'migrate','--cwd',root,'--offline','--json']);if(readFileSync(resolve(root,'src/index.ts'),'utf8')!==expected)throw new Error('Incorrect applied source');
 run('git',['add','.']);run('git',['-c','user.name=Beta','-c','user.email=beta@example.invalid','commit','--allow-empty','-m','Accept controlled migration']);
 const second=JSON.parse(run(process.execPath,[cli,'plan','--cwd',root,'--offline','--json']));if(second.edits.length)throw new Error('Second plan is not idempotent');
 results.push({repository:entry.name,expectedEditedFiles:entry.expected,proposedEditedFiles:p.edits.length,unsupportedFindings:p.findings.filter(f=>f.outcome==='unsupported analysis').length,verification:dry.verification.status,dryRunPreservedSource:true,appliedSourceCorrect:true,secondPlanEdits:second.edits.length,passed});
}writeFileSync(resolve(cohort,'results.json'),JSON.stringify({kind:'controlled synthetic evaluation',independentParticipants:0,results},null,2));console.log('Controlled beta passed: '+resolve(cohort,'results.json'));
