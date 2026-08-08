function latest(values) {
  return values[values.length - 1];
}

function emaValues(values, period) {
  if (!Array.isArray(values) || values.length < period) return [];
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const output = new Array(period - 1).fill(null);
  output.push(ema);
  for (let i = period; i < values.length; i += 1) {
    ema = (values[i] - ema) * multiplier + ema;
    output.push(ema);
  }
  return output;
}

export function calculateEMA(candles, period) {
  if (!Array.isArray(candles) || candles.length < period) return [];
  const closes = candles.map((c) => Number(c.close));
  const values = emaValues(closes, period);
  return values
    .map((value, index) =>
      Number.isFinite(value)
        ? { time: Number(candles[index].time), value }
        : null,
    )
    .filter(Boolean);
}

export function calculateRSI(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) return [];
  const closes = candles.map((c) => Number(c.close));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const result = [];
  const value = () => (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  result.push({ time: Number(candles[period].time), value: value() });
  for (let i = period + 1; i < candles.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ time: Number(candles[i].time), value: value() });
  }
  return result;
}

export function calculateMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
  if (!Array.isArray(candles) || candles.length < slow + signalPeriod) {
    return { macd: [], signal: [], histogram: [] };
  }
  const closes = candles.map((c) => Number(c.close));
  const fastValues = emaValues(closes, fast);
  const slowValues = emaValues(closes, slow);
  const raw = closes.map((_, i) =>
    Number.isFinite(fastValues[i]) && Number.isFinite(slowValues[i])
      ? fastValues[i] - slowValues[i]
      : null,
  );
  const valid = [];
  const indexes = [];
  raw.forEach((v, i) => {
    if (Number.isFinite(v)) {
      valid.push(v);
      indexes.push(i);
    }
  });
  const signalValues = emaValues(valid, signalPeriod);
  const macd = [];
  const signal = [];
  const histogram = [];
  valid.forEach((v, i) => {
    const time = Number(candles[indexes[i]].time);
    macd.push({ time, value: v });
    if (Number.isFinite(signalValues[i])) {
      signal.push({ time, value: signalValues[i] });
      histogram.push({ time, value: v - signalValues[i] });
    }
  });
  return { macd, signal, histogram };
}

export function calculateVWAP(candles) {
  let pv = 0;
  let volume = 0;
  return (candles || []).map((c) => {
    const typical = (Number(c.high) + Number(c.low) + Number(c.close)) / 3;
    const v = Number(c.volume);
    pv += typical * v;
    volume += v;
    return volume > 0 ? { time: Number(c.time), value: pv / volume } : null;
  }).filter(Boolean);
}

export function calculateBollingerBands(candles, period = 20, deviations = 2) {
  const upper = [];
  const middle = [];
  const lower = [];
  if (!Array.isArray(candles) || candles.length < period) return { upper, middle, lower };
  const closes = candles.map((c) => Number(c.close));
  for (let i = period - 1; i < candles.length; i += 1) {
    const window = closes.slice(i - period + 1, i + 1);
    const average = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((sum, v) => sum + (v - average) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const time = Number(candles[i].time);
    middle.push({ time, value: average });
    upper.push({ time, value: average + sd * deviations });
    lower.push({ time, value: average - sd * deviations });
  }
  return { upper, middle, lower };
}

export function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) return [];
  const tr = [];
  for (let i = 1; i < candles.length; i += 1) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const prevClose = Number(candles[i - 1].close);
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [{ time: Number(candles[period].time), value: atr }];
  for (let i = period; i < tr.length; i += 1) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result.push({ time: Number(candles[i + 1].time), value: atr });
  }
  return result;
}

export function calculateADX(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period * 2 + 1) return [];
  const tr = [];
  const plusDM = [];
  const minusDM = [];
  for (let i = 1; i < candles.length; i += 1) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const prevHigh = Number(candles[i - 1].high);
    const prevLow = Number(candles[i - 1].low);
    const prevClose = Number(candles[i - 1].close);
    const up = high - prevHigh;
    const down = prevLow - low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let smoothTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  const dx = [];
  const times = [];
  for (let i = period; i < tr.length; i += 1) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + tr[i];
      smoothPlus = smoothPlus - smoothPlus / period + plusDM[i];
      smoothMinus = smoothMinus - smoothMinus / period + minusDM[i];
    }
    if (smoothTR <= 0) continue;
    const plusDI = 100 * smoothPlus / smoothTR;
    const minusDI = 100 * smoothMinus / smoothTR;
    const denominator = plusDI + minusDI;
    dx.push(denominator === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / denominator);
    times.push(Number(candles[i + 1].time));
  }
  if (dx.length < period) return [];
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [{ time: times[period - 1], value: adx }];
  for (let i = period; i < dx.length; i += 1) {
    adx = (adx * (period - 1) + dx[i]) / period;
    result.push({ time: times[i], value: adx });
  }
  return result;
}

export function calculateAllIndicators(candles) {
  const macd = calculateMACD(candles);
  const bb = calculateBollingerBands(candles);
  return {
    ema9: calculateEMA(candles, 9),
    ema21: calculateEMA(candles, 21),
    ema50: calculateEMA(candles, 50),
    ema200: calculateEMA(candles, 200),
    rsi: calculateRSI(candles),
    macd: macd.macd,
    macdSignal: macd.signal,
    macdHistogram: macd.histogram,
    vwap: calculateVWAP(candles),
    bollingerUpper: bb.upper,
    bollingerMiddle: bb.middle,
    bollingerLower: bb.lower,
    atr: calculateATR(candles),
    adx: calculateADX(candles),
  };
}
