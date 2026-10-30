import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.ts'],testTimeout:30000},plugins:[{name:'markdown-text',transform(code,id){if(id.endsWith('.md')||id.endsWith('.py')) return {code:`export default ${JSON.stringify(code)}`,map:null};}}]});
