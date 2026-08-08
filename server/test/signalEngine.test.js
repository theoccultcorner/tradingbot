import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAllIndicators,
} from "../src/utils/indicators.js";

import {
  calculateTradingSignal,
} from "../src/utils/signalEngine.js";

function createCandles({
  count = 300,
  startPrice = 100,
  drift = 0.25,
  volumeMultiplier = 1,
} = {}) {
  return Array.from(
    {
      length: count,
    },
    (
      _,
      index,
    ) => {
      const price =
        startPrice +
        index *
          drift;

      return {
        time:
          1700000000 +
          index *
            60,

        open:
          price -
          drift *
            0.4,

        high:
          price +
          1,

        low:
          price -
          1,

        close:
          price,

        volume:
          (
            1000 +
            index *
              10
          ) *
          volumeMultiplier,

        closed: true,
      };
    },
  );
}

test(
  "signal score stays within minus one hundred and one hundred",
  () => {
    const candles =
      createCandles();

    const indicators =
      calculateAllIndicators(
        candles,
      );

    const signal =
      calculateTradingSignal({
        price:
          candles[
            candles.length -
              1
          ].close,

        candles,
        indicators,
      });

    assert.ok(
      signal.totalScore >=
        -100,
    );

    assert.ok(
      signal.totalScore <=
        100,
    );

    assert.ok(
      signal.confidence >=
        0,
    );

    assert.ok(
      signal.confidence <=
        100,
    );
  },
);

test(
  "signal contains all weighted factors",
  () => {
    const candles =
      createCandles();

    const signal =
      calculateTradingSignal({
        price:
          candles.at(-1)
            .close,

        candles,

        indicators:
          calculateAllIndicators(
            candles,
          ),
      });

    for (
      const key of [
        "trend",
        "momentum",
        "pricePosition",
        "volume",
        "trendStrength",
        "volatility",
      ]
    ) {
      assert.ok(
        signal[key],
        `${key} is missing`,
      );

      assert.ok(
        Number.isFinite(
          Number(
            signal[key]
              .score,
          ),
        ),
      );
    }
  },
);

test(
  "strong rising data is not classified as a bearish sell",
  () => {
    const candles =
      createCandles({
        drift: 0.5,
      });

    const signal =
      calculateTradingSignal({
        price:
          candles.at(-1)
            .close,

        candles,

        indicators:
          calculateAllIndicators(
            candles,
          ),
      });

    assert.notEqual(
      signal.action,
      "SELL",
    );
  },
);

test(
  "strong falling data is not classified as a bullish buy",
  () => {
    const candles =
      createCandles({
        startPrice: 500,
        drift: -0.5,
      });

    const signal =
      calculateTradingSignal({
        price:
          candles.at(-1)
            .close,

        candles,

        indicators:
          calculateAllIndicators(
            candles,
          ),
      });

    assert.notEqual(
      signal.action,
      "BUY",
    );
  },
);
