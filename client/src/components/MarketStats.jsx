function formatCurrency(value, maximumFractionDigits = 6) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

function formatNumber(value, maximumFractionDigits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    maximumFractionDigits,
  });
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function MarketStats({
  symbol = "SOLUSD",
  price = null,
  priceDirection = "same",
  bid = null,
  ask = null,
  spread = null,
  priceChangePercent = null,
  high24h = null,
  low24h = null,
  volume24h = null,
  quoteVolume24h = null,
  connectionStatus = "Connecting...",
}) {
  const changeClass =
    Number(priceChangePercent) > 0
      ? "positive"
      : Number(priceChangePercent) < 0
        ? "negative"
        : "";

  return (
    <section className="panel market-stats-panel">
      <div className="market-heading">
        <div>
          <p className="panel-eyebrow">MARKET</p>
          <h2>{symbol.replace("USD", "/USD")}</h2>
        </div>

        <div
          className={`connection-status ${
            connectionStatus === "Live" ? "connected" : ""
          }`}
        >
          <span className="status-dot" />
          {connectionStatus}
        </div>
      </div>

      <div className={`main-market-price ${priceDirection}`}>
        {formatCurrency(price)}

        {priceDirection === "up" && (
          <span className="price-arrow">▲</span>
        )}

        {priceDirection === "down" && (
          <span className="price-arrow">▼</span>
        )}
      </div>

      <div className={`market-change ${changeClass}`}>
        {formatPercent(priceChangePercent)} today
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Best bid</span>
          <strong className="positive">
            {formatCurrency(bid)}
          </strong>
        </article>

        <article className="stat-card">
          <span>Best ask</span>
          <strong className="negative">
            {formatCurrency(ask)}
          </strong>
        </article>

        <article className="stat-card">
          <span>Spread</span>
          <strong>{formatCurrency(spread, 8)}</strong>
        </article>

        <article className="stat-card">
          <span>24h high</span>
          <strong>{formatCurrency(high24h)}</strong>
        </article>

        <article className="stat-card">
          <span>24h low</span>
          <strong>{formatCurrency(low24h)}</strong>
        </article>

        <article className="stat-card">
          <span>24h SOL volume</span>
          <strong>{formatNumber(volume24h)}</strong>
        </article>

        <article className="stat-card stat-card-wide">
          <span>24h USD volume</span>
          <strong>{formatCurrency(quoteVolume24h, 2)}</strong>
        </article>
      </div>
    </section>
  );
}

export default MarketStats;