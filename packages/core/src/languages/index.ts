import {analyze} from './typescript/analyze.js';
import {pythonAdapter} from './python/analyze.js';
import type {LanguageAdapter} from '../models.js';
export const adapters:Record<string,LanguageAdapter>={typescript:{id:'typescript',analyze},python:pythonAdapter};
