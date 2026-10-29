import Payments from 'stripe';
// Stripe 12 ESM removed this runtime alias, although its declarations still allow it.
const stripe = new Payments.Stripe(process.env.STRIPE_API_KEY!, {apiVersion: '2022-11-15'});
export const unrelated = new Date('2026-01-01');
export const api = stripe;
