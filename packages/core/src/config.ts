import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

export const configSchema = z.object({
  vendors: z.object({stripe: z.object({enabled: z.boolean().default(true), sdkVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(), requestApiVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), webhookVersion: z.string().optional()}).strict().default({enabled:true})}).strict().default({stripe:{enabled:true}}),
  include: z.array(z.string()).default(['src/**/*.ts', 'src/**/*.tsx']),
  exclude: z.array(z.string()).default(['**/node_modules/**', '**/*.d.ts']),
  verification: z.array(z.object({command:z.string().min(1), args:z.array(z.string()).default([]), timeoutMs:z.number().int().min(100).max(600000).default(120000)}).strict()).default([]),
  sources: z.object({timeoutMs:z.number().int().min(100).max(60000).default(10000), retries:z.number().int().min(0).max(3).default(2)}).strict().default({timeoutMs:10000,retries:2}),
  llm: z.object({enabled:z.boolean().default(false), provider:z.literal('openai'), model:z.string().min(1), apiKeyEnv:z.string().regex(/^[A-Z_][A-Z0-9_]*$/).default('OPENAI_API_KEY'), maxRequests:z.number().int().min(1).max(3).default(1), maxInputTokens:z.number().int().min(100).max(16000).default(4000), maxOutputTokens:z.number().int().min(100).max(8000).default(2000), timeoutMs:z.number().int().min(100).max(60000).default(30000), retries:z.number().int().min(0).max(2).default(0)}).strict().optional(),
  pr: z.object({base:z.string().default('main'), draft:z.boolean().default(true)}).strict().default({base:'main',draft:true})
}).strict();
export type Config = z.infer<typeof configSchema>;
export function loadConfig(root:string, name='changelume.yml'):Config {
  const path = resolve(root,name);
  return configSchema.parse(existsSync(path) ? parse(readFileSync(path,'utf8')) : {});
}
export const exampleConfig = `vendors:\n  stripe:\n    enabled: true\ninclude: ['src/**/*.ts', 'src/**/*.tsx']\nexclude: ['**/node_modules/**', '**/*.d.ts']\n# Commands execute customer code. Configure only commands you trust.\nverification: []\npr:\n  base: main\n  draft: true\n# llm:\n#   enabled: true\n#   provider: openai\n#   model: YOUR_MODEL\n#   apiKeyEnv: OPENAI_API_KEY\n`;
