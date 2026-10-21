/* eslint-disable no-bitwise -- builds test invoices with a bech32 checksum */
import {
  invoiceAmountBtc,
  isValidLightningAddress,
  lightningAddressError,
  looksLikeInvoice,
  normalizeDestination,
} from '../src/utils/lightningAddress';
import { decodeInvoice } from '../src/utils/bolt11';

// Builds a test invoice with a valid BOLT11 layout and checksum (the
// signature is zero: only Speed checks it).
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const polymod = (v: number[]) => {
  let c = 1;
  for (const x of v) {
    const t = c >>> 25;
    c = ((c & 0x1ffffff) << 5) ^ x;
    for (let i = 0; i < 5; i++) if ((t >>> i) & 1) c ^= GEN[i];
  }
  return c >>> 0;
};
const hrpExp = (h: string) => [...[...h].map(c => c.charCodeAt(0) >> 5), 0, ...[...h].map(c => c.charCodeAt(0) & 31)];
const intWords = (n: number, len: number) => {
  const w: number[] = [];
  for (let i = 0; i < len; i++) { w.unshift(n % 32); n = Math.floor(n / 32); }
  return w;
};
const NOW = 1_800_000_000;
const makeInvoice = ({ sats, net = 'bc', createdAgo = 0, expiry = 86400 }: { sats: number | null; net?: string; createdAgo?: number; expiry?: number }) => {
  const hrp = `ln${net}${sats == null ? '' : `${sats * 10}n`}`;
  const expWords = intWords(expiry, expiry < 1024 ? 2 : expiry < 32768 ? 3 : 4);
  const data = [...intWords(NOW - createdAgo, 7), B32.indexOf('p'), 1, 20, ...new Array(52).fill(0), B32.indexOf('x'), 0, expWords.length, ...expWords, ...new Array(104).fill(0)];
  const mod = polymod([...hrpExp(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const chk = [0, 1, 2, 3, 4, 5].map(i => (mod >> (5 * (5 - i))) & 31);
  return hrp + '1' + [...data, ...chk].map(w => B32[w]).join('');
};

describe('Lightning address', () => {
  it.each(['yourname@speed.app', 'YourName@Speed.App', '  someone@speed.app  ', 'satoshi@zbd.gg', 'first.last+tips@walletofsatoshi.com'])(
    'accepts %s', addr => {
      expect(isValidLightningAddress(addr)).toBe(true);
      expect(lightningAddressError(addr, NOW)).toBeNull();
    });

  it.each(['', 'speed.app', 'name@', '@speed.app', 'name@speed', 'name with space@speed.app'])('rejects %j', addr => {
    expect(lightningAddressError(addr, NOW)).not.toBeNull();
  });
});

describe('Lightning invoice', () => {
  it('reads the BOLT11 spec example (2500u = 250,000 sats, 60 s expiry)', () => {
    const spec = 'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh';
    const d = decodeInvoice(spec);
    expect(d?.sats).toBe(250000);
    expect(d?.timestamp).toBe(1496314658);
    expect(d?.expirySeconds).toBe(60);
  });

  it('accepts a valid invoice and fills its amount', () => {
    const inv = makeInvoice({ sats: 1400 });
    expect(lightningAddressError(inv, NOW)).toBeNull();
    expect(lightningAddressError(`lightning:${inv.toUpperCase()}`, NOW)).toBeNull();
    expect(invoiceAmountBtc(inv)).toBe('0.00001400');
    expect(normalizeDestination(`  lightning:${inv.toUpperCase()} `)).toBe(inv);
  });

  it.each([
    ['no amount', makeInvoice({ sats: null }), /no amount/],
    ['expired', makeInvoice({ sats: 1400, createdAgo: 90000 }), /expired/],
    ['5 minutes left', makeInvoice({ sats: 1400, expiry: 300 }), /few minutes/],
    ['testnet', makeInvoice({ sats: 1400, net: 'tb' }), /main network/],
  ])('refuses an invoice with %s', (_label, inv, re) => {
    expect(lightningAddressError(inv, NOW)).toMatch(re);
  });

  it('refuses an invoice with @speed.app added or a typo (19 Oct case)', () => {
    const inv = makeInvoice({ sats: 1400 });
    expect(lightningAddressError(`${inv}@speed.app`, NOW)).toMatch(/isn't valid/);
    expect(lightningAddressError(inv.slice(0, 60) + (inv[60] === 'q' ? 'p' : 'q') + inv.slice(61), NOW)).toMatch(/isn't valid/);
    expect(invoiceAmountBtc(`${inv}@speed.app`)).toBeNull();
  });

  it('does not mistake an address for an invoice', () => {
    expect(looksLikeInvoice('lnbcfan@speed.app')).toBe(false);
  });
});
