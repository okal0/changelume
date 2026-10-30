import {analyze} from './typescript/analyze.js';
import {pythonAdapter} from './python/analyze.js';
import {ecosystemAdapter} from './ecosystems.js';
import type {LanguageAdapter} from '../models.js';
export const adapters:Record<string,LanguageAdapter>={typescript:{id:'typescript',analyze},javascript:{id:'javascript',analyze},python:pythonAdapter,...Object.fromEntries(['go','java','csharp','php','ruby'].map(language=>[language,ecosystemAdapter(language)]))};

for(const adapter of Object.values(adapters))adapter.capabilities={dependencies:true,references:['typescript','javascript','python'].includes(adapter.id)?'semantic':'lexical',automaticMigrations:['typescript','javascript','python','go','java','csharp','php','ruby'].includes(adapter.id)};
