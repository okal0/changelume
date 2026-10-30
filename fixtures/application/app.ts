import Payments from 'stripe';
export function application(key:string,httpClient:any){
 const stripe=new Payments.Stripe(key,{httpClient,apiVersion:'2022-11-15',maxNetworkRetries:0});
 return {async checkout(email:string,amount:number){
  const customer=await stripe.customers.create({email});
  try {const payment=await stripe.paymentIntents.create({customer:customer.id,amount,currency:'usd',confirm:true,payment_method:'pm_fixture'});return {customer:customer.id,payment:payment.id,status:payment.status};}
  catch(error:any){if(error.type==='StripeCardError')return {customer:customer.id,status:'declined',code:error.code};throw error;}
 }};
}
