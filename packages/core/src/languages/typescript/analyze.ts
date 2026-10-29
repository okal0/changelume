import { Project, Node, SyntaxKind, ts } from 'ts-morph';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { relative, resolve, matchesGlob } from 'node:path';
import { z } from 'zod';
import type { Config } from '../../config.js';
import type { Inventory, Usage, Edit } from '../../models.js';
import { hash } from '../../safety.js';

const manifest=z.object({dependencies:z.record(z.string(),z.string()).optional(),devDependencies:z.record(z.string(),z.string()).optional()});
const lockSchema=z.object({lockfileVersion:z.number(),packages:z.record(z.string(),z.object({version:z.string().optional()}).passthrough()).optional(),dependencies:z.record(z.string(),z.object({version:z.string()}).passthrough()).optional()}).passthrough();
export function sourceFiles(root:string,config:Config):string[] {
  const paths:string[]=[];
  function walk(dir:string) {for(const entry of readdirSync(dir,{withFileTypes:true})) {
    if(['node_modules','.git','.changelume'].includes(entry.name)||entry.isSymbolicLink()) continue;
    const full=resolve(dir,entry.name), rel=relative(root,full).replaceAll('\\','/');
    if(entry.isDirectory()) walk(full);
    else if(/\.tsx?$/.test(rel)&&config.include.some(g=>matchesGlob(rel,g))&&!config.exclude.some(g=>matchesGlob(rel,g))) {
      if(lstatSync(full).size>200000) throw new Error('Source file size limit exceeded: '+rel);
      paths.push(full); if(paths.length>5000) throw new Error('Source file count limit exceeded');
    }
  }} walk(root); return paths.sort();
}
export function analyze(root:string,config:Config):{inventory:Inventory;edits:Edit[]} {
  const inventory:Inventory={vendor:'stripe',sdkPackage:'stripe',versionOrigin:'unknown',usages:[],limitations:[],webhookVersion:config.vendors.stripe.webhookVersion??'unknown; endpoint configuration is external'};
  if(!config.vendors.stripe.enabled) {inventory.limitations.push('Stripe disabled by configuration');return {inventory,edits:[]};}
  if(existsSync(resolve(root,'package.json'))) {const p=manifest.parse(JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')));inventory.declared=p.dependencies?.stripe??p.devDependencies?.stripe;}
  if(existsSync(resolve(root,'package-lock.json'))) {
    const lock=lockSchema.parse(JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8')));
    inventory.resolved=lock.packages?.['node_modules/stripe']?.version??lock.dependencies?.stripe?.version;
    inventory.versionOrigin='package-lock.json (root installation)';
    if(Object.keys(lock.packages??{}).some(k=>k.endsWith('/node_modules/stripe')&&k!=='node_modules/stripe')) inventory.limitations.push('Nested Stripe installations are unsupported; root version cannot establish their applicability');
  } else inventory.limitations.push('Missing package-lock.json; resolved SDK version is unknown');
  if(config.vendors.stripe.sdkVersion) {inventory.resolved=config.vendors.stripe.sdkVersion;inventory.versionOrigin='explicit configuration override';}
  if(!existsSync(resolve(root,'node_modules/stripe'))) inventory.limitations.push('Stripe dependencies absent: lexical symbol binding available, SDK type checking unavailable; no dependencies installed');
  const project=new Project({skipAddingFilesFromTsConfig:true,skipFileDependencyResolution:true,compilerOptions:{target:ts.ScriptTarget.ESNext,jsx:ts.JsxEmit.Preserve,noResolve:true}});
  const edits:Edit[]=[];
  for(const file of sourceFiles(root,config)) {
    const source=project.addSourceFileAtPath(file), name=relative(root,file).replaceAll('\\','/'), before=source.getFullText();
    const imports=source.getImportDeclarations().filter(d=>d.getModuleSpecifierValue()==='stripe');
    const roots=new Set(imports.map(d=>d.getDefaultImport()?.getSymbol()).filter(Boolean));
    const clients=new Set<ReturnType<Node['getSymbol']>>();
    const clientVersions=new Map<ReturnType<Node['getSymbol']>,string>();
    const add=(node:Node,kind:Usage['kind'],symbol:string,extra:Partial<Usage>={})=>inventory.usages.push({file:name,line:node.getStartLineNumber(),kind,symbol,...extra});
    const isRoot=(node:Node)=>Node.isIdentifier(node)&&roots.has(node.getSymbol());
    const unsafeRoots=new Set<ReturnType<Node['getSymbol']>>();
    for(const id of source.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if(!isRoot(id)) continue;
      const parent=id.getParent();
      const safe=Node.isImportClause(parent)||Node.isNewExpression(parent)&&parent.getExpression()===id||
        Node.isPropertyAccessExpression(parent)&&parent.getExpression()===id&&['Stripe','default'].includes(parent.getName())&&Node.isNewExpression(parent.getParent())&&(parent.getParent() as import('ts-morph').NewExpression).getExpression()===parent;
      if(!safe) unsafeRoots.add(id.getSymbol());
    }
    for(const imp of imports) {add(imp,'import',imp.getDefaultImport()?.getText()??'non-default Stripe import');if(!imp.getDefaultImport()||imp.isTypeOnly()) add(imp,'unsupported','Only runtime default imports are supported');}
    const replacements:{start:number;end:number;text:string}[]=[];
    for(const n of source.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const expr=n.getExpression();
      const alias=Node.isPropertyAccessExpression(expr)&&isRoot(expr.getExpression())&&['default','Stripe'].includes(expr.getName());
      if(!isRoot(expr)&&!alias) continue;
      const options=n.getArguments()[1]; let version='unknown';
      if(options&&Node.isObjectLiteralExpression(options)) {const p=options.getProperty('apiVersion');if(p&&Node.isPropertyAssignment(p)&&Node.isStringLiteral(p.getInitializer())) version=p.getInitializer()!.getText().slice(1,-1);}
      if(version==='unknown'&&!options&&inventory.resolved?.startsWith('12.')) version='2022-11-15 (SDK 12 default)';
      if(config.vendors.stripe.requestApiVersion) version=config.vendors.stripe.requestApiVersion+' (configuration override)';
      add(n,'client',alias?expr.getText():expr.getText(),{requestApiVersion:version});
      const parent=n.getParent();
      if(Node.isVariableDeclaration(parent)&&Node.isIdentifier(parent.getNameNode())) {clients.add(parent.getNameNode().getSymbol());clientVersions.set(parent.getNameNode().getSymbol(),version);}
      else add(n,'unsupported','Client is not bound to a simple local variable');
      if(alias&&Node.isPropertyAccessExpression(expr)) {
        if(unsafeRoots.has(expr.getExpression().getSymbol())) {add(expr,'unsupported','Stripe constructor binding is mutated, escaped, or used outside supported constructors');continue;}
        add(expr,'field',expr.getText(),{start:expr.getStart(),end:expr.getEnd(),replacement:expr.getExpression().getText()});
        const major=Number(inventory.resolved?.split('.')[0]);
        if((major===11||major===12)&&!inventory.limitations.some(l=>l.startsWith('Nested'))&&!imports.some(i=>i.isTypeOnly())) replacements.push({start:expr.getStart(),end:expr.getEnd(),text:expr.getExpression().getText()});
      }
    }
    for(const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      let base:Node=call.getExpression(); const segments:string[]=[];
      while(Node.isPropertyAccessExpression(base)) {segments.unshift(base.getName());base=base.getExpression();}
      if(Node.isIdentifier(base)&&clients.has(base.getSymbol())) {
        const operation=segments.join('.');
        const known=/^(customers|paymentIntents|charges|checkout.sessions)\.(create|retrieve|list|update|del)$/.test(operation);
        add(call,operation.startsWith('webhooks.')||operation.startsWith('webhookEndpoints.')?'webhook':known?'call':'unsupported',operation||'indirect client call',{requestApiVersion:clientVersions.get(base.getSymbol())});
        for(const arg of call.getArguments()) if(Node.isObjectLiteralExpression(arg)) {const v=arg.getProperty('apiVersion');if(v) add(v,'field','per-request apiVersion',{requestApiVersion:Node.isPropertyAssignment(v)&&Node.isStringLiteral(v.getInitializer())?v.getInitializer()!.getText().slice(1,-1):'unknown'});}
      }
      if(call.getExpression().getText()==='require'&&call.getArguments()[0]?.getText().match(/^['"]stripe['"]$/)) add(call,'unsupported','CommonJS Stripe import');
    }
    for(const access of source.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
      const expr=access.getExpression();if(isRoot(expr)||Node.isIdentifier(expr)&&clients.has(expr.getSymbol())) add(access,'unsupported','Dynamic/computed Stripe access');
    }
    // References outside supported constructor/call chains reveal wrappers and escapes.
    for(const id of source.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if(!roots.has(id.getSymbol())&&!clients.has(id.getSymbol())) continue;
      const p=id.getParent();
      if(Node.isImportClause(p)||Node.isVariableDeclaration(p)&&p.getNameNode()===id||Node.isPropertyAccessExpression(p)&&p.getExpression()===id||Node.isNewExpression(p)&&p.getExpression()===id||Node.isElementAccessExpression(p)) continue;
      add(id,'unsupported','Stripe binding escapes supported local analysis');
    }
    for(const p of source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) if(isRoot(p.getExpression())&&!Node.isNewExpression(p.getParent())) add(p,'unsupported','Stripe static access outside supported constructor');
    for(const r of replacements.sort((a,b)=>b.start-a.start)) source.replaceText([r.start,r.end],r.text);
    const text=source.getFullText();
    if(text!==before) edits.push({path:name,beforeHash:hash(before),content:text});
  }
  return {inventory,edits};
}
