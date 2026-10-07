import type {Response} from 'express';
export const checkoutCookieName = 'auraslim_checkout_client';
export function bindCheckoutClient(res: Response, id: string) {
  if (!/^[a-f0-9]{48}$/.test(id)) throw new Error('Invalid checkout identity');
  res.cookie(checkoutCookieName, id, {httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', maxAge:365*86400_000, path:'/'});
}
