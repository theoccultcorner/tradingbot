function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatQuantity(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  });
}

function formatTradeTime(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeTrade(trade) {
  const price = Number(trade?.price ?? trade?.p);
  const quantity = Number(
    trade?.quantity ?? trade?.qty ?? trade?.q,
  );

  /*
   * Binance trade streams provide "m":
   * true means the buyer is the market maker.
   * We use it here to estimate whether the taker side was a sell.
   */
  const side =
    trade?.side ||
    (trade?.buyerIsMaker ?? trade?.m ? "sell" : "buy");

  return {
    id:
      trade?.id ??
      trade?.tradeId ??
      trade?.t ??
      `${trade?.time}-${price}-${quantity}`,
    price,
    quantity,
    time:
      trade?.time ??
      trade?.timestamp ??
      trade?.tradeTime ??
      trade?.T,
    side: String(side).toLowerCase(),
  };
}

function RecentTrades({
  trades = [],
  limit = 25,
}) {
  const visibleTrades = trades
    .slice(0, limit)
    .map(normalizeTrade);

  return (
    <section className="panel recent-trades-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">TIME AND SALES</p>
          <h2>Recent Trades</h2>
        </div>

        <span className="trade-count">
          {visibleTrades.length} trades
        </span>
      </div>

      <div className="trades-header">
        <span>Price</span>
        <span>Amount</span>
        <span>Time</span>
      </div>

      <div className="trades-list">
        {visibleTrades.length > 0 ? (
          visibleTrades.map((trade) => (
            <div
              className={`trade-row ${trade.side}`}
              key={trade.id}
            >
              <span className="trade-price">
                ${formatPrice(trade.price)}
              </span>

              <span>
                {formatQuantity(trade.quantity)}
              </span>

              <time>
                {formatTradeTime(trade.time)}
              </time>
            </div>
          ))
        ) : (
          <p className="empty-state">
            Waiting for live trades…
          </p>
        )}
      </div>
    </section>
  );
}

export default RecentTrades;