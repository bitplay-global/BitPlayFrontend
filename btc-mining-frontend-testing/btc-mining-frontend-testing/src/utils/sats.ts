/**
 * Satoshi helpers. Users earn fractions of a cent per day, so BTC amounts like
 * "0.0000001814 BTC" are unreadable; sats (1 BTC = 100,000,000 sats) are not.
 */

export const SATS_PER_BTC = 100_000_000;

/** Parses a BTC amount (number, numeric string or Mongo $numberDecimal) into a finite number, else 0. */
function toBtcNumber(btc: unknown): number {
  let n: number;
  if (typeof btc === 'number') {
    n = btc;
  } else if (typeof btc === 'string') {
    n = parseFloat(btc);
  } else if (btc && typeof btc === 'object' && '$numberDecimal' in (btc as any)) {
    n = parseFloat((btc as any).$numberDecimal);
  } else {
    n = Number(btc);
  }
  return Number.isFinite(n) ? n : 0;
}

/** BTC -> sats (not rounded). Invalid input gives 0. */
export function btcToSats(btc: unknown): number {
  return toBtcNumber(btc) * SATS_PER_BTC;
}

/** 1234567 -> "1,234,567" without relying on Intl (not guaranteed on every Hermes build). */
function withThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a sats amount: whole sats with thousands separators ("1,814 sats"),
 * or two decimals below one sat ("0.42 sats"). Rounds down so a balance is
 * never overstated (the epsilon absorbs float noise like 699.99999999).
 */
export function formatSatsValue(sats: number): string {
  if (!Number.isFinite(sats) || sats === 0) return '0 sats';
  const negative = sats < 0;
  const abs = Math.abs(sats);
  let body: string;
  if (abs < 1) {
    body = abs.toFixed(2);
    if (body === '1.00') body = '1';
  } else {
    body = withThousands(String(Math.floor(abs + 1e-6)));
  }
  const unit = body === '1' ? 'sat' : 'sats';
  return `${negative ? '-' : ''}${body} ${unit}`;
}

/** BTC -> "1,814 sats" / "0.42 sats". */
export function formatSats(btc: unknown): string {
  return formatSatsValue(btcToSats(btc));
}

/** BTC as a plain decimal string for the secondary line, e.g. "0.00001814". */
export function formatBtc(btc: unknown, decimals: number = 8): string {
  return toBtcNumber(btc).toFixed(decimals);
}
