/**
 * Lightning addresses (LUD-16) look like an email: `name@domain`, e.g.
 * `yourname@speed.app` or `yourname@zbd.gg`. Withdrawals are paid only to
 * these. A Lightning *invoice* (starts with `lnbc…`) is a one-time request
 * that expires within hours, so it can't wait for a withdrawal to be
 * reviewed; it is rejected with its own message.
 *
 * Must match isValidLightningAddress in the backend
 * (routes/api_routes/withdrawal_routes.js).
 */
const LIGHTNING_ADDRESS = /^[a-z0-9._+-]{1,64}@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

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

/** Why an address can't be used, or null when it can. */
export function lightningAddressError(input: string): string | null {
  const value = normalizeLightningAddress(input);
  if (!value) return 'Please enter your Lightning address to continue.';
  if (looksLikeInvoice(value)) {
    return 'That looks like a Lightning invoice. Please use your Lightning address instead: it looks like yourname@speed.app (Speed app → Receive → Lightning address).';
  }
  if (!isValidLightningAddress(value)) {
    return 'Please enter a valid Lightning address, e.g. yourname@speed.app.';
  }
  return null;
}
