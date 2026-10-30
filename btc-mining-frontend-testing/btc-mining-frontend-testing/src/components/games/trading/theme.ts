import { Dimensions } from 'react-native';

/** Shared look for the BTC Trading game (TradingScreen + its components). */
export const T = {
  bg: '#0B0F17',
  surface: '#111827',
  surface2: '#1F2937',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#F9FAFB',
  textDim: '#9CA3AF',
  textMuted: '#6B7280',
  up: '#22C55E',
  upDeep: '#15803D',
  down: '#EF4444',
  downDeep: '#B91C1C',
  cyan: '#18D4F2',
  gold: '#FBBF24',
  btc: '#F7931A',
};

const { width: SW, height: SH } = Dimensions.get('window');
export const SCREEN_W = SW;
export const SCREEN_H = SH;
export const IS_SMALL = SW < 380 || SH < 700;
export const PAD = SW < 380 ? 12 : 16;

export function formatUsd(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "+$12.34" / "-$12.34" */
export function formatSignedUsd(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${formatUsd(Math.abs(n))}`;
}

export function formatClock(ts: number) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  if (d.toDateString() !== new Date().toDateString()) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}
