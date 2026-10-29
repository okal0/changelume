import { execFileSync } from 'node:child_process';
export function git(root:string,...args:string[]):string {
  return execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,encoding:'utf8',maxBuffer:5000000,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_CONFIG_COUNT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'}}).trimEnd();
}
export function revision(root:string) {return git(root,'rev-parse','HEAD');}
export function assertClean(root:string) {
  if(git(root,'ls-files','.changelume')) throw new Error('.changelume must not contain tracked files');
  if(git(root,'status','--porcelain','--untracked-files=all','--','.',':(exclude).changelume')) throw new Error('Dirty working tree: commit or stash changes before migration');
}
