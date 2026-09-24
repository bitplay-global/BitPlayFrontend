import axios from 'axios';
import { SERVER_BASE_URL } from '../config/api';

let cachedUsdPrice: number | null = null;
let cachedAtMs = 0;
let inFlight: Promise<number | null> | null = null;

async function fetchFromCoinGecko(): Promise<number> {
  const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
    params: { ids: 'bitcoin', vs_currencies: 'usd' },
  });
  const price = Number(res?.data?.bitcoin?.usd);
  return Number.isFinite(price) ? price : 0;
}

async function fetchFromBinance(): Promise<number> {
  // Public endpoint (no API key)
  const res = await axios.get('https://api.binance.com/api/v3/ticker/price', {
    params: { symbol: 'BTCUSDT' },
  });
  const price = Number(res?.data?.price);
  return Number.isFinite(price) ? price : 0;
}

/**
 * Our own backend, which caches the same two sources server-side. Worth asking
 * when the public APIs rate-limit this device: the server is rate-limited as
 * one caller for every user, and it is the rate withdrawals are validated at.
 */
async function fetchFromBackend(): Promise<number> {
  const res = await axios.get(`${SERVER_BASE_URL}/api/btc-price`, { timeout: 8000 });
  const price = Number(res?.data?.usd);
  return Number.isFinite(price) ? price : 0;
}

/** The last price fetched in this session, or null if none ever succeeded. */
export function getLastKnownBtcUsdPrice(): number | null {
  return cachedUsdPrice;
}

/**
 * BTC→USD price with caching + rate-limit protection.
 *
 * - Caches for `ttlMs` (default 60s).
 * - Dedupes concurrent requests (inFlight).
 * - On 429 or network errors: Binance, then our backend, then the last price
 *   fetched this session.
 * - Returns **null** when no source answered and nothing is cached. It used to
 *   return 0, which screens multiplied into balances and showed as "$0.00" --
 *   indistinguishable from an empty wallet, and a withdrawal built on it was
 *   rejected as "below the 0.5 USDT minimum". Callers must treat null as
 *   "price unavailable" and show a placeholder instead of a number.
 *
 * IMPORTANT: never throws (so screens don't crash on 429).
 */
export async function getBtcUsdPriceCached(ttlMs: number = 60_000): Promise<number | null> {
  const now = Date.now();
  if (cachedUsdPrice != null && now - cachedAtMs < ttlMs) return cachedUsdPrice;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const sources: Array<[string, () => Promise<number>]> = [
      ['CoinGecko', fetchFromCoinGecko],
      ['Binance', fetchFromBinance],
      ['backend', fetchFromBackend],
    ];

    for (const [name, fetchPrice] of sources) {
      try {
        const price = await fetchPrice();
        if (price > 0) {
          cachedUsdPrice = price;
          cachedAtMs = Date.now();
          return price;
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 429) {
          console.warn(`[BTC Price] ${name} rate-limited (429).`);
        } else {
          console.warn(`[BTC Price] ${name} fetch failed:`, err?.message ?? err);
        }
      }
    }

    // Stale is far better than zero: the price moves by a fraction of a percent
    // in the seconds these retries take, and a wrong-looking balance is what
    // users report as lost funds.
    return cachedUsdPrice;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
