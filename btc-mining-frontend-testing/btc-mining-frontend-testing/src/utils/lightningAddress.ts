/**
 * Where a Lightning withdrawal goes, typed into one field:
 *
 *  - a Lightning address (LUD-16, `name@domain`, e.g. yourname@speed.app,
 *    yourname@zbd.gg): reusable, never expires;
 *  - a Lightning invoice (BOLT11, `lnbc…`): a one-time request for a fixed
 *    amount that expires. It must be for bitcoin mainnet, carry an amount,
 *    and still have at least 10 minutes left. Its amount becomes the
 *    withdrawal amount (invoiceAmountBtc fills the amount field).
 *
 * Same rules as the backend's helpers/withdrawalDestination.js, which also
 * checks the invoice amount against the withdrawal and re-checks expiry
 * when the withdrawal is approved.
 */
import { decodeInvoice, normalizeInvoice } from './bolt11';

const LIGHTNING_ADDRESS = /^[a-z0-9._+-]{1,64}@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const MIN_INVOICE_LIFETIME_S = 10 * 60;

export function normalizeLightningAddress(input: string): string {
  return String(input ?? '').trim().toLowerCase();
}

export function isValidLightningAddress(input: string): boolean {
  return LIGHTNING_ADDRESS.test(normalizeLightningAddress(input));
}

/** True for something that looks like a pasted invoice, even with junk added. */
export function looksLikeInvoice(input: string): boolean {
  return /^(lightning:)?ln(bc|tb|bcrt)[0-9a-z]{50,}/i.test(String(input ?? '').trim());
}

/** What to send to the server: a trimmed, lower-cased address or invoice. */
export function normalizeDestination(input: string): string {
  return looksLikeInvoice(input) ? normalizeInvoice(input) : normalizeLightningAddress(input);
}

/** The amount of a usable invoice as a BTC string for the amount field, or null. */
export function invoiceAmountBtc(input: string): string | null {
  if (!looksLikeInvoice(input)) return null;
  const inv = decodeInvoice(input);
  if (!inv || inv.network !== 'bitcoin' || !inv.sats || inv.sats <= 0) return null;
  return (inv.sats / 1e8).toFixed(8);
}

/** Why it can't be used, or null when it can. */
export function lightningAddressError(input: string, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return 'Please enter your Lightning address or invoice to continue.';
  if (looksLikeInvoice(raw)) {
    const inv = decodeInvoice(raw);
    if (!inv) {
      return "That Lightning invoice isn't valid. Copy it again from your wallet without adding anything to it, or use your Lightning address (e.g. yourname@speed.app).";
    }
    if (inv.network !== 'bitcoin') return 'That invoice is not for the Bitcoin main network.';
    if (!inv.sats || inv.sats <= 0) {
      return 'That invoice has no amount. Create an invoice for the amount you want to withdraw, or use your Lightning address.';
    }
    if (inv.expiresAt - nowSeconds < MIN_INVOICE_LIFETIME_S) {
      return inv.expiresAt <= nowSeconds
        ? 'That invoice has expired. Create a new one, or use your Lightning address.'
        : 'That invoice expires in a few minutes, too soon for the withdrawal to be reviewed. Create a new one, or use your Lightning address.';
    }
    return null;
  }
  if (!isValidLightningAddress(raw)) {
    return 'Please enter a valid Lightning address (e.g. yourname@speed.app) or a Lightning invoice (lnbc…).';
  }
  return null;
}
