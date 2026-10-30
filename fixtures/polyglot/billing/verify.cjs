const assert = require('node:assert/strict');
const text = require('node:fs').readFileSync('Checkout.cs', 'utf8');
assert(text.includes('SubscriptionProrationBehavior ='));
assert(!text.includes('SubscriptionProrate ='));
