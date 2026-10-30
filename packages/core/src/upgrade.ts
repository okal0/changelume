import {readFileSync} from 'node:fs';
import {contained,hash} from './safety.js';
import type {Config} from './config.js';
import type {Edit} from './models.js';
const targetEntry={"version": "12.0.0", "resolved": "https://registry.npmjs.org/stripe/-/stripe-12.0.0.tgz", "integrity": "sha512-9zdcWApF4Yg2WG4GVv1qnvAv+h5KD103gKwbTsTyk5G3lf9h4vN0FXGQ5d5eWKP9itAjt0D5gZtWG7cLPzyLxw==", "license": "MIT", "dependencies": {"@types/node": ">=8.1.0", "qs": "^6.11.0"}, "engines": {"node": ">=12.*"}};
export function upgradeEdits(root:string,config:Config):Edit[]{
 if(!config.upgrade)return [];if(!config.vendors.stripe.enabled)throw new Error('Enable Stripe before requesting an upgrade');const {from,to}=config.upgrade;
 if(!['typescript','javascript'].includes(config.language)||from!=='11.18.0'||to!=='12.0.0')throw new Error('Supported upgrade: Node SDK Stripe 11.18.0 -> 12.0.0 only; other transitions require manual planning');
 const manifestText=readFileSync(contained(root,'package.json'),'utf8'),lockText=readFileSync(contained(root,'package-lock.json'),'utf8');const manifest=JSON.parse(manifestText),lock=JSON.parse(lockText);
 const group=manifest.dependencies?.stripe?'dependencies':'devDependencies';
 if(manifest[group]?.stripe===to&&lock.packages?.['node_modules/stripe']?.version===to&&lock.packages?.['']?.[group]?.stripe===to)return [];
 if(manifest[group]?.stripe!==from||lock.lockfileVersion!==3||lock.packages?.['node_modules/stripe']?.version!==from||lock.packages?.['']?.[group]?.stripe!==from)throw new Error('Upgrade requires matching exact manifest and npm v3 lockfile versions');
 if(Object.keys(lock.packages).some(k=>k.endsWith('/node_modules/stripe')&&k!=='node_modules/stripe')||manifest.workspaces)throw new Error('Upgrade does not support workspaces or nested Stripe installations');
 const dependencies=lock.packages['node_modules/stripe'].dependencies;
 if(JSON.stringify(Object.entries(dependencies??{}).sort())!==JSON.stringify(Object.entries(targetEntry.dependencies).sort()))throw new Error('SDK dependency graph differs; regenerate the lockfile manually');
 for(const name of Object.keys(targetEntry.dependencies))if(!lock.packages['node_modules/'+name])throw new Error('Incomplete lockfile dependency graph');
 manifest[group].stripe=to;lock.packages[''][group].stripe=to;lock.packages['node_modules/stripe']=targetEntry;
 return [{path:'package.json',beforeHash:hash(manifestText),content:JSON.stringify(manifest,null,2)+'\n'},{path:'package-lock.json',beforeHash:hash(lockText),content:JSON.stringify(lock,null,2)+'\n'}];
}
