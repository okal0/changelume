import { createHash } from 'node:crypto';
import { lstatSync, realpathSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { z } from 'zod';
import type { Edit } from './models.js';
export const hash = (value:string|Buffer) => createHash('sha256').update(value).digest('hex');
export const editSchema = z.object({path:z.string(),beforeHash:z.string().regex(/^[a-f0-9]{64}$/),content:z.string().max(200000)}).strict();
export const outputSchema = z.object({edits:z.array(editSchema).max(30)}).strict();
export function contained(root:string,path:string):string {
  if (!path || path.includes('\\') || isAbsolute(path) || path.split('/').some(p=>p==='..'||p===''||p==='.') || /[:\x00-\x1f]/.test(path)) throw new Error('Unsafe path');
  const canonical=realpathSync(root), target=resolve(canonical,path);
  const rel=relative(canonical,target);
  if (rel.startsWith('..'+sep)||isAbsolute(rel)) throw new Error('Path escapes repository');
  let part=canonical;
  for(const segment of path.split('/')) {part=resolve(part,segment);if(existsSync(part)&&lstatSync(part).isSymbolicLink()) throw new Error('Symlink paths are not allowed');}
  return target;
}
export function validateEdits(root:string,raw:unknown,allowed:string[],baseline=false,manifests=false):Edit[] {
  const {edits}=outputSchema.parse(raw); let bytes=0; const seen=new Set<string>();
  for(const e of edits) {
    if(seen.has(e.path)) throw new Error('Duplicate edit'); seen.add(e.path);
    if(!allowed.includes(e.path) || (e.path!=='changelume.lock.json'||!baseline) && !(manifests&&['package.json','package-lock.json'].includes(e.path)) && (!/\.(tsx?|py)$/.test(e.path)||e.path.startsWith('.')||e.path.split('/').some(p=>['node_modules','.github','.git'].includes(p))||/(^|\/)(vitest|vite|webpack|eslint|next)\.config\./.test(e.path))) throw new Error('Edit outside permitted source paths');
    const file=contained(root,e.path); const before=existsSync(file)?readFileSync(file):Buffer.alloc(0);
    if(before.length>200000||hash(before)!==e.beforeHash) throw new Error('Edit does not match expected revision');
    bytes+=before.length+Buffer.byteLength(e.content); if(bytes>1000000) throw new Error('Patch size limit exceeded');
  }
  return edits;
}
