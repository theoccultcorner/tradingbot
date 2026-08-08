export const DEFAULT_STRATEGY_CONFIG = {
  buyThreshold: 60,
  sellThreshold: -60,
  watchThreshold: 30,
  weights: {
    trend: 30,
    momentum: 25,
    pricePosition: 15,
    volume: 15,
    trendStrength: 10,
    volatility: 5,
  },
  regime: {
    strongTrendAdx: 25,
    weakTrendAdx: 18,
    highVolatilityAtrPercent: 2,
    lowVolatilityAtrPercent: 0.4,
  },
};

function latestValue(series) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const last = series[series.length - 1];
  const value = typeof last === "object" ? Number(last.value) : Number(last);
  return Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function weighted(rawScore, rawMax, weight) {
  return rawMax > 0 ? clamp(rawScore / rawMax, -1, 1) * weight : 0;
}

function trendFactor(price, indicators) {
  const p = Number(price);
  const e9 = latestValue(indicators.ema9);
  const e21 = latestValue(indicators.ema21);
  const e50 = latestValue(indicators.ema50);
  const e200 = latestValue(indicators.ema200);
  if (!Number.isFinite(p) || e9 === null || e21 === null || e50 === null) {
    return { rawScore: 0, rawMax: 4, reason: "Waiting for EMA data" };
  }
  let score = 0;
  const reasons = [];
  score += p > e9 ? 1 : -1;
  reasons.push(p > e9 ? "price above EMA 9" : "price below EMA 9");
  score += e9 > e21 ? 1 : -1;
  reasons.push(e9 > e21 ? "EMA 9 above EMA 21" : "EMA 9 below EMA 21");
  score += e21 > e50 ? 1 : -1;
  reasons.push(e21 > e50 ? "EMA 21 above EMA 50" : "EMA 21 below EMA 50");
  if (e200 !== null) {
    score += e50 > e200 ? 1 : -1;
    reasons.push(e50 > e200 ? "EMA 50 above EMA 200" : "EMA 50 below EMA 200");
  }
  return { rawScore: score, rawMax: 4, reason: reasons.join(", ") };
}

function momentumFactor(indicators) {
  const rsi = latestValue(indicators.rsi);
  const macd = latestValue(indicators.macd);
  const signal = latestValue(indicators.macdSignal);
  const histogram = latestValue(indicators.macdHistogram);
  if (rsi === null || macd === null || signal === null) {
    return { rawScore: 0, rawMax: 3, reason: "Waiting for RSI and MACD data" };
  }
  let score = 0;
  const reasons = [];
  if (rsi >= 50 && rsi <= 65) {
    score += 1;
    reasons.push("RSI supports bullish momentum");
  } else if (rsi >= 35 && rsi < 50) {
    score -= 1;
    reasons.push("RSI momentum is weak");
  } else if (rsi > 70) {
    score -= 1;
    reasons.push("RSI is overbought");
  } else if (rsi < 30) {
    score += 1;
    reasons.push("RSI is oversold");
  } else reasons.push("RSI is neutral");
  score += macd > signal ? 1 : -1;
  reasons.push(macd > signal ? "MACD above signal" : "MACD below signal");
  if (histogram !== null) {
    score += histogram > 0 ? 1 : -1;
    reasons.push(histogram > 0 ? "MACD histogram positive" : "MACD histogram negative");
  }
  return { rawScore: score, rawMax: 3, reason: reasons.join(", ") };
}

function pricePositionFactor(price, indicators) {
  const p = Number(price);
  const vwap = latestValue(indicators.vwap);
  const upper = latestValue(indicators.bollingerUpper);
  const middle = latestValue(indicators.bollingerMiddle);
  const lower = latestValue(indicators.bollingerLower);
  if (!Number.isFinite(p) || vwap === null || middle === null) {
    return { rawScore: 0, rawMax: 3, reason: "Waiting for VWAP and Bollinger data" };
  }
  let score = 0;
  const reasons = [];
  score += p > vwap ? 1 : -1;
  reasons.push(p > vwap ? "price above VWAP" : "price below VWAP");
  score += p > middle ? 1 : -1;
  reasons.push(p > middle ? "price above Bollinger midpoint" : "price below Bollinger midpoint");
  if (upper !== null && p >= upper) {
    score -= 1;
    reasons.push("price stretched near upper band");
  } else if (lower !== null && p <= lower) {
    score += 1;
    reasons.push("price near lower band");
  } else reasons.push("price inside Bollinger range");
  return { rawScore: score, rawMax: 3, reason: reasons.join(", ") };
}

function volumeFactor(candles) {
  if (!Array.isArray(candles) || candles.length < 21) {
    return { rawScore: 0, rawMax: 2, reason: "Waiting for volume history", ratio: null };
  }
  const last = candles[candles.length - 1];
  const previous = candles.slice(-21, -1);
  const current = Number(last.volume);
  const average = previous.reduce((sum, c) => sum + Number(c.volume), 0) / previous.length;
  if (!Number.isFinite(current) || !Number.isFinite(average) || average <= 0) {
    return { rawScore: 0, rawMax: 2, reason: "Volume unavailable", ratio: null };
  }
  const ratio = current / average;
  const bullish = Number(last.close) >= Number(last.open);
  const rawScore = ratio >= 1.5 ? (bullish ? 2 : -2) : ratio >= 1 ? (bullish ? 1 : -1) : 0;
  return {
    rawScore,
    rawMax: 2,
    ratio,
    reason: `${bullish ? "Bullish" : "Bearish"} volume at ${ratio.toFixed(2)}x average`,
  };
}

