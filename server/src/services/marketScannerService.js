import {
  calculateAllIndicators,
} from "../utils/indicators.js";

import {
  calculateTradingSignal,
} from "../utils/signalEngine.js";

const BINANCE_REST_URL =
  process.env.BINANCE_BASE_URL ||
  "https://api.binance.us";

const DEFAULT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "ADAUSD",
  "DOGEUSD",
  "LINKUSD",
  "AVAXUSD",
  "XRPUSD",
];

const ALLOWED_TIMEFRAMES =
  new Set([
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d",
  ]);

function normalizeCandle(kline) {
  return {
    time:
      Math.floor(
        Number(kline[0]) /
          1000,
      ),

    open:
      Number(kline[1]),

    high:
      Number(kline[2]),

    low:
      Number(kline[3]),

    close:
      Number(kline[4]),

    volume:
      Number(kline[5]),

    closeTime:
      Number(kline[6]),

    closed: true,
  };
}

function normalizeSymbol(value) {
  const symbol =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z0-9]{5,20}$/.test(
      symbol,
    )
  ) {
    throw new Error(
      `Invalid symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeTimeframe(
  value,
) {
  const timeframe =
    String(value || "15m")
      .trim();

  if (
    !ALLOWED_TIMEFRAMES.has(
      timeframe,
    )
  ) {
    throw new Error(
      "Unsupported scanner timeframe.",
    );
  }

  return timeframe;
}

async function fetchCandles({
  symbol,
  timeframe,
  limit,
}) {
  const query =
    new URLSearchParams({
      symbol,
      interval:
        timeframe,
      limit:
        String(limit),
    });

  const response =
    await fetch(
      `${BINANCE_REST_URL}/api/v3/klines?${query}`,
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.msg ||
        `Could not load ${symbol}.`,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      `Invalid candle data for ${symbol}.`,
    );
  }

  return data.map(
    normalizeCandle,
  );
}

function rankOpportunity(
  signal,
) {
  const score =
    Number(
      signal?.totalScore,
    ) || 0;

  const actionBonus =
    signal?.action === "BUY"
      ? 20
      : signal?.action ===
          "SELL"
        ? 15
        : 0;

  const trendBonus =
    signal?.regime?.trend ===
    "strong-trend"
      ? 10
      : signal?.regime
            ?.trend ===
          "weak-trend"
        ? 5
        : 0;

  return (
    Math.abs(score) +
    actionBonus +
    trendBonus
  );
}

async function scanSymbol({
  symbol,
  timeframe,
  limit,
}) {
  const candles =
    await fetchCandles({
      symbol,
      timeframe,
      limit,
    });

  const latestCandle =
    candles[
      candles.length - 1
    ];

  if (!latestCandle) {
    throw new Error(
      `No candles returned for ${symbol}.`,
    );
  }

  const indicators =
    calculateAllIndicators(
      candles,
    );

  const signal =
    calculateTradingSignal({
      price:
        latestCandle.close,
      candles,
      indicators,
    });

  return {
    symbol,
    timeframe,

    price:
      latestCandle.close,

    signal,

    score:
      Number(
        signal.totalScore,
      ) || 0,

    confidence:
      Number(
        signal.confidence,
      ) || 0,

    action:
      signal.action,

    label:
      signal.label,

    regime:
      signal.regime,

    rankScore:
      rankOpportunity(
        signal,
      ),

    candleTime:
      latestCandle.time,

    scannedAt:
      Date.now(),
  };
}

export async function scanMarkets({
  symbols =
    DEFAULT_SYMBOLS,

  timeframe = "15m",
  limit = 300,
} = {}) {
  const safeTimeframe =
    normalizeTimeframe(
      timeframe,
    );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) ||
          300,
        220,
      ),
      500,
    );

  const safeSymbols =
    [
      ...new Set(
        (
          Array.isArray(
            symbols,
          )
            ? symbols
            : DEFAULT_SYMBOLS
        ).map(
          normalizeSymbol,
        ),
      ),
    ].slice(0, 20);

  const results =
    await Promise.allSettled(
      safeSymbols.map(
        (symbol) =>
          scanSymbol({
            symbol,
            timeframe:
              safeTimeframe,
            limit:
              safeLimit,
          }),
      ),
    );

  const opportunities = [];
  const errors = [];

  results.forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status ===
        "fulfilled"
      ) {
        opportunities.push(
          result.value,
        );
      } else {
        errors.push({
          symbol:
            safeSymbols[index],

          message:
            result.reason
              ?.message ||
            "Scan failed.",
        });
      }
    },
  );

  opportunities.sort(
    (left, right) =>
      right.rankScore -
      left.rankScore,
  );

  return {
    timeframe:
      safeTimeframe,

    symbols:
      safeSymbols,

    opportunities,

    errors,

    scannedAt:
      Date.now(),
  };
}

export {
  DEFAULT_SYMBOLS,
};
