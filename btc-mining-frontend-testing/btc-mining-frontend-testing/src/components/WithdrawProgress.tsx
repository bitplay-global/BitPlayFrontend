import React, { useCallback, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { get_data_uri, getMobileSecurityHeaders } from '../config/api';
import { getObjectFromStorage, saveObjectToStorage } from '../config/storage';
import { getLastKnownBtcUsdPrice } from '../services/btcPriceService';
import { btcToSats, formatSatsValue } from '../utils/sats';

type WithdrawalLimits = { minBtc: number; maxBtc: number };

const LIMITS_CACHE_KEY = 'withdrawalLimitsCache_v1';
// Admin can change the minimum, but not often; don't refetch on every focus.
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;
let lastFetchAtMs = 0;

function isValidLimits(v: any): v is WithdrawalLimits {
  return (
    !!v &&
    typeof v.minBtc === 'number' &&
    typeof v.maxBtc === 'number' &&
    Number.isFinite(v.minBtc) &&
    v.minBtc > 0
  );
}

function readCachedLimits(): WithdrawalLimits | null {
  try {
    const cached = getObjectFromStorage(LIMITS_CACHE_KEY);
    return isValidLimits(cached) ? cached : null;
  } catch {
    return null;
  }
}

/**
 * Withdrawal min/max from GET_WITHDRAWAL_LIMITS (same endpoint and parsing as
 * WithdrawalScreenNew). Starts from the last value cached in MMKV; null when
 * nothing is known, so callers hide the bar instead of guessing a minimum.
 */
export function useWithdrawalLimits(): WithdrawalLimits | null {
  const [limits, setLimits] = useState<WithdrawalLimits | null>(readCachedLimits);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const cached = readCachedLimits();
      if (cached && Date.now() - lastFetchAtMs < REFETCH_INTERVAL_MS) {
        setLimits(cached);
        return () => {
          active = false;
        };
      }
      (async () => {
        try {
          const res = await fetch(get_data_uri('GET_WITHDRAWAL_LIMITS'), {
            headers: getMobileSecurityHeaders(),
          });
          const data = await res.json();
          if (res.ok && typeof data.minBtc === 'number' && typeof data.maxBtc === 'number') {
            const next = { minBtc: data.minBtc, maxBtc: data.maxBtc };
            lastFetchAtMs = Date.now();
            if (isValidLimits(next)) {
              saveObjectToStorage(LIMITS_CACHE_KEY, next);
              if (active) setLimits(next);
            }
          }
        } catch {
          // Keep the cached value (or none) -- never show a made-up minimum.
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return limits;
}

function formatUsd(v: number): string {
  if (v > 0 && v < 0.01) return '<$0.01';
  return `$${v.toFixed(2)}`;
}

type Props = {
  /** Withdrawable BTC balance; null/undefined while unknown (renders nothing). */
  balanceBtc: number | null | undefined;
  /** Optional BTC/USD price; falls back to the last price the app fetched. */
  btcPrice?: number | null;
  style?: StyleProp<ViewStyle>;
};

const WithdrawProgress: React.FC<Props> = ({ balanceBtc, btcPrice, style }) => {
  const limits = useWithdrawalLimits();

  if (limits == null || balanceBtc == null || !Number.isFinite(balanceBtc)) {
    return null;
  }

  const balanceSats = Math.max(0, btcToSats(balanceBtc));
  const minSats = btcToSats(limits.minBtc);
  if (!(minSats > 0)) return null;

  const ratio = Math.min(1, balanceSats / minSats);
  // Compare with a tiny epsilon so float noise can't keep a user at 99.99%.
  const ready = balanceSats + 1e-6 >= minSats;
  const pct = ready ? 100 : ratio * 100;
  const pctLabel = ready ? '100%' : pct > 0 && pct < 1 ? '<1%' : `${Math.floor(pct)}%`;

  const price = btcPrice ?? getLastKnownBtcUsdPrice();
  const hasPrice = price != null && Number.isFinite(price) && price > 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, ready && styles.titleReady]} numberOfLines={2}>
          {ready ? (
            'Ready to withdraw!'
          ) : (
            <>
              <Text style={styles.highlight}>{formatSatsValue(balanceSats)}</Text>
              {' of '}
              <Text style={styles.highlight}>{formatSatsValue(minSats)}</Text>
              {' to your first withdrawal'}
            </>
          )}
        </Text>
        <Text style={[styles.pct, ready && styles.pctReady]}>{pctLabel}</Text>
      </View>

      <View style={styles.track}>
        <LinearGradient
          colors={ready ? ['#4ADE80', '#22C55E'] : ['#18D4F2', '#FBBF24']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }]}
        />
      </View>

      {hasPrice && (
        <Text style={styles.usd} numberOfLines={1}>
          {ready
            ? `≈ ${formatUsd(balanceSats / 1e8 * (price as number))} available`
            : `≈ ${formatUsd(balanceSats / 1e8 * (price as number))} of ${formatUsd(limits.minBtc * (price as number))}`}
        </Text>
      )}
    </View>
  );
};

export default WithdrawProgress;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B111D',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(24, 212, 242, 0.18)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 17,
    marginRight: 10,
  },
  titleReady: {
    color: '#4ADE80',
    fontWeight: '700',
    fontSize: 14,
  },
  highlight: {
    color: '#F5F7FA',
    fontWeight: '700',
  },
  pct: {
    color: '#18D4F2',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pctReady: {
    color: '#4ADE80',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  usd: {
    color: '#7E8CA3',
    fontSize: 11,
    marginTop: 6,
  },
});
