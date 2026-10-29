const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/index.ts', 'utf8');
assert(source.includes('new Payments(process.env.STRIPE_API_KEY!'));
assert(!source.includes('new Payments.Stripe('));
assert(source.includes('new unrelated.Stripe()'));
console.log('Offline recipe assertions passed (no Stripe network request).');
