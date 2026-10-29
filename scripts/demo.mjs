import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
mkdirSync('.demo',{recursive:true});
const root=mkdtempSync(resolve('.demo/run-'));
cpSync('fixtures/before',root,{recursive:true});
function run(command,args) {const r=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(r.status!==0) throw new Error(command+' failed');}
run('git',['init','-b','main']);run('git',['add','.']);run('git',['-c','user.name=Demo','-c','user.email=demo@example.invalid','commit','-m','Offline fixture']);
const cli=resolve('dist/cli.cjs');
for(const args of [['scan'],['plan'],['migrate','--dry-run'],['migrate']]) {
  const before=readFileSync(resolve(root,'src/index.ts'),'utf8');
  run(process.execPath,[cli,...args,'--offline','--cwd',root]);
  if(args.includes('--dry-run')&&readFileSync(resolve(root,'src/index.ts'),'utf8')!==before) throw new Error('Dry-run modified source');
}
run(process.execPath,['verify.cjs']);
console.log('Demo repository and reports: '+root);
