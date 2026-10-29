import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { hash, contained } from '../../safety.js';
import type { Config } from '../../config.js';
import type { Evidence } from '../../models.js';
import snapshot from '../../../../../fixtures/sources/stripe-v12-changelog.md';
export const CHANGE_ID='stripe-node-12-constructor-aliases';
export const historicalUrl='https://raw.githubusercontent.com/stripe/stripe-node/v12.0.0/CHANGELOG.md';
export const currentUrl='https://raw.githubusercontent.com/stripe/stripe-node/master/CHANGELOG.md';
const cacheSchema=z.object({url:z.string(),text:z.string().max(2000000),sha256:z.string(),fetchedAt:z.number()});
const observationSchema=z.object({schemaVersion:z.literal(1),releases:z.array(z.string()),sourceHash:z.string(),observedAt:z.number()});
export function releaseHeadings(text:string):string[] {
  const releases=[...new Set([...text.matchAll(/^##\s+(?:<a\s+id="[\w.-]+"><\/a>\s*)?v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)\b/gm)].map(m=>m[1]!))];
  if(!releases.length) throw new Error('Unsupported upstream changelog format');
  return releases;
}
export async function fetchSource(url:string,config:Config['sources'],fetcher:typeof fetch=fetch):Promise<string> {
  for(let attempt=0;attempt<=config.retries;attempt++) {
    try {
      const response=await fetcher(url,{signal:AbortSignal.timeout(config.timeoutMs),redirect:'error'});
      if(!response.ok) throw new Error('Source HTTP '+response.status);
      const reader=response.body?.getReader(); if(!reader) throw new Error('Empty source response');
      const chunks:Uint8Array[]=[];let size=0;
      while(true) {const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>2000000) {await reader.cancel();throw new Error('Source exceeds size limit');}chunks.push(value);}
      return Buffer.concat(chunks).toString('utf8');
    } catch {if(attempt===config.retries) throw new Error('Official source unavailable after bounded attempts; use --offline for the historical snapshot');}
  } throw new Error('Unreachable');
}
export async function collectSources(root:string,offline:boolean,config:Config,fetcher:typeof fetch=fetch) {
  if(!config.vendors.stripe.enabled) return {evidence:[],releases:[],newlyObserved:[],unclassified:[]};
  const evidence:Evidence[]=[{url:historicalUrl,sha256:hash(snapshot),origin:'offline snapshot',release:'12.0.0'}];
  let text=snapshot;
  if(!offline) {
    const path=contained(root,'.changelume/cache/stripe.json');let origin:Evidence['origin']='network';
    if(existsSync(path)) {try {const c=cacheSchema.safeParse(JSON.parse(readFileSync(path,'utf8')));if(c.success&&c.data.url===currentUrl&&hash(c.data.text)===c.data.sha256&&Date.now()-c.data.fetchedAt>=0&&Date.now()-c.data.fetchedAt<3600000) {text=c.data.text;origin='cache';}}catch{/* Disposable corrupt cache: fetch again. */}}
    if(origin==='network') {text=await fetchSource(currentUrl,config.sources,fetcher);releaseHeadings(text);mkdirSync(resolve(root,'.changelume/cache'),{recursive:true});writeFileSync(path,JSON.stringify({url:currentUrl,text,sha256:hash(text),fetchedAt:Date.now()}));}
    evidence.push({url:currentUrl,sha256:hash(text),origin,release:'observed changelog'});
  }
  const releases=releaseHeadings(text);
  const observations=contained(root,`.changelume/observations/stripe-${offline?'offline':'online'}.json`);
  let previous:string[]=[];
  try {previous=observationSchema.parse(JSON.parse(readFileSync(observations,'utf8'))).releases;}catch{/* Disposable missing or invalid observation history. */}
  const newlyObserved=releases.filter(r=>!previous.includes(r));
  mkdirSync(resolve(root,'.changelume/observations'),{recursive:true});
  const temporary=contained(root,`.changelume/observations/stripe-${offline?'offline':'online'}.tmp`);
  writeFileSync(temporary,JSON.stringify({schemaVersion:1,releases,sourceHash:hash(text),observedAt:Date.now()}));
  renameSync(temporary,observations);
  return {evidence,releases,newlyObserved,unclassified: ['Stripe v12 default request API version change requires manual compatibility review.', ...releases.filter(r=>r!=='12.0.0').map(r=>`Release ${r}: observed, changes unclassified (no recipe)`)]};
}
