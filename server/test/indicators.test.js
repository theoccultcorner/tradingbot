import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateADX,
  calculateAllIndicators,
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateVWAP,
} from "../src/utils/indicators.js";

function createCandles(
  count = 300,
  {
    startPrice = 100,
    drift = 0.2,
  } = {},
) {
  return Array.from(
    {
      length: count,
    },
    (
      _,
      index,
    ) => {
      const base =
        startPrice +
        index *
          drift;

      return {
        time:
          1700000000 +
          index *
            60,

        open:
          base -
          0.2,

        high:
          base +
          0.8,

        low:
          base -
          0.8,

        close:
          base +
          0.2,

        volume:
          1000 +
          index *
            5,

        closed: true,
      };
    },
  );
}

test(
  "EMA returns finite values",
  () => {
    const candles =
      createCandles();

    const ema =
      calculateEMA(
        candles,
        21,
      );

    assert.ok(
      ema.length > 0,
    );

    assert.ok(
      ema.every(
        (point) =>
          Number.isFinite(
            point.value,
          ),
      ),
    );
  },
);

test(
  "RSI remains between zero and one hundred",
  () => {
    const rsi =
      calculateRSI(
        createCandles(),
        14,
      );

    assert.ok(
      rsi.length > 0,
    );

    assert.ok(
      rsi.every(
        (point) =>
          point.value >= 0 &&
          point.value <= 100,
      ),
    );
  },
);

test(
  "MACD output contains finite values",
  () => {
    const macd =
      calculateMACD(
        createCandles(),
      );

    assert.ok(
      macd.macd.length >
        0,
    );

    assert.ok(
      macd.signal.length >
        0,
    );

    assert.ok(
      macd.histogram.every(
        (point) =>
          Number.isFinite(
            point.value,
          ),
      ),
    );
  },
);

test(
  "Bollinger upper band stays above lower band",
  () => {
    const bands =
      calculateBollingerBands(
        createCandles(),
      );

    assert.equal(
      bands.upper.length,
      bands.lower.length,
    );

    for (
      let index = 0;
      index <
      bands.upper.length;
      index += 1
    ) {
      assert.ok(
        bands.upper[index]
          .value >=
          bands.lower[index]
            .value,
      );
    }
  },
);

test(
  "ATR, VWAP, and ADX are generated",
  () => {
    const candles =
      createCandles();

    assert.ok(
      calculateATR(
        candles,
      ).length > 0,
    );

    assert.ok(
      calculateVWAP(
        candles,
      ).length > 0,
    );

    assert.ok(
      calculateADX(
        candles,
      ).length > 0,
    );
  },
);

test(
  "all indicator output includes Strategy 2.0 fields",
  () => {
    const indicators =
      calculateAllIndicators(
        createCandles(),
      );

    for (
      const key of [
        "ema9",
        "ema21",
        "ema50",
        "ema200",
        "rsi",
        "macd",
        "macdSignal",
        "macdHistogram",
        "vwap",
        "bollingerUpper",
        "bollingerMiddle",
        "bollingerLower",
        "atr",
        "adx",
      ]
    ) {
      assert.ok(
        Array.isArray(
          indicators[key],
        ),
        `${key} must be an array`,
      );
    }
  },
);
