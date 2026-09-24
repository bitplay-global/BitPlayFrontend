import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BINANCE_WS =
  'wss://stream.binance.com:9443/stream?streams=btcusdt@trade/btcusdt@kline_1m';
const KLINES_REST =
  'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=120';
const KLINES_1S_REST =
  'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1s&limit=900';

export type TCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartRow = { candle: TCandle; volume: number };

export type BinanceKlineMsg = {
  stream?: string;
  data?: {
    e?: string;
    k?: {
      t: number;
      o: string;
      h: string;
      l: string;
      c: string;
      v: string;
      x: boolean;
    };
  };
};

export type BinanceTradeMsg = {
  stream?: string;
  data?: {
    e?: string;
    p?: string;
  };
};

function mapKlineRow(row: (string | number)[]): ChartRow {
  return {
    candle: {
      timestamp: Number(row[0]),
      open: parseFloat(String(row[1])),
      high: parseFloat(String(row[2])),
      low: parseFloat(String(row[3])),
      close: parseFloat(String(row[4])),
    },
    volume: parseFloat(String(row[5])),
  };
}

export function getDomainFromCandles(rows: TCandle[]): [number, number] {
  if (rows.length === 0) return [0, 1];
  const values = rows.flatMap(({ high, low }) => [high, low]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.025 || max * 0.0001;
  return [min - pad, max + pad];
}

export function priceToY(
  price: number,
  domain: [number, number],
  height: number
): number {
  const [min, max] = domain;
  if (max === min) return height / 2;
  return height * (1 - (price - min) / (max - min));
}

const MAX_CANDLES = 90;
const PRICE_THROTTLE_MS = 120;
/** Live line chart: append on trades (throttled); cap ~3m of dense ticks at ~90ms */
const MAX_LINE_POINTS = 4000;
const LINE_APPEND_MS = 95;

export type LinePoint = { timestamp: number; value: number };

export function getDomainFromLinePoints(
  points: LinePoint[]
): [number, number] {
  if (points.length === 0) return [0, 1];
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08 || max * 0.00015;
  return [min - pad, max + pad];
}

export function useBinanceMarkets() {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [linePoints, setLinePoints] = useState<LinePoint[]>([]);
  const [lastPrice, setLastPrice] = useState(0);
  const [connected, setConnected] = useState(false);
  const lastPriceRef = useRef(0);
  const priceFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLinePriceRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const candles = useMemo(() => rows.map((r) => r.candle), [rows]);
  const volumes = useMemo(() => rows.map((r) => r.volume), [rows]);

  const schedulePriceFlush = useCallback(() => {
    if (priceFlushRef.current) return;
    priceFlushRef.current = setTimeout(() => {
      priceFlushRef.current = null;
      setLastPrice(lastPriceRef.current);
    }, PRICE_THROTTLE_MS);
  }, []);

  const flushLinePoint = useCallback(() => {
    lineFlushRef.current = null;
    const p = pendingLinePriceRef.current;
    if (p == null || !Number.isFinite(p)) return;
    setLinePoints((prev) => {
      const next = [...prev, { timestamp: Date.now(), value: p }];
      if (next.length > MAX_LINE_POINTS)
        next.splice(0, next.length - MAX_LINE_POINTS);
      return next;
    });
  }, []);

  const scheduleLineAppend = useCallback(() => {
    if (lineFlushRef.current) return;
    lineFlushRef.current = setTimeout(flushLinePoint, LINE_APPEND_MS);
  }, [flushLinePoint]);

  const applyPriceTick = useCallback(
    (p: number, appendToLine: boolean) => {
      if (!Number.isFinite(p)) return;
      lastPriceRef.current = p;
      if (appendToLine) {
        pendingLinePriceRef.current = p;
        scheduleLineAppend();
      }
      schedulePriceFlush();
    },
    [scheduleLineAppend, schedulePriceFlush]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res1m, res1s] = await Promise.all([
          fetch(KLINES_REST),
          fetch(KLINES_1S_REST).catch(() => null),
        ]);
        const json1m = (await res1m.json()) as (string | number)[][];
        if (cancelled || !Array.isArray(json1m)) return;
        const mapped = json1m.map(mapKlineRow).slice(-MAX_CANDLES);
        setRows(mapped);

        let denseLinePoints: LinePoint[] = mapped.map((r) => ({
          timestamp: r.candle.timestamp,
          value: r.candle.close,
        }));

        if (res1s) {
          try {
            const json1s = (await res1s.json()) as (string | number)[][];
            if (Array.isArray(json1s) && json1s.length > 0) {
              const secPoints: LinePoint[] = json1s.map((row) => ({
                timestamp: Number(row[0]),
                value: parseFloat(String(row[4])),
              }));
              denseLinePoints = secPoints;
            }
          } catch {
            /* 1s klines failed, fall back to 1m */
          }
        }

        setLinePoints(denseLinePoints);
        const lastVal = denseLinePoints[denseLinePoints.length - 1]?.value;
        if (lastVal != null) {
          lastPriceRef.current = lastVal;
          setLastPrice(lastVal);
        }
      } catch (e) {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    let reconnect: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      ws = new WebSocket(BINANCE_WS);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnect = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as BinanceTradeMsg &
            BinanceKlineMsg;

          if (msg.stream === 'btcusdt@trade' && msg.data?.p) {
            applyPriceTick(parseFloat(msg.data.p), true);
            return;
          }

          if (msg.stream === 'btcusdt@kline_1m' && msg.data?.k) {
            const k = msg.data.k;
            const candle: TCandle = {
              timestamp: k.t,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
            };
            const volume = parseFloat(k.v);

            setRows((prev) => {
              const next = [...prev];
              const idx = next.findIndex((r) => r.candle.timestamp === k.t);
              const row: ChartRow = { candle, volume };
              if (idx >= 0) {
                next[idx] = row;
              } else {
                next.push(row);
                if (next.length > MAX_CANDLES) next.splice(0, next.length - MAX_CANDLES);
              }
              return next;
            });
            applyPriceTick(candle.close, false);
          }
        } catch {
          /* ignore malformed */
        }
      };
    };

    connect();
    return () => {
      if (reconnect) clearTimeout(reconnect);
      if (priceFlushRef.current) clearTimeout(priceFlushRef.current);
      if (lineFlushRef.current) clearTimeout(lineFlushRef.current);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, [applyPriceTick]);

  const domain = useMemo(() => getDomainFromCandles(candles), [candles]);
  const lineDomain = useMemo(
    () => getDomainFromLinePoints(linePoints),
    [linePoints]
  );

  return {
    candles,
    volumes,
    rows,
    linePoints,
    lastPrice,
    lastPriceRef,
    connected,
    domain,
    lineDomain,
    applyPriceTick,
  };
}
