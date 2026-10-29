import {it,expect,afterEach,vi} from 'vitest';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {collectSources} from '../packages/core/src/vendors/stripe/sources.js';
import {configSchema,loadConfig} from '../packages/core/src/config.js';
import {plan,candidate,applyCandidate,verify,baseline} from '../packages/core/src/pipeline.js';
import {git} from '../packages/core/src/git.js';
const directories:string[]=[];
function fixture(){const root=mkdtempSync(resolve(tmpdir(),'changelume-hardening-'));directories.push(root);cpSync('fixtures/before',root,{recursive:true});git(root,'init','-b','main');git(root,'add','.');git(root,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','fixture');return root;}
afterEach(()=>{vi.unstubAllEnvs();for(const path of directories.splice(0))rmSync(path,{recursive:true,force:true});});
it('observes new releases once, retains unresolved changes and never accepts them by scanning',async()=>{
  const root=fixture(),config=loadConfig(root),fetcher=vi.fn().mockResolvedValue(new Response('## 12.0.0\n## 23.0.0\n'));
  const first=await collectSources(root,false,config,fetcher);expect(first.newlyObserved).toEqual(['12.0.0','23.0.0']);
  const second=await collectSources(root,false,config,fetcher);expect(second.newlyObserved).toEqual([]);expect(second.unclassified).toContain('Release 23.0.0: observed, changes unclassified (no recipe)');expect(fetcher).toHaveBeenCalledTimes(1);
  const cache=resolve(root,'.changelume/cache/stripe.json');const data=JSON.parse(readFileSync(cache,'utf8'));data.fetchedAt=0;writeFileSync(cache,JSON.stringify(data));
  fetcher.mockResolvedValue(new Response('## 23.1.0\n## 23.0.0\n## 12.0.0\n'));
  expect((await collectSources(root,false,config,fetcher)).newlyObserved).toEqual(['23.1.0']);expect(baseline(root).accepted).toEqual([]);expect(existsSync(resolve(root,'changelume.lock.json'))).toBe(false);
});
it('isolates offline observations and rejects stale cache on fetch failure',async()=>{
  const root=fixture(),config=loadConfig(root),fetcher=vi.fn().mockResolvedValue(new Response('## 12.0.0\n'));
  await collectSources(root,true,config,fetcher);expect(fetcher).not.toHaveBeenCalled();expect((await collectSources(root,false,config,fetcher)).newlyObserved).toEqual(['12.0.0']);
  const cache=resolve(root,'.changelume/cache/stripe.json'),data=JSON.parse(readFileSync(cache,'utf8'));data.fetchedAt=0;writeFileSync(cache,JSON.stringify(data));
  const observations=readFileSync(resolve(root,'.changelume/observations/stripe-online.json'),'utf8');fetcher.mockRejectedValue(new Error('network unavailable'));
  await expect(collectSources(root,false,config,fetcher)).rejects.toThrow('unavailable');expect(readFileSync(resolve(root,'.changelume/observations/stripe-online.json'),'utf8')).toBe(observations);
});
it('disabled vendor never fetches or creates observation state',async()=>{
  const root=fixture(),fetcher=vi.fn();const result=await collectSources(root,false,configSchema.parse({vendors:{stripe:{enabled:false}}}),fetcher);expect(result.releases).toEqual([]);expect(fetcher).not.toHaveBeenCalled();expect(existsSync(resolve(root,'.changelume'))).toBe(false);
});
it.each([['module','esm','confirmed impact'],['commonjs','commonjs','possible impact']])('distinguishes SDK 12 module mode %s',async(type,mode,outcome)=>{
  const root=fixture(),file=resolve(root,'package.json');const pkg=JSON.parse(readFileSync(file,'utf8'));pkg.type=type;writeFileSync(file,JSON.stringify(pkg));
  const p=await plan(root,loadConfig(root),true);expect(p.inventory.moduleMode).toBe(mode);expect(p.findings.some(f=>f.outcome===outcome)).toBe(true);
});
it('changed upstream format preserves the last valid observations',async()=>{
  const root=fixture(),config=loadConfig(root),fetcher=vi.fn().mockResolvedValue(new Response('## 12.0.0\n'));
  await collectSources(root,false,config,fetcher);const observations=resolve(root,'.changelume/observations/stripe-online.json'),previous=readFileSync(observations,'utf8');
  const cache=resolve(root,'.changelume/cache/stripe.json');writeFileSync(cache,'corrupt');fetcher.mockResolvedValue(new Response('<html>new format</html>'));
  await expect(collectSources(root,false,config,fetcher)).rejects.toThrow('format');expect(readFileSync(observations,'utf8')).toBe(previous);
});
it('rolls back an interrupted multi-file application and preserves recovery copies',async()=>{
  const root=fixture(),b=candidate(root,await plan(root,loadConfig(root),true),false),original=readFileSync(resolve(root,'src/index.ts'),'utf8');let count=0;
  expect(()=>applyCandidate(root,b,(from,to)=>{if(++count===2)throw new Error('simulated disk failure');renameSync(from,to);})).toThrow('original files restored');
  expect(readFileSync(resolve(root,'src/index.ts'),'utf8')).toBe(original);expect(existsSync(resolve(root,'changelume.lock.json'))).toBe(false);expect(readdirSync(resolve(root,'.changelume/recovery')).length).toBe(1);expect(existsSync(resolve(root,'.changelume/migration.patch'))).toBe(true);
});
it('preserves patch and useful report when temporary checkout cleanup fails',async()=>{
  const root=fixture();const b=candidate(root,await plan(root,loadConfig(root),true),false,path=>{directories.push(path);throw new Error('locked directory');});
  expect(b.plan.manualSteps.some(s=>s.includes('cleanup failed'))).toBe(true);expect(readFileSync(resolve(root,'.changelume/report.md'),'utf8')).toContain('cleanup failed');expect(readFileSync(resolve(root,'.changelume/migration.patch'),'utf8')).toContain('new Payments(');
});
it('startup errors, timeouts and excessive output can never pass verification',()=>{
  const root=fixture();const missing=verify(root,[{command:'changelume-nonexistent-executable',args:[],timeoutMs:1000}]);expect(missing.status).toBe('failed');expect(missing.results[0]?.stderr).toContain('ENOENT');
  const timeout=verify(root,[{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],timeoutMs:100}]);expect(timeout.status).toBe('failed');expect(timeout.results[0]?.timedOut).toBe(true);
  const oversized=verify(root,[{command:process.execPath,args:['-e',"process.stdout.write('x'.repeat(1000000))"],timeoutMs:10000}]);expect(oversized.status).toBe('failed');expect(oversized.results[0]?.outputTruncated).toBe(true);expect(oversized.results[0]!.stdout!.length).toBeLessThanOrEqual(16384);
});
it('redacts known secret values and removes credentials from child environment',()=>{
  const root=fixture();vi.stubEnv('CHANGELUME_TEST_SECRET','synthetic-sensitive-value');vi.stubEnv('GITHUB_TOKEN','synthetic-publishing-token');
  const result=verify(root,[{command:process.execPath,args:['-e',"console.log('synthetic-sensitive-value');if(process.env.GITHUB_TOKEN || process.env.CHANGELUME_TEST_SECRET)process.exit(1)"],timeoutMs:10000}]);expect(result.status).toBe('passed');expect(JSON.stringify(result)).not.toContain('synthetic-sensitive-value');expect(result.results[0]?.stdout).toContain('[REDACTED]');
});
