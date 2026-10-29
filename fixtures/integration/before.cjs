const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
(async()=>{
  const Stripe=(await import('stripe')).default;
  const OldStripe=(await import('stripe11')).default;
  const key=['sk','test','synthetic_no_network'].join('_');
  assert(new OldStripe.Stripe(key) instanceof OldStripe);
  assert.equal(Stripe.Stripe,undefined);
  assert.equal(Stripe.default,undefined);
  const code=ts.transpileModule(fs.readFileSync('src/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  // A generated module beside node_modules preserves real npm ESM resolution.
  fs.writeFileSync('before-runtime.mjs',code);
  process.env.STRIPE_API_KEY=key;
  try {await assert.rejects(import('./before-runtime.mjs'),/not a constructor/);}finally{fs.unlinkSync('before-runtime.mjs');delete process.env.STRIPE_API_KEY;}
  console.log('Original ESM failure reproduced; SDK declarations alone do not catch it.');
})().catch(error=>{console.error(error);process.exitCode=1;});
