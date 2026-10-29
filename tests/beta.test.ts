import {it,expect,afterEach} from 'vitest';
import {mkdtempSync,cpSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {analyze} from '../packages/core/src/languages/typescript/analyze.js';
import {loadConfig} from '../packages/core/src/config.js';
import {plan,baseline} from '../packages/core/src/pipeline.js';
import {reviewQueue,acknowledge} from '../packages/core/src/review.js';
import {git} from '../packages/core/src/git.js';
import {publish,type GitHubClient} from '../packages/core/src/github/publish.js';
import {candidate} from '../packages/core/src/pipeline.js';
const roots:string[]=[];function fixture(source:string){const root=mkdtempSync(resolve(tmpdir(),'changelume-beta-'));roots.push(root);cpSync('fixtures/before',root,{recursive:true});writeFileSync(resolve(root,'src/index.ts'),source);git(root,'init','-b','main');git(root,'add','.');git(root,'-c','user.name=Beta','-c','user.email=beta@example.invalid','commit','-m','fixture');return root;}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
it.each([['api_key','apiKey'],['idempotency_key','idempotencyKey'],['stripe_account','stripeAccount'],['stripe_version','apiVersion'],['stripeVersion','apiVersion']])('renames supported request option %s', (old,next)=>{
 const root=fixture(`import S from 'stripe'; const s=new S(process.env.KEY!); s.customers.create({}, {${old}: process.env.VALUE});`);const config=loadConfig(root);const result=analyze(root,config);expect(result.edits[0]?.content).toContain(`${next}: process.env.VALUE`);writeFileSync(resolve(root,'src/index.ts'),result.edits[0]!.content);expect(analyze(root,config).edits).toEqual([]);
});
it.each(["{...options, stripe_version: value}","{stripe_version: value, apiVersion: other}","{['stripe_version']: value}"])('declines ambiguous options %s',options=>{const root=fixture(`import S from 'stripe'; const s=new S(process.env.KEY!); s.customers.create({}, ${options});`);expect(analyze(root,loadConfig(root)).edits).toEqual([]);});
it('acknowledges evidence separately and invalidates review when evidence changes',async()=>{const root=fixture("import S from 'stripe'; const s=new S.Stripe(process.env.KEY!);");const p=await plan(root,loadConfig(root),true);const item=reviewQueue(root,p)[0]!;acknowledge(root,p,item.id,'Reviewed manually');expect(reviewQueue(root,p)[0]?.acknowledged).toBe(true);expect(baseline(root).accepted).toEqual([]);p.evidence[0]!.sha256='changed';expect(reviewQueue(root,p)[0]?.acknowledged).toBe(false);expect(readFileSync(resolve(root,'changelume.review.json'),'utf8')).toContain('Reviewed manually');});
it('does not treat a closed unmerged migration PR as successful publication',async()=>{const root=fixture("import S from 'stripe'; const s=new S.Stripe(process.env.KEY!);");const config=loadConfig(root),b=candidate(root,await plan(root,config,true),false);const client={rest:{pulls:{list:async()=>({data:[{state:'closed',merged_at:null}]})}}} as unknown as GitHubClient;await expect(publish(b,config,'test/repo',client)).rejects.toThrow('closed without merging');});
it('traces exported clients and simple factories across files for manual review',()=>{const root=fixture("import S from 'stripe'; export const client=new S(process.env.KEY!); export function make(){return new S(process.env.KEY!);}");writeFileSync(resolve(root,'src/route.ts'),"import {client as payments, make} from './index.js'; const created=make(); payments.customers.retrieve('cus_example'); created.charges.list(); const other={customers:{retrieve(){}}}; other.customers.retrieve();");const result=analyze(root,loadConfig(root));expect(result.inventory.usages.filter(u=>u.symbol.startsWith('Traced cross-file Stripe client:'))).toHaveLength(2);expect(result.edits).toEqual([]);});
it('declines constructor edits when another source file mutates Stripe',()=>{const root=fixture("import S from 'stripe'; const s=new S.Stripe(process.env.KEY!);");writeFileSync(resolve(root,'src/mutation.ts'),"import Other from 'stripe'; Other.Stripe=Custom;");expect(analyze(root,loadConfig(root)).edits).toEqual([]);});
