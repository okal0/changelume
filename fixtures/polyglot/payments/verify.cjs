const assert = require('node:assert/strict');
const text = require('node:fs').readFileSync('src/Checkout.java', 'utf8');
assert(text.includes('CashBalance.retrieve('));
assert(!text.includes('retrieveCashBalance'));
