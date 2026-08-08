function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function createPoint(time, value) {
  if (!isFiniteNumber(time) || !isFiniteNumber(value)) {
    return null;
  }

  return {
    time: Number(time),
    value: Number(value),
  };
}

function getCloses(candles) {
  return candles.map((candle) => Number(candle.close));
}

export function calculateEMA(candles, period) {
  if (!Array.isArray(candles) || candles.length < period) {
    return [];
  }

  const closes = getCloses(candles);
  const multiplier = 2 / (period + 1);

  let ema =
    closes
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

  const result = [];

  const initialPoint = createPoint(
    candles[period - 1].time,
    ema,
  );

  if (initialPoint) {
    result.push(initialPoint);
  }

  for (let index = period; index < candles.length; index += 1) {
    ema =
      (closes[index] - ema) * multiplier +
      ema;

    const point = createPoint(candles[index].time, ema);

    if (point) {
      result.push(point);
    }
  }

  return result;
}

export function calculateRSI(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) {
    return [];
  }

  const closes = getCloses(candles);
  const result = [];

  let totalGain = 0;
  let totalLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const difference = closes[index] - closes[index - 1];

    if (difference >= 0) {
      totalGain += difference;
    } else {
      totalLoss += Math.abs(difference);
    }
  }

  let averageGain = totalGain / period;
  let averageLoss = totalLoss / period;

  function calculateRsiValue() {
    if (averageLoss === 0) {
      return 100;
    }

    const relativeStrength = averageGain / averageLoss;

    return 100 - 100 / (1 + relativeStrength);
  }

  result.push({
    time: Number(candles[period].time),
    value: calculateRsiValue(),
  });

  for (
    let index = period + 1;
    index < candles.length;
    index += 1
  ) {
    const difference = closes[index] - closes[index - 1];

    const gain = difference > 0 ? difference : 0;
    const loss = difference < 0 ? Math.abs(difference) : 0;

    averageGain =
      (averageGain * (period - 1) + gain) / period;

    averageLoss =
      (averageLoss * (period - 1) + loss) / period;

    result.push({
      time: Number(candles[index].time),
      value: calculateRsiValue(),
    });
  }

  return result;
}

function calculateEMAValues(values, period) {
  if (!Array.isArray(values) || values.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);

  let ema =
    values
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

  const output = new Array(period - 1).fill(null);
  output.push(ema);

  for (let index = period; index < values.length; index += 1) {
    ema =
      (values[index] - ema) * multiplier +
      ema;

    output.push(ema);
  }

  return output;
}

export function calculateMACD(
  candles,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
) {
  if (
    !Array.isArray(candles) ||
    candles.length < slowPeriod + signalPeriod
  ) {
    return {
      macd: [],
      signal: [],
      histogram: [],
    };
  }

  const closes = getCloses(candles);

  const fastEma = calculateEMAValues(closes, fastPeriod);
  const slowEma = calculateEMAValues(closes, slowPeriod);

  const macdValues = candles.map((_, index) => {
    if (
      fastEma[index] === null ||
      slowEma[index] === null ||
      fastEma[index] === undefined ||
      slowEma[index] === undefined
    ) {
      return null;
    }

    return fastEma[index] - slowEma[index];
  });

  const validMacdValues = [];
  const validMacdIndexes = [];

  macdValues.forEach((value, index) => {
    if (Number.isFinite(value)) {
      validMacdValues.push(value);
      validMacdIndexes.push(index);
    }
  });

  const signalValues = calculateEMAValues(
    validMacdValues,
    signalPeriod,
  );

  const macd = [];
  const signal = [];
  const histogram = [];

  validMacdValues.forEach((macdValue, validIndex) => {
    const candleIndex = validMacdIndexes[validIndex];
    const time = Number(candles[candleIndex].time);
    const signalValue = signalValues[validIndex];

    macd.push({
      time,
      value: macdValue,
    });

    if (Number.isFinite(signalValue)) {
      signal.push({
        time,
        value: signalValue,
      });

      histogram.push({
        time,
        value: macdValue - signalValue,
      });
    }
  });

  return {
    macd,
    signal,
    histogram,
  };
}

export function calculateVWAP(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return [];
  }

  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return candles
    .map((candle) => {
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      const volume = Number(candle.volume);

      if (
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        !Number.isFinite(volume)
      ) {
        return null;
      }

      const typicalPrice = (high + low + close) / 3;

      cumulativePriceVolume += typicalPrice * volume;
      cumulativeVolume += volume;

      if (cumulativeVolume === 0) {
        return null;
      }

      return {
        time: Number(candle.time),
        value: cumulativePriceVolume / cumulativeVolume,
      };
    })
    .filter(Boolean);
}

export function calculateBollingerBands(
  candles,
  period = 20,
  standardDeviations = 2,
) {
  if (!Array.isArray(candles) || candles.length < period) {
    return {
      upper: [],
      middle: [],
      lower: [],
    };
  }

  const closes = getCloses(candles);
  const upper = [];
  const middle = [];
  const lower = [];

  for (
    let index = period - 1;
    index < candles.length;
    index += 1
  ) {
    const window = closes.slice(
      index - period + 1,
      index + 1,
    );

    const average =
      window.reduce((sum, value) => sum + value, 0) /
      period;

    const variance =
      window.reduce(
        (sum, value) =>
          sum + Math.pow(value - average, 2),
        0,
      ) / period;

    const standardDeviation = Math.sqrt(variance);
    const time = Number(candles[index].time);

    middle.push({
      time,
      value: average,
    });

    upper.push({
      time,
      value:
        average +
        standardDeviation * standardDeviations,
    });

    lower.push({
      time,
      value:
        average -
        standardDeviation * standardDeviations,
    });
  }

  return {
    upper,
    middle,
    lower,
  };
}

export function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) {
    return [];
  }

  const trueRanges = [];

  for (let index = 1; index < candles.length; index += 1) {
    const currentHigh = Number(candles[index].high);
    const currentLow = Number(candles[index].low);
    const previousClose = Number(candles[index - 1].close);

    const highLow = currentHigh - currentLow;
    const highPreviousClose = Math.abs(
      currentHigh - previousClose,
    );
    const lowPreviousClose = Math.abs(
      currentLow - previousClose,
    );

    trueRanges.push(
      Math.max(
        highLow,
        highPreviousClose,
        lowPreviousClose,
      ),
    );
  }

  if (trueRanges.length < period) {
    return [];
  }

  let atr =
    trueRanges
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) /
    period;

  const result = [
    {
      time: Number(candles[period].time),
      value: atr,
    },
  ];

  for (
    let index = period;
    index < trueRanges.length;
    index += 1
  ) {
    atr =
      (atr * (period - 1) + trueRanges[index]) /
      period;

    result.push({
      time: Number(candles[index + 1].time),
      value: atr,
    });
  }

  return result;
}

export function calculateAllIndicators(candles) {
  const ema9 = calculateEMA(candles, 9);
  const ema21 = calculateEMA(candles, 21);
  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, 200);

  const rsi = calculateRSI(candles, 14);

  const macdResult = calculateMACD(
    candles,
    12,
    26,
    9,
  );

  const vwap = calculateVWAP(candles);

  const bollinger = calculateBollingerBands(
    candles,
    20,
    2,
  );

  const atr = calculateATR(candles, 14);

  return {
    ema9,
    ema21,
    ema50,
    ema200,
    rsi,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    vwap,
    bollingerUpper: bollinger.upper,
    bollingerMiddle: bollinger.middle,
    bollingerLower: bollinger.lower,
    atr,
  };
}