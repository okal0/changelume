import Payments from 'stripe';
const stripe = new Payments.Stripe(process.env.STRIPE_API_KEY!, {apiVersion: '2022-11-15'});
export async function customer(id: string) {
  return stripe.customers.retrieve(id);
}
const unrelated = {Stripe: class {}};
export const local = new unrelated.Stripe();
