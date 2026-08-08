function formatMoney(
  value,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    },
  );
}

function formatPercent(
  value,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return `${number.toFixed(
    2,
  )}%`;
}

function getClass(
  value,
) {
  const number =
    Number(value);

  if (number > 0) {
    return "positive";
  }

  if (number < 0) {
    return "negative";
  }

  return "neutral";
}

function PerformanceTable({
  title,
  rows,
}) {
  return (
    <div className="performance-group">
      <h3>{title}</h3>

      <div className="performance-table">
        <div className="performance-row performance-header">
          <span>Name</span>
          <span>Trades</span>
          <span>Win rate</span>
          <span>P/L</span>
          <span>Fees</span>
        </div>

        {rows.length > 0 ? (
          rows.map(
            (row) => (
              <div
                className="performance-row"
                key={
                  row.name
                }
              >
                <strong>
                  {row.name}
                </strong>

                <span>
                  {
                    row.trades
                  }
                </span>

                <span>
                  {formatPercent(
                    row.winRate,
                  )}
                </span>

                <strong
                  className={getClass(
                    row.realizedProfit,
                  )}
                >
                  {formatMoney(
                    row.realizedProfit,
                  )}
                </strong>

                <span>
                  {formatMoney(
                    row.fees,
                  )}
                </span>
              </div>
            ),
          )
        ) : (
          <p className="empty-state">
            No closed trades yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ServerPerformancePanel({
  performance,
}) {
  const {
    summary,
    history,
    loading,
    error,
    loadPerformance,
    downloadCsv,
  } = performance;

  if (
    loading &&
    !summary
  ) {
    return (
      <section className="panel">
        <p className="empty-state">
          Loading server performance…
        </p>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="panel">
        <p className="scanner-error">
          {error ||
            "Performance data is unavailable."}
        </p>
      </section>
    );
  }

  const latest =
    summary.latestEquity;

  return (
    <section className="panel server-performance-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            SQLITE PERFORMANCE
          </p>

          <h2>
            Server Performance
          </h2>
        </div>

        <div className="performance-actions">
          <button
            type="button"
            onClick={
              loadPerformance
            }
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={
              downloadCsv
            }
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="analytics-primary-grid">
        <article className="analytics-card">
          <span>
            Latest equity
          </span>

          <strong>
            {formatMoney(
              latest?.equity,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Total profit
          </span>

          <strong
            className={getClass(
              latest?.totalProfit,
            )}
          >
            {formatMoney(
              latest?.totalProfit,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Daily realized P/L
          </span>

          <strong
            className={getClass(
              summary.realizedProfitToday,
            )}
          >
            {formatMoney(
              summary.realizedProfitToday,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Win rate
          </span>

          <strong>
            {formatPercent(
              summary.winRate,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Profit factor
          </span>

          <strong>
            {summary.profitFactor ===
            null
              ? "∞"
              : Number(
                  summary.profitFactor,
                ).toFixed(2)}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Maximum drawdown
          </span>

          <strong className="negative">
            {formatPercent(
              summary.maximumDrawdownPercent,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Closed trades
          </span>

          <strong>
            {
              summary.closedTrades
            }
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Total fees
          </span>

          <strong>
            {formatMoney(
              summary.totalFees,
            )}
          </strong>
        </article>
      </div>

      <div className="performance-note">
        <span>
          Equity snapshots
        </span>

        <strong>
          {
            history.length
          }
        </strong>

       <small>
  The server records periodic equity snapshots for performance tracking.
       </small>
      </div>

      <div className="performance-groups">
        <PerformanceTable
          title="Performance by coin"
          rows={
            summary.bySymbol ||
            []
          }
        />

        <PerformanceTable
          title="Performance by timeframe"
          rows={
            summary.byTimeframe ||
            []
          }
        />
      </div>

      {error && (
        <p className="scanner-error">
          {error}
        </p>
      )}
    </section>
  );
}

export default ServerPerformancePanel;
