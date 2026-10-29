import { Octokit } from '@octokit/rest';
import type { Bundle } from '../models.js';
import type { Config } from '../config.js';
import { markdown } from '../pipeline.js';
import { hash } from '../safety.js';

export type GitHubClient=Pick<Octokit,'rest'>;
export async function publish(b:Bundle,config:Config,repository:string,client:GitHubClient=new Octokit({auth:process.env.GITHUB_TOKEN})) {
  if(b.verification.status==='failed') throw new Error('Cannot publish failed verification');
  if(!b.edits.length) throw new Error('No migration edits to publish');
  const [owner,repo,...rest]=repository.split('/');if(!owner||!repo||rest.length||!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Expected owner/repository');
  const branch=`changelume/${b.plan.id}/${b.revision.slice(0,12)}`;
  const expectedMarker=`Changelume ${b.plan.id} ${b.revision} ${hash(JSON.stringify(b.edits))}`;
  const prs=await client.rest.pulls.list({owner,repo,head:`${owner}:${branch}`,state:'all',per_page:100});
  const existing=prs.data[0];
  // Never force-update an existing migration branch, even if a human has edited it.
  if(existing) {if(existing.state==='closed'&&!existing.merged_at)throw new Error('Migration PR was closed without merging; inspect it before restarting this revision');return {url:existing.html_url,reused:true};}
  let existingSha:string|undefined;
  try {existingSha=(await client.rest.git.getRef({owner,repo,ref:`heads/${branch}`})).data.object.sha;}
  catch(error) {if((error as {status?:number}).status!==404) throw error;}
  const base=await client.rest.repos.getCommit({owner,repo,ref:config.pr.base});
  if(base.data.sha!==b.revision) throw new Error('Default/base branch moved since analysis; rerun migration');
  const tree=await client.rest.git.createTree({owner,repo,base_tree:base.data.commit.tree.sha,tree:b.edits.map(e=>({path:e.path,mode:'100644' as const,type:'blob' as const,content:e.content}))});
  if(existingSha) {
    const commit=(await client.rest.git.getCommit({owner,repo,commit_sha:existingSha})).data;
    if(commit.message!==expectedMarker||commit.tree.sha!==tree.data.sha||commit.parents.length!==1||commit.parents[0]?.sha!==b.revision) throw new Error('Migration branch contains unexpected or human changes; inspect it manually');
    const latest=await client.rest.git.getRef({owner,repo,ref:`heads/${branch}`});
    if(latest.data.object.sha!==existingSha) throw new Error('Migration branch changed during publication');
  } else {
    const commit=await client.rest.git.createCommit({owner,repo,message:expectedMarker,tree:tree.data.sha,parents:[b.revision]});
    await client.rest.git.createRef({owner,repo,ref:`refs/heads/${branch}`,sha:commit.data.sha});
  }
  const pr=await client.rest.pulls.create({owner,repo,head:branch,base:config.pr.base,title:'Migrate supported Stripe usages',body:markdown(b.plan,b.verification),draft:config.pr.draft||b.verification.status!=='passed'});
  return {url:pr.data.html_url,reused:false};
}
