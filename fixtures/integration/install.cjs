const {spawnSync} = require('node:child_process');
const path = require('node:path');
// Invoke npm's JS entry point to avoid Windows shell/.cmd execution.
const npm = process.env.npm_execpath?.includes('npm-cli') ? process.env.npm_execpath : path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const fs = require('node:fs');
const alternatives=[process.argv[2],npm,path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(process.execPath),'../node_modules/npm/bin/npm-cli.js')].filter(Boolean);
const cli=alternatives.find(p=>fs.existsSync(p));
if(!cli) throw new Error('npm CLI not found next to Node. Install a standard Node.js 24 distribution.');
const result=spawnSync(process.execPath,[cli,'ci','--ignore-scripts','--no-audit','--no-fund'],{stdio:'inherit'});
process.exit(result.status??1);
