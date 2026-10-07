import { CHECKOUT_TABS, type CheckoutTab, type UserPlan } from '../types';

export const PENDING_CHECKOUT_KEY = 'auraslim_pending_checkout';
export const isCheckoutSession = (value: unknown): value is string =>
  typeof value === 'string' && /^cs_(test_|live_)[A-Za-z0-9]+$/.test(value);
export const isCheckoutTab = (value: unknown): value is CheckoutTab =>
  typeof value === 'string' && (CHECKOUT_TABS as readonly string[]).includes(value);
export const checkoutDestination = (plan: UserPlan, origin: CheckoutTab): CheckoutTab =>
  plan === 'scan_meals' ? 'nutrition' : plan === 'progress_video' ? 'photos' : origin === 'account' ? 'progress' : origin;

export interface PendingCheckout {
  sessionId: string;
  tab: CheckoutTab;
  scrollY: number;
  startedAt: number;
  openVideo?: boolean;
}
export interface PaymentReturn {
  sessionId: string | null;
  cancelled: boolean;
  tab: CheckoutTab;
  openVideo: boolean;
}

export function parsePaymentReturn(search: string): PaymentReturn | null {
  const params = new URLSearchParams(search);
  const session = params.get('session_id');
  const cancelled = params.get('checkout') === 'cancel';
  if (!isCheckoutSession(session) && !cancelled) return null;
  const tab = params.get('return_tab');
  const recoverySession = params.get('recovery_session');
  return { sessionId: isCheckoutSession(session) ? session : cancelled && isCheckoutSession(recoverySession) ? recoverySession : null, cancelled, tab: isCheckoutTab(tab) ? tab : 'progress', openVideo: params.get('open_video') === '1' };
}

export function readPendingCheckout(storage: Pick<Storage, 'getItem'>, now = Date.now()): PendingCheckout | null {
  try {
    const value = JSON.parse(storage.getItem(PENDING_CHECKOUT_KEY) || 'null');
    if (!value || !isCheckoutSession(value.sessionId) || !isCheckoutTab(value.tab) ||
      !Number.isFinite(value.scrollY) || value.scrollY < 0 ||
      !Number.isFinite(value.startedAt) || value.startedAt > now || now - value.startedAt > 24 * 3600_000) return null;
    return value;
  } catch { return null; }
}

export function clearPendingCheckout(storage: Pick<Storage, 'removeItem'>) {
  for (const key of [PENDING_CHECKOUT_KEY, 'auraslim_pending_payment_plan', 'auraslim_pending_payment_time', 'auraslim_pending_payment_name']) {
    storage.removeItem(key);
  }
}

export function cleanPaymentReturnUrl(href: string): string {
  const url = new URL(href);
  for (const name of ['session_id', 'checkout', 'return_tab', 'payment_success', 'plan', 'recovery_session', 'open_video']) url.searchParams.delete(name);
  if (url.hash.startsWith('#auraslim_recovery=')) url.hash = '';
  return url.href;
}
