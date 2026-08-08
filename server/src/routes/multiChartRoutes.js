import {
  Router,
} from "express";

const BINANCE_REST_URL =
  process.env.BINANCE_BASE_URL ||
  "https://api.binance.us";

const ALLOWED_SYMBOLS =
  new Set([
    "BTCUSD",
    "ETHUSD",
    "SOLUSD",
    "DOGEUSD",
    "ADAUSD",
    "LINKUSD",
    "AVAXUSD",
    "XRPUSD",
  ]);

const CANDLES_PER_24_HOURS = {
  "1m": 1440,
  "5m": 288,
  "15m": 96,
  "30m": 48,
  "1h": 24,
  "4h": 6,
  "1d": 1,
};

function normalizeSymbol(
  value,
) {
  const symbol =
    String(
      value || "",
    )
      .trim()
      .toUpperCase();

  if (
    !ALLOWED_SYMBOLS.has(
      symbol,
    )
  ) {
    throw new Error(
      "Unsupported chart symbol.",
    );
  }

  return symbol;
}

function normalizeTimeframe(
  value,
) {
  const timeframe =
    String(
      value || "5m",
    ).trim();

  if (
    !Object.prototype.hasOwnProperty.call(
      CANDLES_PER_24_HOURS,
      timeframe,
    )
  ) {
    throw new Error(
      "Unsupported chart timeframe.",
    );
  }

  return timeframe;
}

function normalizeCandle(
  kline,
) {
  return {
    time:
      Math.floor(
        Number(
          kline[0],
        ) /
          1000,
      ),

    open:
      Number(
        kline[1],
      ),

    high:
      Number(
        kline[2],
      ),

    low:
      Number(
        kline[3],
      ),

    close:
      Number(
        kline[4],
      ),

    volume:
      Number(
        kline[5],
      ),

    closeTime:
      Number(
        kline[6],
      ),

    closed:
      true,
  };
}

async function loadCandles({
  symbol,
  timeframe,
}) {
  const targetCount =
    CANDLES_PER_24_HOURS[
      timeframe
    ];

  const candles = [];

  let endTime =
    Date.now();

  while (
    candles.length <
    targetCount
  ) {
    const remaining =
      targetCount -
      candles.length;

    const requestLimit =
      Math.min(
        remaining,
        1000,
      );

    const query =
      new URLSearchParams({
        symbol,

        interval:
          timeframe,

        limit:
          String(
            requestLimit,
          ),

        endTime:
          String(
            endTime,
          ),
      });

    const response =
      await fetch(
        `${BINANCE_REST_URL}/api/v3/klines?${query}`,
      );

    const data =
      await response.json();

    if (
      !response.ok
    ) {
      throw new Error(
        data?.msg ||
          `Could not load ${symbol}.`,
      );
    }

    if (
      !Array.isArray(
        data,
      ) ||
      data.length ===
        0
    ) {
      break;
    }

    const batch =
      data.map(
        normalizeCandle,
      );

    candles.unshift(
      ...batch,
    );

    const oldestOpenTime =
      Number(
        data[0]?.[0],
      );

    if (
      !Number.isFinite(
        oldestOpenTime,
      )
    ) {
      break;
    }

    endTime =
      oldestOpenTime -
      1;

    if (
      data.length <
      requestLimit
    ) {
      break;
    }
  }

  const unique =
    new Map();

  for (
    const candle of
      candles
  ) {
    unique.set(
      candle.time,
      candle,
    );
  }

  return [
    ...unique.values(),
  ]
    .sort(
      (
        left,
        right,
      ) =>
        left.time -
        right.time,
    )
    .slice(
      -targetCount,
    );
}

export function createMultiChartRouter() {
  const router =
    Router();

  router.get(
    "/candles",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol =
          normalizeSymbol(
            request.query
              .symbol,
          );

        const timeframe =
          normalizeTimeframe(
            request.query
              .timeframe,
          );

        const candles =
          await loadCandles({
            symbol,
            timeframe,
          });

        response.json({
          success:
            true,

          symbol,

          timeframe,

          candles,

          count:
            candles.length,

          updatedAt:
            Date.now(),
        });
      } catch (
        error
      ) {
        next(
          error,
        );
      }
    },
  );

  return router;
}