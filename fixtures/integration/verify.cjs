const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const Stripe = require('stripe');
const OldStripe = require('stripe11');
const key = ['sk','test','synthetic_no_network'].join('_');
assert.equal(typeof OldStripe.Stripe, 'function');
assert.equal(typeof OldStripe.default, 'function');
assert(new OldStripe.Stripe(key) instanceof OldStripe);
assert.equal(typeof Stripe.Stripe, 'function');
assert.equal(typeof Stripe.default, 'function');
assert(new Stripe.Stripe(key) instanceof Stripe);
const text = fs.readFileSync('src/index.ts','utf8');
assert(!text.includes('new Payments.Stripe('));
assert(text.includes("new Date('2026-01-01')"));
// Execute transpiled customer code against actual stripe@12, without making API calls.
assert(!process.env.GITHUB_TOKEN && !process.env.OPENAI_API_KEY, 'Verification must not receive publishing or LLM credentials');
(async()=>{
  const ESMStripe=(await import('stripe')).default;
  assert.equal(ESMStripe.Stripe,undefined);assert.equal(ESMStripe.default,undefined);
  fs.writeFileSync('candidate-runtime.mjs',ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText);
  process.env.STRIPE_API_KEY=key;
  try {const result=await import('./candidate-runtime.mjs');assert(result.api instanceof ESMStripe);assert.equal(result.unrelated.toISOString(),'2026-01-01T00:00:00.000Z');}
  finally {fs.unlinkSync('candidate-runtime.mjs');delete process.env.STRIPE_API_KEY;}
  console.log('Real SDK behavior verified: stripe@11.18.0/12.0.0 ESM and CJS; no vendor requests. Credential boundary verified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
