function getLatestValue(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return null;
  }

  const latest = series[series.length - 1];
  const value =
    typeof latest === "object"
      ? Number(latest.value)
      : Number(latest);

  return Number.isFinite(value) ? value : null;
}

function createResult(score, reason) {
  return {
    score,
    reason,
  };
}

function evaluateTrend(price, indicators) {
  const currentPrice = Number(price);
  const ema9 = getLatestValue(indicators.ema9);
  const ema21 = getLatestValue(indicators.ema21);
  const ema50 = getLatestValue(indicators.ema50);
  const ema200 = getLatestValue(indicators.ema200);

  if (
    !Number.isFinite(currentPrice) ||
    ema9 === null ||
    ema21 === null ||
    ema50 === null
  ) {
    return createResult(0, "Waiting for enough EMA history");
  }

  let score = 0;
  const reasons = [];

  if (currentPrice > ema9) {
    score += 1;
    reasons.push("price is above EMA 9");
  } else {
    score -= 1;
    reasons.push("price is below EMA 9");
  }

  if (ema9 > ema21) {
    score += 1;
    reasons.push("EMA 9 is above EMA 21");
  } else {
    score -= 1;
    reasons.push("EMA 9 is below EMA 21");
  }

  if (ema21 > ema50) {
    score += 1;
    reasons.push("EMA 21 is above EMA 50");
  } else {
    score -= 1;
    reasons.push("EMA 21 is below EMA 50");
  }

  if (ema200 !== null) {
    if (ema50 > ema200) {
      score += 1;
      reasons.push("EMA 50 is above EMA 200");
    } else {
      score -= 1;
      reasons.push("EMA 50 is below EMA 200");
    }
  }

  return createResult(score, reasons.join(", "));
}

function evaluateMomentum(indicators) {
  const rsi = getLatestValue(indicators.rsi);
  const macd = getLatestValue(indicators.macd);
  const macdSignal = getLatestValue(indicators.macdSignal);
  const histogram = getLatestValue(
    indicators.macdHistogram,
  );

  if (rsi === null || macd === null || macdSignal === null) {
    return createResult(
      0,
      "Waiting for RSI and MACD history",
    );
  }

  let score = 0;
  const reasons = [];

  if (rsi >= 50 && rsi < 70) {
    score += 1;
    reasons.push("RSI shows positive momentum");
  } else if (rsi > 30 && rsi < 50) {
    score -= 1;
    reasons.push("RSI shows weak momentum");
  } else if (rsi >= 70) {
    score -= 1;
    reasons.push("RSI is overbought");
  } else if (rsi <= 30) {
    score += 1;
    reasons.push("RSI is oversold");
  }

  if (macd > macdSignal) {
    score += 1;
    reasons.push("MACD is above its signal line");
  } else {
    score -= 1;
    reasons.push("MACD is below its signal line");
  }

  if (histogram !== null) {
    if (histogram > 0) {
      score += 1;
      reasons.push("MACD histogram is positive");
    } else {
      score -= 1;
      reasons.push("MACD histogram is negative");
    }
  }

  return createResult(score, reasons.join(", "));
}

function evaluatePricePosition(price, indicators) {
  const currentPrice = Number(price);
  const vwap = getLatestValue(indicators.vwap);
  const upperBand = getLatestValue(
    indicators.bollingerUpper,
  );
  const middleBand = getLatestValue(
    indicators.bollingerMiddle,
  );
  const lowerBand = getLatestValue(
    indicators.bollingerLower,
  );

  if (
    !Number.isFinite(currentPrice) ||
    vwap === null ||
    middleBand === null
  ) {
    return createResult(
      0,
      "Waiting for VWAP and Bollinger Bands",
    );
  }

  let score = 0;
  const reasons = [];

  if (currentPrice > vwap) {
    score += 1;
    reasons.push("price is above VWAP");
  } else {
    score -= 1;
    reasons.push("price is below VWAP");
  }

  if (currentPrice > middleBand) {
    score += 1;
    reasons.push("price is above the Bollinger midpoint");
  } else {
    score -= 1;
    reasons.push("price is below the Bollinger midpoint");
  }

  if (upperBand !== null && currentPrice >= upperBand) {
    score -= 1;
    reasons.push("price has reached the upper band");
  }

  if (lowerBand !== null && currentPrice <= lowerBand) {
    score += 1;
    reasons.push("price has reached the lower band");
  }

  return createResult(score, reasons.join(", "));
}

