import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve, parse } from 'node:path';
mkdirSync('dist',{recursive:true});
const results=[];
for(const [entry,outfile] of [['packages/cli/src/index.ts','dist/cli.cjs'],['packages/core/src/action.ts','dist/action.cjs']]) {
  results.push(await build({entryPoints:[entry],outfile,bundle:true,platform:'node',target:'node24',format:'cjs',loader:{'.md':'text'},legalComments:'external',metafile:true}));
  // pnpm shortens long virtual-store names on Windows. Normalize only generated path comments.
  writeFileSync(outfile,readFileSync(outfile,'utf8').replace(/^\/\/ node_modules\/\.pnpm\/[^/]+\/node_modules\//gm,'// node_modules/'));
}
const notices=new Map();
for(const input of results.flatMap(r=>Object.keys(r.metafile.inputs))) {
  if(!input.includes('node_modules/')) continue;
  let directory=dirname(resolve(input));
  while(directory!==parse(directory).root) {
    const manifest=resolve(directory,'package.json');
    if(existsSync(manifest)) {
      const pkg=JSON.parse(readFileSync(manifest,'utf8'));
      if(pkg.name&&pkg.version) {
        const key=pkg.name+'@'+pkg.version;
        if(!notices.has(key)) {
          const licenses=readdirSync(directory).filter(n=>/^(licen[sc]e|notice|copyright)(\.|$)/i.test(n)).sort();
          notices.set(key,`${key}\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license)}\n\n${licenses.map(n=>readFileSync(resolve(directory,n),'utf8')).join('\n')}`);
        }
        break;
      }
    }
    directory=dirname(directory);
  }
}
writeFileSync('dist/THIRD-PARTY-NOTICES.txt',('Bundled runtime dependency notices\n\n'+[...notices].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,text])=>text).join('\n\n---\n\n')).replaceAll('\r\n','\n'));
