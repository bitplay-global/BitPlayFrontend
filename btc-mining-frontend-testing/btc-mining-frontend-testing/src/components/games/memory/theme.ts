import { useWindowDimensions } from 'react-native';

/** App palette used across the Memory Match screen. */
export const MM = {
  bgDeep: '#050914',
  bgPanel: '#0f172a',
  cyan: '#18D4F2',
  gold: '#FBBF24',
  purple: '#7c3aed',
  lavender: '#a5b4fc',
  green: '#4ADE80',
  red: '#F87171',
  text: '#f8fafc',
  muted: '#94a3b8',
  dim: '#64748b',
};

export type TokenStyle = {
  icon: string;
  /** Face gradient, light to dark. */
  colors: [string, string];
  /** Border / glow tint. */
  ring: string;
};

/** Crypto-themed card faces, keyed by the screen's token keys. */
export const TOKEN_STYLES: Record<string, TokenStyle> = {
  btc: { icon: 'bitcoin', colors: ['#FB923C', '#9A3412'], ring: '#FDBA74' },
  eth: { icon: 'ethereum', colors: ['#8B5CF6', '#3B0764'], ring: '#C4B5FD' },
  ltc: { icon: 'litecoin', colors: ['#94A3B8', '#1E293B'], ring: '#E2E8F0' },
  usd: { icon: 'currency-usd', colors: ['#22C55E', '#14532D'], ring: '#86EFAC' },
  eur: { icon: 'currency-eur', colors: ['#3B82F6', '#172554'], ring: '#93C5FD' },
  gbp: { icon: 'currency-gbp', colors: ['#F43F5E', '#881337'], ring: '#FDA4AF' },
  inr: { icon: 'currency-inr', colors: ['#14B8A6', '#134E4A'], ring: '#5EEAD4' },
  doge: { icon: 'dog-side', colors: ['#FACC15', '#854D0E'], ring: '#FDE68A' },
};

export const FALLBACK_TOKEN_STYLE: TokenStyle = { icon: 'help', colors: ['#334155', '#0f172a'], ring: '#64748b' };

export const timerColorFor = (secondsLeft: number) =>
  secondsLeft <= 10 ? MM.red : secondsLeft <= 20 ? MM.gold : MM.cyan;

// ---- Layout ----
/** GameScreenWrapper's contentInner adds paddingHorizontal: 12 on each side. */
const WRAPPER_H_PADDING = 24;
/** Inner padding of the board panel that frames the grid. */
export const BOARD_PAD = 10;
const GRID_MAX_W = 420;
const GRID_MIN_W = 240;
/**
 * Vertical space taken by everything that is not the grid: status bar,
 * wrapper header (~50), top + bottom banner ads (~50 + ~60), wrapper padding,
 * the HUD (~84) and the board padding. Capping the grid by
 * `height - RESERVED_V` keeps HUD + board on one screen on ~360x640 phones.
 */
const RESERVED_V = 320;

/** Square cards sized from the real window, so 4x4 fills the row on any phone. */
export function useMemoryGridLayout() {
  const { width, height } = useWindowDimensions();
  const byWidth = width - WRAPPER_H_PADDING - (BOARD_PAD + 1) * 2;
  const byHeight = height - RESERVED_V;
  const target = Math.max(GRID_MIN_W, Math.min(byWidth, byHeight, GRID_MAX_W));
  const gap = target < 320 ? 7 : 9;
  const cardSize = Math.floor((target - gap * 3) / 4);
  const gridW = cardSize * 4 + gap * 3;
  return {
    cardSize,
    gap,
    gridW,
    /** Grid + padding + the board's 1px border (RN widths include borders). */
    boardW: gridW + (BOARD_PAD + 1) * 2,
    /** Small boards drop secondary detail from the result panel. */
    compact: gridW < 320,
  };
}
