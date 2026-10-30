const assert=require('node:assert/strict');
const path=require('node:path');
for(const name of ['stripe','stripe11']) {
  const utils=require(path.join(path.dirname(require.resolve(name)),'utils.js'));
  const mapping={api_key:'apiKey',idempotency_key:'idempotencyKey',stripe_account:'stripeAccount',stripe_version:'apiVersion',stripeVersion:'apiVersion'};
  for(const [old,current] of Object.entries(mapping)) {
    assert.equal(utils.isOptionsHash({[old]:'synthetic-value'}),false);
    assert.equal(utils.isOptionsHash({[current]:'synthetic-value'}),true);
    const parsed=utils.getOptionsFromArgs([{[current]:'synthetic-value'}]);
    assert(JSON.stringify(parsed).includes('synthetic-value'));
  }
}
console.log('Legacy request option removal and replacement parsing verified against SDK 11.18.0 and 12.0.0.');

for(const name of ['stripe','stripe11']) {
 const Stripe=require(name);const sdk=new Stripe(['sk','test','synthetic'].join('_'),{timeout:250,maxNetworkRetries:2,telemetry:false});
 assert.equal(sdk.getApiField('timeout'),250);
 assert.equal(sdk.getApiField('maxNetworkRetries'),2);
 assert.equal(sdk.getTelemetryEnabled(),false);
 for(const method of ['setTimeout','setMaxNetworkRetries','setTelemetryEnabled']) assert.equal(sdk[method],undefined);
}
