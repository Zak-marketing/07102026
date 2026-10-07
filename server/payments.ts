import type express from 'express';
import type Stripe from 'stripe';
import { STRIPE_PRODUCTS } from '../src/types/index.ts';
import { isCheckoutTab, checkoutDestination, isCheckoutSession } from '../src/services/paymentReturn.ts';
import { recordStripeSubscription } from './admin.ts';
import {newRecoveryToken, validEncryptedCheckout, saveCheckoutRecovery, readCheckoutRecovery, removeCheckoutRecovery} from './checkoutRecovery.ts';
import {bindCheckoutClient} from './clientIdentity.ts';

const allowedCurrencies = new Set(['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY', 'MAD', 'DZD', 'BRL', 'INR', 'AED']);
const priceEnv = {
  scan_meals: 'STRIPE_PRICE_SCAN_MEALS',
  progress_video: 'STRIPE_PRICE_PROGRESS_VIDEO',
  complete_pack: 'STRIPE_PRICE_COMPLETE_PACK'
} as const;
const apiPaths = (suffix: string) => ['/api/' + suffix, '/auraslim-api/' + suffix];

function checkoutReturnAddress(req: express.Request): URL | null {
  const address = process.env.APP_URL || req.protocol + '://' + (req.get('host') || '') + '/';
  try {
    const base = new URL(address);
    if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) ||
      base.username || base.password) return null;
    const requested = typeof req.body?.returnUrl === 'string' ? new URL(req.body.returnUrl) : base;
    // A client may return to its current path, never to an unrelated origin.
    if (requested.origin !== base.origin || requested.username || requested.password) return null;
    for (const key of ['session_id', 'checkout', 'return_tab', 'payment_success', 'plan', 'recovery_session', 'open_video']) requested.searchParams.delete(key);
    requested.hash = '';
    return requested;
  } catch { return null; }
}

