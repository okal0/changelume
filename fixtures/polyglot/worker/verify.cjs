const assert = require('node:assert/strict');
const text = require('node:fs').readFileSync('main.go', 'utf8');
assert(text.includes('stripe.ErrorCodeInvoicePaymentIntentRequiresAction'));
assert(!text.includes('stripe.ErrorCodeInvoicePamentIntentRequiresAction'));