function evaluateVolume(candles) {
  if (!Array.isArray(candles) || candles.length < 21) {
    return createResult(
      0,
      "Waiting for enough volume history",
    );
  }

  const latestCandle = candles[candles.length - 1];
  const previousCandles = candles.slice(-21, -1);

  const currentVolume = Number(latestCandle.volume);

  const averageVolume =
    previousCandles.reduce(
      (total, candle) => total + Number(candle.volume),
      0,
    ) / previousCandles.length;

  if (
    !Number.isFinite(currentVolume) ||
    !Number.isFinite(averageVolume) ||
    averageVolume <= 0
  ) {
    return createResult(0, "Volume data unavailable");
  }

  const volumeRatio = currentVolume / averageVolume;

  const bullishCandle =
    Number(latestCandle.close) >=
    Number(latestCandle.open);

  if (volumeRatio >= 1.5 && bullishCandle) {
    return createResult(
      2,
      `Strong bullish volume at ${volumeRatio.toFixed(
        2,
      )}× average`,
    );
  }

  if (volumeRatio >= 1.5 && !bullishCandle) {
    return createResult(
      -2,
      `Strong bearish volume at ${volumeRatio.toFixed(
        2,
      )}× average`,
    );
  }

  if (volumeRatio >= 1 && bullishCandle) {
    return createResult(
      1,
      `Bullish volume at ${volumeRatio.toFixed(
        2,
      )}× average`,
    );
  }

  if (volumeRatio >= 1 && !bullishCandle) {
    return createResult(
      -1,
      `Bearish volume at ${volumeRatio.toFixed(
        2,
      )}× average`,
    );
  }

  return createResult(
    0,
    `Low volume at ${volumeRatio.toFixed(2)}× average`,
  );
}

function evaluateVolatility(price, indicators) {
  const currentPrice = Number(price);
  const atr = getLatestValue(indicators.atr);

  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    atr === null
  ) {
    return {
      score: 0,
      label: "Waiting",
      percentage: null,
      reason: "Waiting for ATR history",
    };
  }

  const percentage = (atr / currentPrice) * 100;

  if (percentage >= 3) {
    return {
      score: -1,
      label: "Very high",
      percentage,
      reason: `ATR is ${percentage.toFixed(
        2,
      )}% of the current price`,
    };
  }

  if (percentage >= 1.5) {
    return {
      score: 0,
      label: "High",
      percentage,
      reason: `ATR is ${percentage.toFixed(
        2,
      )}% of the current price`,
    };
  }

  if (percentage >= 0.5) {
    return {
      score: 1,
      label: "Normal",
      percentage,
      reason: `ATR is ${percentage.toFixed(
        2,
      )}% of the current price`,
    };
  }

  return {
    score: 0,
    label: "Low",
    percentage,
    reason: `ATR is only ${percentage.toFixed(
      2,
    )}% of the current price`,
  };
}

function determineSignal(totalScore) {
  if (totalScore >= 6) {
    return {
      action: "BUY",
      label: "Strong Buy",
      className: "buy",
    };
  }

  if (totalScore >= 3) {
    return {
      action: "WAIT",
      label: "Bullish Watch",
      className: "bullish",
    };
  }

  if (totalScore <= -6) {
    return {
      action: "SELL",
      label: "Strong Sell",
      className: "sell",
    };
  }

  if (totalScore <= -3) {
    return {
      action: "WAIT",
      label: "Bearish Watch",
      className: "bearish",
    };
  }

  return {
    action: "WAIT",
    label: "Neutral",
    className: "neutral",
  };
}

export function calculateTradingSignal({
  price,
  candles = [],
  indicators = {},
}) {
  const trend = evaluateTrend(price, indicators);
  const momentum = evaluateMomentum(indicators);

  const pricePosition = evaluatePricePosition(
    price,
    indicators,
  );

  const volume = evaluateVolume(candles);

  const volatility = evaluateVolatility(
    price,
    indicators,
  );

  const totalScore =
    trend.score +
    momentum.score +
    pricePosition.score +
    volume.score +
    volatility.score;

  const maximumScore = 13;

  const confidence = Math.min(
    Math.round(
      (Math.abs(totalScore) / maximumScore) * 100,
    ),
    100,
  );

  return {
    ...determineSignal(totalScore),
    totalScore,
    maximumScore,
    confidence,
    trend,
    momentum,
    pricePosition,
    volume,
    volatility,
  };
}