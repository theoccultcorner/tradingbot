function getLatestValue(data) {
  if (Array.isArray(data)) {
    const latestItem = data[data.length - 1];

    if (
      latestItem &&
      typeof latestItem === "object" &&
      "value" in latestItem
    ) {
      return Number(latestItem.value);
    }

    return Number(latestItem);
  }

  return Number(data);
}

function formatIndicator(value, decimals = 2) {
  const number = getLatestValue(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getRsiSignal(rsi) {
  const value = getLatestValue(rsi);

  if (!Number.isFinite(value)) {
    return {
      label: "Waiting",
      className: "neutral",
    };
  }

  if (value >= 70) {
    return {
      label: "Overbought",
      className: "negative",
    };
  }

  if (value <= 30) {
    return {
      label: "Oversold",
      className: "positive",
    };
  }

  return {
    label: "Neutral",
    className: "neutral",
  };
}

function getMacdSignal(macd, signal) {
  const macdValue = getLatestValue(macd);
  const signalValue = getLatestValue(signal);

  if (
    !Number.isFinite(macdValue) ||
    !Number.isFinite(signalValue)
  ) {
    return {
      label: "Waiting",
      className: "neutral",
    };
  }

  if (macdValue > signalValue) {
    return {
      label: "Bullish",
      className: "positive",
    };
  }

  if (macdValue < signalValue) {
    return {
      label: "Bearish",
      className: "negative",
    };
  }

  return {
    label: "Neutral",
    className: "neutral",
  };
}

function getTrendSignal(price, ema21, ema50, ema200) {
  const currentPrice = Number(price);
  const shortEma = getLatestValue(ema21);
  const mediumEma = getLatestValue(ema50);
  const longEma = getLatestValue(ema200);

  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(shortEma) ||
    !Number.isFinite(mediumEma)
  ) {
    return {
      label: "Waiting",
      className: "neutral",
    };
  }

  if (
    currentPrice > shortEma &&
    shortEma > mediumEma &&
    (!Number.isFinite(longEma) || mediumEma > longEma)
  ) {
    return {
      label: "Bullish",
      className: "positive",
    };
  }

  if (
    currentPrice < shortEma &&
    shortEma < mediumEma &&
    (!Number.isFinite(longEma) || mediumEma < longEma)
  ) {
    return {
      label: "Bearish",
      className: "negative",
    };
  }

  return {
    label: "Mixed",
    className: "neutral",
  };
}

function IndicatorCard({
  name,
  value,
  secondaryValue,
  signal,
}) {
  return (
    <article className="indicator-card">
      <div className="indicator-card-header">
        <span>{name}</span>

        {signal && (
          <span className={`indicator-signal ${signal.className}`}>
            {signal.label}
          </span>
        )}
      </div>

      <strong>{value}</strong>

      {secondaryValue && (
        <small>{secondaryValue}</small>
      )}
    </article>
  );
}

function IndicatorPanel({
  price = null,
  indicators = {},
}) {
  const rsiSignal = getRsiSignal(indicators.rsi);

  const macdSignal = getMacdSignal(
    indicators.macd,
    indicators.macdSignal,
  );

  const trendSignal = getTrendSignal(
    price,
    indicators.ema21,
    indicators.ema50,
    indicators.ema200,
  );

  return (
    <section className="panel indicator-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">TECHNICAL ANALYSIS</p>
          <h2>Indicators</h2>
        </div>

        <span
          className={`overall-signal ${trendSignal.className}`}
        >
          Trend: {trendSignal.label}
        </span>
      </div>

      <div className="indicator-grid">
        <IndicatorCard
          name="EMA 9"
          value={formatIndicator(indicators.ema9, 4)}
        />

        <IndicatorCard
          name="EMA 21"
          value={formatIndicator(indicators.ema21, 4)}
        />

        <IndicatorCard
          name="EMA 50"
          value={formatIndicator(indicators.ema50, 4)}
        />

        <IndicatorCard
          name="EMA 200"
          value={formatIndicator(indicators.ema200, 4)}
        />

        <IndicatorCard
          name="RSI 14"
          value={formatIndicator(indicators.rsi, 2)}
          signal={rsiSignal}
        />

        <IndicatorCard
          name="MACD"
          value={formatIndicator(indicators.macd, 4)}
          secondaryValue={`Signal: ${formatIndicator(
            indicators.macdSignal,
            4,
          )}`}
          signal={macdSignal}
        />

        <IndicatorCard
          name="MACD histogram"
          value={formatIndicator(
            indicators.macdHistogram,
            4,
          )}
        />

        <IndicatorCard
          name="VWAP"
          value={formatIndicator(indicators.vwap, 4)}
        />

        <IndicatorCard
          name="Bollinger upper"
          value={formatIndicator(
            indicators.bollingerUpper,
            4,
          )}
        />

        <IndicatorCard
          name="Bollinger middle"
          value={formatIndicator(
            indicators.bollingerMiddle,
            4,
          )}
        />

        <IndicatorCard
          name="Bollinger lower"
          value={formatIndicator(
            indicators.bollingerLower,
            4,
          )}
        />

        <IndicatorCard
          name="ATR 14"
          value={formatIndicator(indicators.atr, 4)}
        />
      </div>

      <p className="indicator-disclaimer">
        Indicators describe market conditions but do not guarantee
        profitable trades.
      </p>
    </section>
  );
}

export default IndicatorPanel;