/* eslint-disable no-bitwise -- bech32 checksum arithmetic */
/**
 * Minimal BOLT11 (Lightning invoice) reader: the checksum, network, amount
 * and expiry -- enough to check an invoice before sending a withdrawal
 * request and to fill in its amount. The signature is not checked (Speed
 * does that when it pays). Same logic as the backend's helpers/bolt11.js.
 */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const MULTIPLIER: Record<string, number> = { m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 };
const SIGNATURE_WORDS = 104;
const CHECKSUM_WORDS = 6;

export type DecodedInvoice = {
  invoice: string;
  network: 'bitcoin' | 'testnet' | 'regtest';
  msats: number | null;
  sats: number | null;
  timestamp: number;
  expirySeconds: number;
  expiresAt: number;
};

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) chk ^= GENERATOR[i];
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

const wordsToInt = (words: number[]) => words.reduce((n, w) => n * 32 + w, 0);

export function normalizeInvoice(input: string): string {
  return String(input ?? '').trim().replace(/^lightning:/i, '').toLowerCase();
}

/** Null when it isn't a well-formed invoice. Times are unix seconds. */
export function decodeInvoice(input: string): DecodedInvoice | null {
  const invoice = normalizeInvoice(input);
  if (!/^ln/.test(invoice) || invoice.length < 100 || invoice.length > 7089) return null;
  const sep = invoice.lastIndexOf('1');
  if (sep < 3) return null;
  const hrp = invoice.slice(0, sep);
  const words: number[] = [];
  for (const c of invoice.slice(sep + 1)) {
    const v = CHARSET.indexOf(c);
    if (v < 0) return null;
    words.push(v);
  }
  if (words.length < 7 + SIGNATURE_WORDS + CHECKSUM_WORDS) return null;
  if (polymod([...hrpExpand(hrp), ...words]) !== 1) return null;

  const m = /^ln(bcrt|bc|tbs|tb)(\d+)?([munp])?$/.exec(hrp);
  if (!m) return null;
  const network = m[1] === 'bc' ? 'bitcoin' : m[1] === 'bcrt' ? 'regtest' : 'testnet';
  let msats: number | null = null;
  if (m[2]) {
    const n = Number(m[2]);
    if (!m[3]) {
      msats = n * 1e11;
    } else if (m[3] === 'p') {
      if (n % 10 !== 0) return null;
      msats = n / 10;
    } else {
      msats = Math.round(n * MULTIPLIER[m[3]] * 1e11);
    }
  }

  const data = words.slice(0, words.length - CHECKSUM_WORDS - SIGNATURE_WORDS);
  const timestamp = wordsToInt(data.slice(0, 7));
  let expirySeconds = 3600;
  for (let i = 7; i + 3 <= data.length;) {
    const type = data[i];
    const len = data[i + 1] * 32 + data[i + 2];
    const field = data.slice(i + 3, i + 3 + len);
    if (type === CHARSET.indexOf('x')) expirySeconds = wordsToInt(field);
    i += 3 + len;
  }
  return {
    invoice,
    network,
    msats,
    sats: msats == null ? null : Math.floor(msats / 1000),
    timestamp,
    expirySeconds,
    expiresAt: timestamp + expirySeconds,
  };
}
