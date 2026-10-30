const assert = require('node:assert/strict');
const text = require('node:fs').readFileSync('checkout.rb', 'utf8');
assert(text.includes('Stripe::Subscription::cancel('));
assert(!text.includes('Stripe::Subscription::delete('));
