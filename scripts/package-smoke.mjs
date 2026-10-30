import {existsSync,mkdtempSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const candidates=[process.env.CHANGELUME_NPM_CLI,resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),resolve(dirname(process.execPath),'../node_modules/npm/bin/npm-cli.js')].filter(Boolean);
const npm=candidates.find(existsSync);if(!npm)throw new Error('Set CHANGELUME_NPM_CLI to npm/bin/npm-cli.js');
function run(command,args,extra={}){const r=spawnSync(command,args,{encoding:'utf8',env:{...process.env,...extra}});if(r.status!==0)throw new Error(r.stdout+'\n'+r.stderr);return r.stdout;}
console.log(run(process.execPath,['scripts/package.mjs'],{CHANGELUME_NPM_CLI:npm}));
const prefix=mkdtempSync(resolve('.demo/package-install-'));const archive=resolve('.demo/release-candidate/changelume-0.5.0-rc.1.tgz');
run(process.execPath,[npm,'install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund',archive]);
const root=[resolve(prefix,'node_modules/changelume'),resolve(prefix,'lib/node_modules/changelume')].find(existsSync);if(!root)throw new Error('Installed package missing');
const cli=resolve(root,'dist/cli.cjs');if(run(process.execPath,[cli,'--version']).trim()!=='0.5.0-rc.1')throw new Error('Incorrect installed version');
if(!existsSync(resolve(root,'examples/stripe/package-lock.json')))throw new Error('Complete example missing');
console.log(run(process.execPath,['scripts/beta.mjs'],{CHANGELUME_BETA_CLI:cli}));
console.log(run(process.execPath,['scripts/benchmark.mjs'],{CHANGELUME_BETA_CLI:cli}));
console.log(run(process.execPath,['scripts/polyglot.mjs'],{CHANGELUME_BETA_CLI:cli}));
console.log('Clean-prefix package installation and standalone fixture evaluation passed.');
