import {Project,Node,SyntaxKind} from 'ts-morph';
import {resolve,dirname,relative} from 'node:path';
import type {Inventory} from '../../models.js';
// Inventory only: imported client/factory flows never authorize recipe edits.
export function discoverLinks(root:string,files:string[],inventory:Inventory){
 const project=new Project({skipAddingFilesFromTsConfig:true,skipFileDependencyResolution:true});const sources=files.map(file=>project.addSourceFileAtPath(file));
 const exports=new Map<string,Set<string>>();
 for(const source of sources){const constructors=new Set(source.getImportDeclarations().filter(i=>i.getModuleSpecifierValue()==='stripe'&&!i.isTypeOnly()).flatMap(i=>[i.getDefaultImport(),...i.getNamedImports().filter(n=>!n.isTypeOnly()&&['Stripe','default'].includes(n.getName())).map(n=>n.getAliasNode()??n.getNameNode())]).map(n=>n?.getSymbol()).filter(Boolean));
  const isClient=(node:Node|undefined)=>{if(!node||!Node.isNewExpression(node))return false;let expr=node.getExpression();if(Node.isPropertyAccessExpression(expr)){if(!['Stripe','default'].includes(expr.getName()))return false;expr=expr.getExpression();}return Node.isIdentifier(expr)&&constructors.has(expr.getSymbol());};
  const names=new Set<string>();for(const declaration of source.getVariableDeclarations())if(declaration.getVariableStatement()?.isExported()&&declaration.getVariableStatement()?.getDeclarationKind()==='const'&&isClient(declaration.getInitializer()))names.add(declaration.getName());
  for(const fn of source.getFunctions()){const body=fn.getBody();if(fn.isExported()&&body&&Node.isBlock(body)&&body.getStatements().length===1){const statement=body.getStatements()[0];if(statement&&Node.isReturnStatement(statement)&&isClient(statement.getExpression()))names.add('factory:'+fn.getName());}}
  exports.set(source.getFilePath(),names);
 }
 for(const source of sources){const clients=new Set<ReturnType<Node['getSymbol']>>();
  for(const imp of source.getImportDeclarations()){const specifier=imp.getModuleSpecifierValue();if(!specifier.startsWith('.')||imp.isTypeOnly())continue;
   const path=resolve(dirname(source.getFilePath()),specifier).replace(/\.js$/,'.ts').replaceAll('\\','/');const names=exports.get(path)??exports.get(path+'.ts')??exports.get(resolve(path,'index.ts').replaceAll('\\','/'));if(!names)continue;
   for(const imported of imp.getNamedImports().filter(n=>!n.isTypeOnly())){const local=imported.getAliasNode()??imported.getNameNode();if(names.has(imported.getName()))clients.add(local.getSymbol());
    if(names.has('factory:'+imported.getName()))for(const variable of source.getVariableDeclarations()){const init=variable.getInitializer();if(init&&Node.isCallExpression(init)&&init.getExpression().getSymbol()===local.getSymbol()&&variable.getVariableStatement()?.getDeclarationKind()==='const'&&Node.isIdentifier(variable.getNameNode())){const symbol=variable.getNameNode().getSymbol();if(symbol)clients.add(symbol);}}
   }
  }
  for(const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)){let base:Node=call.getExpression();const segments:string[]=[];while(Node.isPropertyAccessExpression(base)){segments.unshift(base.getName());base=base.getExpression();}
   if(Node.isIdentifier(base)&&clients.has(base.getSymbol()))inventory.usages.push({file:relative(root,source.getFilePath()).replaceAll('\\','/'),line:call.getStartLineNumber(),kind:'unsupported',symbol:`Traced cross-file Stripe client: ${segments.join('.')}; inventory only, verify wrappers and versions manually`,requestApiVersion:'unknown'});
  }
 }
}