function regime(price, indicators, config) {
  const p = Number(price);
  const adx = latestValue(indicators.adx);
  const atr = latestValue(indicators.atr);
  const e50 = latestValue(indicators.ema50);
  const e200 = latestValue(indicators.ema200);
  const atrPercent = Number.isFinite(p) && p > 0 && atr !== null ? atr / p * 100 : null;
  const trend = adx === null ? "unknown" : adx >= config.regime.strongTrendAdx ? "strong-trend" : adx >= config.regime.weakTrendAdx ? "weak-trend" : "range";
  const direction = e50 !== null && e200 !== null ? (e50 > e200 ? "bullish" : e50 < e200 ? "bearish" : "neutral") : "neutral";
  const volatility = atrPercent === null ? "unknown" : atrPercent >= config.regime.highVolatilityAtrPercent ? "high" : atrPercent <= config.regime.lowVolatilityAtrPercent ? "low" : "normal";
  return { trend, direction, volatility, adx, atrPercent, label: `${direction} ${trend}, ${volatility} volatility` };
}

function trendStrengthFactor(indicators, marketRegime) {
  const adx = latestValue(indicators.adx);
  if (adx === null) return { rawScore: 0, rawMax: 2, reason: "Waiting for ADX data" };
  const direction = marketRegime.direction === "bearish" ? -1 : 1;
  if (adx >= 30) return { rawScore: 2 * direction, rawMax: 2, reason: `Strong ${marketRegime.direction} trend, ADX ${adx.toFixed(1)}` };
  if (adx >= 20) return { rawScore: 1 * direction, rawMax: 2, reason: `Developing ${marketRegime.direction} trend, ADX ${adx.toFixed(1)}` };
  return { rawScore: 0, rawMax: 2, reason: `Weak trend, ADX ${adx.toFixed(1)}` };
}

function volatilityFactor(price, indicators, marketRegime) {
  const p = Number(price);
  const atr = latestValue(indicators.atr);
  if (!Number.isFinite(p) || p <= 0 || atr === null) {
    return { rawScore: 0, rawMax: 1, label: "Waiting", percentage: null, reason: "Waiting for ATR data" };
  }
  const percentage = atr / p * 100;
  if (marketRegime.volatility === "high") return { rawScore: -1, rawMax: 1, label: "High", percentage, reason: `ATR is ${percentage.toFixed(2)}% of price` };
  if (marketRegime.volatility === "low") return { rawScore: 0, rawMax: 1, label: "Low", percentage, reason: `ATR is ${percentage.toFixed(2)}% of price` };
  return { rawScore: 1, rawMax: 1, label: "Normal", percentage, reason: `ATR is ${percentage.toFixed(2)}% of price` };
}

function classify(score, config) {
  if (score >= config.buyThreshold) return { action: "BUY", label: "Strong Buy", className: "buy" };
  if (score <= config.sellThreshold) return { action: "SELL", label: "Strong Sell", className: "sell" };
  if (score >= config.watchThreshold) return { action: "WAIT", label: "Bullish Watch", className: "bullish" };
  if (score <= -config.watchThreshold) return { action: "WAIT", label: "Bearish Watch", className: "bearish" };
  return { action: "WAIT", label: "Neutral", className: "neutral" };
}

export function calculateTradingSignal({ price, candles = [], indicators = {}, config = {} }) {
  const merged = {
    ...DEFAULT_STRATEGY_CONFIG,
    ...config,
    weights: { ...DEFAULT_STRATEGY_CONFIG.weights, ...(config.weights || {}) },
    regime: { ...DEFAULT_STRATEGY_CONFIG.regime, ...(config.regime || {}) },
  };
  const marketRegime = regime(price, indicators, merged);
  const raw = {
    trend: trendFactor(price, indicators),
    momentum: momentumFactor(indicators),
    pricePosition: pricePositionFactor(price, indicators),
    volume: volumeFactor(candles),
    trendStrength: trendStrengthFactor(indicators, marketRegime),
    volatility: volatilityFactor(price, indicators, marketRegime),
  };
  const factors = Object.fromEntries(
    Object.entries(raw).map(([name, factor]) => [
      name,
      { ...factor, weightedScore: weighted(factor.rawScore, factor.rawMax, merged.weights[name]) },
    ]),
  );
  let score = Object.values(factors).reduce((sum, factor) => sum + factor.weightedScore, 0);
  if (marketRegime.trend === "range" && Math.abs(score) > merged.watchThreshold) score *= 0.75;
  if (marketRegime.volatility === "high") score *= 0.85;
  score = Math.round(clamp(score, -100, 100));
  const summary = classify(score, merged);
  return {
    ...summary,
    score,
    totalScore: score,
    maximumScore: 100,
    confidence: Math.min(Math.abs(score), 100),
    regime: marketRegime,
    trend: { score: Math.round(factors.trend.weightedScore), reason: factors.trend.reason },
    momentum: { score: Math.round(factors.momentum.weightedScore), reason: factors.momentum.reason },
    pricePosition: { score: Math.round(factors.pricePosition.weightedScore), reason: factors.pricePosition.reason },
    volume: { score: Math.round(factors.volume.weightedScore), reason: factors.volume.reason, ratio: factors.volume.ratio },
    trendStrength: { score: Math.round(factors.trendStrength.weightedScore), reason: factors.trendStrength.reason },
    volatility: { score: Math.round(factors.volatility.weightedScore), label: factors.volatility.label, percentage: factors.volatility.percentage, reason: factors.volatility.reason },
    factors,
    config: merged,
    calculatedAt: Date.now(),
  };
}