export function installPaymentRoutes(
  app: express.Express,
  stripe: Stripe | null,
  clientId: (req: express.Request, res: express.Response) => string,
  rateLimit: (req: express.Request, res: express.Response, max?: number) => boolean
) {
  const linkPrices = new Map<string, string>();
  const resolvePrice = async (product: typeof STRIPE_PRODUCTS[number]) => {
    if (!stripe) throw new Error('Configurez STRIPE_SECRET_KEY sur le serveur.');
    const configured = process.env[priceEnv[product.planKey as keyof typeof priceEnv]];
    let priceId = configured || linkPrices.get(product.planKey);
    if (!priceId) {
      let starting_after: string | undefined;
      for (let page = 0; page < 5; page++) {
        const links = await stripe.paymentLinks.list({ limit: 100, ...(starting_after ? { starting_after } : {}) });
        const link = links.data.find(item => item.active && item.url === product.stripeCheckoutUrl);
        if (link) {
          const lines = await stripe.paymentLinks.listLineItems(link.id, { limit: 2 });
          if (lines.data.length !== 1 || lines.data[0].quantity !== 1) throw new Error('Le lien doit contenir un seul abonnement.');
          priceId = lines.data[0].price?.id;
          if (priceId) linkPrices.set(product.planKey, priceId);
          break;
        }
        if (!links.has_more) break;
        starting_after = links.data.at(-1)?.id;
      }
    }
    if (!priceId) throw new Error('Lien Stripe introuvable pour cette offre. Vérifiez le compte et le mode test ou réel de la clé.');
    const price = await stripe.prices.retrieve(priceId, { expand: ['currency_options'] });
    if (!price.active || price.currency !== 'eur' || !price.unit_amount || price.unit_amount <= 0 ||
      price.recurring?.interval !== 'month' || (price.recurring.interval_count || 1) !== 1)
      throw new Error('Cette offre nécessite un tarif Stripe actif en EUR, facturé chaque mois.');
    return price;
  };

  app.get(apiPaths('offers'), async (req, res) => {
    if (!rateLimit(req, res, 32)) return;
    const offers = await Promise.all(STRIPE_PRODUCTS.map(async product => {
      try { const price = await resolvePrice(product); return { planKey: product.planKey, available: true, priceEur: price.unit_amount! / 100 }; }
      catch (error) { return { planKey: product.planKey, available: false, error: error instanceof Error ? error.message : 'Offre indisponible.' }; }
    }));
    res.set('Cache-Control', 'no-store').json({ offers });
  });

  app.post(apiPaths('checkout'), async (req, res) => {
    if (!rateLimit(req, res)) return;
    const product = STRIPE_PRODUCTS.find(item => item.planKey === String(req.body?.plan || ''));
    if (!product) { res.status(400).json({ error: 'Forfait inconnu.' }); return; }
    const currency = String(req.body?.currency || 'EUR').toUpperCase();
    if (!allowedCurrencies.has(currency)) { res.status(400).json({ error: 'Devise non disponible.' }); return; }
    const requestedTab = req.body?.returnTab || 'progress';
    if (!isCheckoutTab(requestedTab)) { res.status(400).json({ error: 'Écran de retour inconnu.' }); return; }
    const returnTab = checkoutDestination(product.planKey, requestedTab);
    const backup = req.body?.backup;
    const recoveryKey = req.body?.recoveryKey;
    if (backup !== undefined && (!validEncryptedCheckout(backup) || typeof recoveryKey !== 'string' || !/^[a-f0-9]{64}$/.test(recoveryKey))) {
      res.status(400).json({error:'Sauvegarde de retour paiement invalide.'}); return;
    }
    const env = priceEnv[product.planKey as keyof typeof priceEnv];
    const priceId = env && process.env[env];
    if (!stripe) {
      res.status(503).json({ error: 'Paiement indisponible : configurez STRIPE_SECRET_KEY sur le serveur.' }); return;
    }
    const returnAddress = checkoutReturnAddress(req);
    if (!returnAddress) {
      res.status(503).json({ error: 'Configurez APP_URL avec l’adresse HTTPS de cette application pour permettre le retour après paiement.' }); return;
    }
    try {
      const price = await resolvePrice(product);
      if (typeof req.body?.expectedPriceEur === 'number' && Math.round(req.body.expectedPriceEur * 100) !== price.unit_amount) {
        res.status(409).json({ error: 'Le tarif a changé. Fermez puis ouvrez les offres pour voir le montant actuel.' }); return;
      }
      if (currency !== price.currency.toUpperCase() && !price.currency_options?.[currency.toLowerCase()]) {
        res.status(422).json({ error: 'Cette devise n’est pas configurée pour cet abonnement Stripe.' }); return;
      }
      const id = clientId(req, res);
      const recoveryToken = backup ? newRecoveryToken() : undefined;
      returnAddress.searchParams.set('return_tab', returnTab);
      if (product.planKey === 'progress_video' || (product.planKey === 'complete_pack' && requestedTab === 'photos')) returnAddress.searchParams.set('open_video','1');
      const success = new URL(returnAddress);
      success.searchParams.set('checkout', 'success');
      const separator = success.search ? '&' : '?';
      const cancel = new URL(returnAddress);
      cancel.searchParams.set('checkout', 'cancel');
      cancel.searchParams.set('return_tab',requestedTab);
      cancel.searchParams.delete('open_video');
      if (recoveryToken) {success.hash = 'auraslim_recovery=' + recoveryToken + '.' + recoveryKey; cancel.hash = success.hash;}
      // Append the literal placeholder before the fragment, as required by Stripe.
      const successHash = success.hash; success.hash = '';
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: price.id, quantity: 1 }],
        currency: currency.toLowerCase(),
        client_reference_id: id,
        metadata: { return_tab: returnTab, plan: product.planKey },
        success_url: success.href + separator + 'session_id={CHECKOUT_SESSION_ID}' + successHash,
        cancel_url: cancel.href
      });
      if (!session.url) throw new Error('Lien Stripe absent');
      if (recoveryToken) {
        try {await saveCheckoutRecovery(recoveryToken,session.id,id,backup);}
        catch {res.status(503).json({error:'Votre suivi n’a pas pu être sauvegardé avant paiement. Vérifiez le stockage privé du serveur puis réessayez.'});return;}
      }
      res.json({ url: session.url, sessionId: session.id, recoveryToken, returnTab, openVideo:returnAddress.searchParams.get('open_video')==='1' });
    } catch {
      res.status(502).json({ error: 'Paiement Stripe indisponible. Vérifiez que la clé serveur et les liens ou tarifs appartiennent au même compte et au même mode test ou réel.' });
    }
  });

  app.get(apiPaths('checkout-restore'), async (req,res) => {
    if (!rateLimit(req,res,16)) return;
    const sessionId = String(req.query.session_id || ''), token=req.get('X-AuraSlim-Recovery');
    if (!stripe || (sessionId && !isCheckoutSession(sessionId))) {res.status(400).json({error:'Référence de retour paiement invalide.'});return;}
    let record;
    try {record=await readCheckoutRecovery(token,sessionId);}catch{res.status(503).json({error:'Le stockage de reprise est indisponible. Réessayez sans refaire votre inscription.'});return;}
    if (!record) {res.status(410).json({error:'La sauvegarde de retour est absente ou expirée. Ouvrez l’adresse utilisée avant le paiement pour retrouver votre suivi.'});return;}
    try {
      const session=await stripe.checkout.sessions.retrieve(record.session);
      if (session.client_reference_id!==record.owner || session.mode!=='subscription') {res.status(403).json({error:'Le retour ne correspond pas à ce paiement.'});return;}
      bindCheckoutClient(res,record.owner);
      res.set('Cache-Control','no-store').json({encrypted:record.encrypted,sessionId:record.session});
    } catch {res.status(502).json({error:'La reprise après paiement est indisponible. Réessayez sans recommencer votre inscription.'});}
  });
  app.post(apiPaths('checkout-restore/complete'), async (req,res) => {
    if (!rateLimit(req,res,16)) return;
    const sessionId=String(req.body?.sessionId || ''), token=req.get('X-AuraSlim-Recovery');
    let record;try{record=isCheckoutSession(sessionId) ? await readCheckoutRecovery(token,sessionId) : null;}catch{res.status(503).json({error:'Le stockage de reprise est indisponible.'});return;}
    if (!record || clientId(req,res)!==record.owner) {res.status(403).json({error:'Reprise non autorisée.'});return;}
    try {await removeCheckoutRecovery(token);res.json({removed:true});}catch{res.status(503).json({error:'La suppression de la sauvegarde est indisponible.'});}
  });

  app.get(apiPaths('entitlement'), async (req, res) => {
    if (!rateLimit(req, res, 32)) return;
    const sessionId = String(req.query.session_id || '');
    if (!stripe) { res.status(503).json({ error: 'Clé Stripe manquante. Aucun forfait Premium ne peut être validé.' }); return; }
    if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(sessionId)) {
      res.status(400).json({ error: 'Référence de paiement invalide.' }); return;
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const id = clientId(req, res);
      if (session.client_reference_id !== id) { res.status(403).json({ error: 'Paiement lié à un autre appareil. Contactez le support.' }); return; }
      const returnTab = isCheckoutTab(session.metadata?.return_tab) ? session.metadata.return_tab : undefined;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!subscriptionId) { res.json({ active: false, plan: 'free', returnTab }); return; }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const price = subscription.items.data[0]?.price;
      let product = STRIPE_PRODUCTS.find(item => {
        const env = priceEnv[item.planKey as keyof typeof priceEnv];
        return env && process.env[env] === price?.id;
      });
      // Subscriptions from the configured Payment Links can also be verified.
      if (!product && session.payment_link) {
        const linkId = typeof session.payment_link === 'string' ? session.payment_link : session.payment_link.id;
        const link = await stripe.paymentLinks.retrieve(linkId);
        product = STRIPE_PRODUCTS.find(item => item.stripeCheckoutUrl === link.url);
      }
      if (!product && session.metadata?.plan) {
        const candidate = STRIPE_PRODUCTS.find(item => item.planKey === session.metadata?.plan);
        if (candidate) {
          const configuredPrice = await resolvePrice(candidate);
          if (configuredPrice.id === price?.id) product = candidate;
        }
      }
      const active = !!product && subscription.items.data.length === 1 && price?.recurring?.interval === 'month' && (price.recurring.interval_count || 1) === 1 && price.currency === 'eur' && (price.unit_amount || 0) > 0 &&
        session.status === 'complete' && session.mode === 'subscription' && session.payment_status === 'paid' &&
        ['active', 'trialing'].includes(subscription.status);
      recordStripeSubscription(id, sessionId, subscriptionId, product?.planKey || 'free', subscription.status);
      res.set('Cache-Control', 'no-store').json({
        active, plan: active ? product!.planKey : 'free',
        productName: active ? product!.name : undefined, returnTab
      });
    } catch {
      res.status(502).json({ error: 'Vérification de l’abonnement indisponible.' });
    }
  });
}
