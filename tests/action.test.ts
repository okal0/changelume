import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { git } from '../packages/core/src/git.js';
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)) rmSync(root,{recursive:true,force:true});});
function setup(){const root=mkdtempSync(resolve(tmpdir(),'changelume-action-'));roots.push(root);cpSync('fixtures/before',root,{recursive:true});git(root,'init','-b','main');git(root,'add','.');git(root,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','fixture');return root;}
function invoke(root:string,inputs:Record<string,string>) {
  const output=resolve(tmpdir(),`changelume-output-${crypto.randomUUID()}`);
  const result=spawnSync(process.execPath,[resolve('dist/action.cjs')],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_OUTPUT:output,INPUT_CWD:root,...Object.fromEntries(Object.entries(inputs).map(([k,v])=>['INPUT_'+k.toUpperCase(),v]))}});
  let values:Record<string,string>={};try {values=Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').filter(Boolean).map(line=>line.split('=')));}catch{}finally{rmSync(output,{force:true});}
  return {status:result.status,values,stderr:result.stderr};
}
it('bundled Action generates a revision-bound candidate and verifies it without credentials',()=>{
  const root=setup(),analysis=invoke(root,{stage:'analyze',offline:'true'});expect(analysis.status,analysis.stderr).toBe(0);expect(analysis.values['has-edits']).toBe('true');
  const result=invoke(root,{stage:'verify',revision:analysis.values.revision!,'bundle-hash':analysis.values['bundle-hash']!,'patch-hash':analysis.values['patch-hash']!});expect(result.status,result.stderr).toBe(0);expect(result.values.verification).toBe('passed');
});
it('bundled Action rejects tampered artifacts before application',()=>{
  const root=setup(),analysis=invoke(root,{stage:'analyze',offline:'true'});expect(analysis.status).toBe(0);
  writeFileSync(resolve(root,'.changelume/migration.patch'),'tampered');
  const result=invoke(root,{stage:'verify',revision:analysis.values.revision!,'bundle-hash':analysis.values['bundle-hash']!,'patch-hash':analysis.values['patch-hash']!});expect(result.status).toBe(1);expect(result.stderr).toContain('Patch integrity mismatch');expect(readFileSync(resolve(root,'src/index.ts'),'utf8')).toContain('new Payments.Stripe(');
});

it('bundled Action verifies the eight edited project commands in their project directories',()=>{const root=mkdtempSync(resolve(tmpdir(),'changelume-polyglot-action-'));roots.push(root);cpSync('fixtures/polyglot',root,{recursive:true});const path=resolve(root,'changelume.yml'),config=JSON.parse(readFileSync(path,'utf8'));config.pythonCommand=process.env.CHANGELUME_PYTHON??'python';for(const unit of config.projects)for(const command of unit.verification??[])command.command=process.execPath;writeFileSync(path,JSON.stringify(config));git(root,'init','-b','main');git(root,'add','.');git(root,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','fixture');const analysis=invoke(root,{stage:'analyze',offline:'true'});expect(analysis.status,analysis.stderr).toBe(0);const result=invoke(root,{stage:'verify',revision:analysis.values.revision!,'bundle-hash':analysis.values['bundle-hash']!,'patch-hash':analysis.values['patch-hash']!});expect(result.status,result.stderr).toBe(0);expect(result.values.verification).toBe('passed');const report=JSON.parse(readFileSync(resolve(root,'.changelume/report.json'),'utf8'));expect(report.verification.results).toHaveLength(8);});
