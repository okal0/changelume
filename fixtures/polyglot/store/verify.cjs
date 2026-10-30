const assert = require('node:assert/strict');
const text = require('node:fs').readFileSync('checkout.php', 'utf8');
assert(text.includes('$client->sources->allSourceTransactions('));
assert(!text.includes('$client->sources->allTransactions('));
