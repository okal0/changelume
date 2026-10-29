import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
mkdirSync('.demo',{recursive:true});
const root=mkdtempSync(resolve('.demo/integration-'));
cpSync('fixtures/integration',root,{recursive:true,filter:p=>!p.split(/[\\/]/).includes('node_modules')});
const npmCli=process.env.CHANGELUME_NPM_CLI;
if(npmCli) {const config=resolve(root,'changelume.yml');writeFileSync(config,readFileSync(config,'utf8').replace('args: [install.cjs]',`args: [install.cjs, ${JSON.stringify(npmCli)}]`));}
function run(command,args,expected=0) {const r=spawnSync(command,args,{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_TOKEN:undefined,OPENAI_API_KEY:undefined}});if(r.status!==expected) throw new Error(`${command} ${args.join(' ')} failed (${r.status}): ${r.stdout}\n${r.stderr}`);return r.stdout;}
run('git',['init','-b','main']);run('git',['add','.']);run('git',['-c','user.name=Integration','-c','user.email=integration@example.invalid','commit','-m','Real SDK fixture']);
run(process.execPath,['install.cjs',...(npmCli?[npmCli]:[])]);
// Historical declarations still accept the obsolete ESM runtime alias.
run(process.execPath,['typecheck.cjs']);
run(process.execPath,['before.cjs']);
const cli=resolve('dist/cli.cjs');
const before=readFileSync(resolve(root,'src/index.ts'),'utf8');
run(process.execPath,[cli,'migrate','--cwd',root,'--offline','--dry-run']);
if(readFileSync(resolve(root,'src/index.ts'),'utf8')!==before) throw new Error('Dry-run modified source');
run(process.execPath,[cli,'migrate','--cwd',root,'--offline']);
run(process.execPath,['typecheck.cjs']);run(process.execPath,['verify.cjs']);
run('git',['add','src/index.ts','changelume.lock.json']);run('git',['-c','user.name=Integration','-c','user.email=integration@example.invalid','commit','-m','Accept migration']);
const second=JSON.parse(run(process.execPath,[cli,'plan','--cwd',root,'--offline','--json']));
if(second.edits.length) throw new Error('Recipe is not idempotent');
writeFileSync(resolve(root,'integration-result.json'),JSON.stringify({versions:['11.18.0','12.0.0'],module:'ESM + NodeNext; CommonJS separately checked',beforeTypecheck:'passed: historical declaration/runtime mismatch',afterTypecheck:'passed',runtime:'ESM failure reproduced and repair passed without vendor requests',dryRun:'source preserved',secondPlanEdits:second.edits.length},null,2));
console.log('Real-SDK integration passed. Evidence: '+root);
