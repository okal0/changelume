import S from 'stripe';
export const client=new S.Stripe(process.env.KEY);
