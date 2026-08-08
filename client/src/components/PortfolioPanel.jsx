function formatMoney(value, decimals = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatQuantity(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function getProfitClass(value) {
  const number = Number(value);

  if (number > 0) {
    return "positive";
  }

  if (number < 0) {
    return "negative";
  }

  return "neutral";
}

function PortfolioPanel({
  portfolio,
  onReset,
}) {
  return (
    <section className="panel portfolio-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            PAPER ACCOUNT
          </p>

          <h2>Portfolio</h2>
        </div>

        <button
          type="button"
          className="reset-portfolio-button"
          onClick={onReset}
        >
          Reset
        </button>
      </div>

      <div className="portfolio-summary">
        <article>
          <span>Total equity</span>
          <strong>
            {formatMoney(portfolio.totalEquity)}
          </strong>
        </article>

        <article>
          <span>Available cash</span>
          <strong>{formatMoney(portfolio.cash)}</strong>
        </article>

        <article>
          <span>Market value</span>
          <strong>
            {formatMoney(portfolio.totalMarketValue)}
          </strong>
        </article>

        <article>
          <span>Total return</span>

          <strong
            className={getProfitClass(
              portfolio.totalProfit,
            )}
          >
            {formatMoney(portfolio.totalProfit)}
            {" · "}
            {formatPercent(
              portfolio.totalReturnPercent,
            )}
          </strong>
        </article>

        <article>
          <span>Realized P/L</span>

          <strong
            className={getProfitClass(
              portfolio.realizedProfit,
            )}
          >
            {formatMoney(portfolio.realizedProfit)}
          </strong>
        </article>

        <article>
          <span>Unrealized P/L</span>

          <strong
            className={getProfitClass(
              portfolio.unrealizedProfit,
            )}
          >
            {formatMoney(portfolio.unrealizedProfit)}
          </strong>
        </article>
      </div>

      <div className="portfolio-section-heading">
        <h3>Open positions</h3>

        <span>
          Fee: {(portfolio.feeRate * 100).toFixed(2)}%
        </span>
      </div>

      <div className="positions-table">
        <div className="positions-header">
          <span>Asset</span>
          <span>Quantity</span>
          <span>Entry</span>
          <span>Price</span>
          <span>Value</span>
          <span>P/L</span>
        </div>

        {portfolio.positions.length > 0 ? (
          portfolio.positions.map((position) => (
            <div
              className="position-row"
              key={position.symbol}
            >
              <strong>{position.asset}</strong>

              <span>
                {formatQuantity(position.quantity)}
              </span>

              <span>
                {formatMoney(
                  position.averageEntryPrice,
                  4,
                )}
              </span>

              <span>
                {formatMoney(position.currentPrice, 4)}
              </span>

              <span>
                {formatMoney(position.marketValue)}
              </span>

              <span
                className={getProfitClass(
                  position.unrealizedProfit,
                )}
              >
                {formatMoney(
                  position.unrealizedProfit,
                )}
                <small>
                  {formatPercent(
                    position.unrealizedPercent,
                  )}
                </small>
              </span>
            </div>
          ))
        ) : (
          <p className="empty-state">
            No open paper positions.
          </p>
        )}
      </div>

      <div className="portfolio-section-heading">
        <h3>Paper trade history</h3>

        <span>
          {portfolio.trades.length} trades
        </span>
      </div>

      <div className="portfolio-trades">
        <div className="portfolio-trades-header">
          <span>Side</span>
          <span>Symbol</span>
          <span>Quantity</span>
          <span>Price</span>
          <span>Fee</span>
          <span>P/L</span>
          <span>Time</span>
        </div>

        {portfolio.trades.length > 0 ? (
          portfolio.trades
            .slice(0, 50)
            .map((trade) => (
              <div
                className="portfolio-trade-row"
                key={trade.id}
              >
                <strong
                  className={
                    trade.side === "BUY"
                      ? "positive"
                      : "negative"
                  }
                >
                  {trade.side}
                </strong>

                <span>{trade.symbol}</span>

                <span>
                  {formatQuantity(trade.quantity)}
                </span>

                <span>
                  {formatMoney(trade.price, 4)}
                </span>

                <span>{formatMoney(trade.fee)}</span>

                <span
                  className={getProfitClass(
                    trade.realizedProfit,
                  )}
                >
                  {trade.side === "SELL"
                    ? formatMoney(
                        trade.realizedProfit,
                      )
                    : "—"}
                </span>

                <time>
                  {new Date(
                    trade.timestamp,
                  ).toLocaleString()}
                </time>
              </div>
            ))
        ) : (
          <p className="empty-state">
            No paper trades have been placed.
          </p>
        )}
      </div>
    </section>
  );
}

export default PortfolioPanel;