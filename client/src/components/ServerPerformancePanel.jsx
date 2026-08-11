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
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        2,
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

  return `${
    number >= 0
      ? "+"
      : ""
  }${number.toFixed(
    2,
  )}%`;
}

function formatNumber(
  value,
  decimals = 2,
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

  return number.toFixed(
    decimals,
  );
}

function formatProbability(
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

  return `${
    (
      number *
      100
    ).toFixed(
      2,
    )
  }%`;
}

function getClass(
  value,
) {
  const number =
    Number(value);

  if (
    number >
    0
  ) {
    return "positive";
  }

  if (
    number <
    0
  ) {
    return "negative";
  }

  return "neutral";
}

function getProfitFactorClass(
  rating,
) {
  switch (
    String(
      rating ||
        "",
    ).toUpperCase()
  ) {
    case "VERY STRONG":
    case "STRONG":
      return "positive";

    case "LOSING":
      return "negative";

    case "WEAK":
    case "IMPROVING":
    case "INSUFFICIENT SAMPLE":
      return "neutral";

    default:
      return "neutral";
  }
}

function formatProfitFactor(
  value,
) {
  if (
    value ===
    null
  ) {
    return "∞";
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toFixed(
    2,
  );
}

function PerformanceTable({
  title,
  rows = [],
}) {
  return (
    <div className="performance-table-wrapper">
      <div className="portfolio-section-heading">
        <h3>
          {title}
        </h3>
      </div>

      <div className="performance-table">
        <div className="performance-row performance-header performance-row-expanded">
          <span>
            Name
          </span>

          <span>
            Trades
          </span>

          <span>
            Win rate
          </span>

          <span>
            Profit factor
          </span>

          <span>
            Rating
          </span>

          <span>
            P/L
          </span>

          <span>
            Fees
          </span>
        </div>

        {rows.length >
        0 ? (
          rows.map(
            (
              row,
            ) => (
              <div
                className="performance-row performance-row-expanded"
                key={
                  row.name
                }
              >
                <strong>
                  {
                    row.name
                  }
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

                <strong>
                  {formatProfitFactor(
                    row.profitFactor,
                  )}
                </strong>

                <span
                  className={getProfitFactorClass(
                    row.profitFactorRating,
                  )}
                >
                  {row.profitFactorRating ||
                    "—"}
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

function PeriodPerformanceCard({
  label,
  data,
}) {
  const period =
    data ||
    {};

  const profit =
    Number(
      period.profit,
    );

  const returnPercent =
    Number(
      period.returnPercent,
    );

  return (
    <article className="analytics-card">
      <span>
        {label}
      </span>

      <strong
        className={getClass(
          profit,
        )}
      >
        {formatMoney(
          profit,
        )}
      </strong>

      <small>
        {formatPercent(
          returnPercent,
        )}
        {" · "}
        {period.closedTrades ??
          0}
        {" closed · "}
        {formatPercent(
          period.winRate,
        )}
        {" win rate"}
      </small>

      <small>
        {period.completePeriod
          ? "Full period available"
          : "Partial history"}
      </small>
    </article>
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
  } =
    performance;

  if (
    loading &&
    !summary
  ) {
    return (
      <section className="panel">
        <p>
          Loading server performance…
        </p>
      </section>
    );
  }

  if (
    !summary
  ) {
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

  const netProfit =
    Number(
      summary
        .netProfitAfterCosts,
    );

  const netReturn =
    Number(
      summary
        .netReturnAfterCostsPercent,
    );

  const expectancy =
    Number(
      summary
        .expectancyPerTrade,
    );

  const isProfitable =
    Number.isFinite(
      netProfit,
    ) &&
    netProfit >
      0;

  const hasPositiveExpectancy =
    Number.isFinite(
      expectancy,
    ) &&
    expectancy >
      0;

  const profitFactorRating =
    summary
      .profitFactorRating ||
    "NO DATA";

  const profitFactorSampleAdequate =
    Boolean(
      summary
        .profitFactorSampleAdequate,
    );

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

          <small>
            Real trading results including fees, estimated slippage, expectancy, profit factor, and trade quality.
          </small>
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

      {/* ===================================================
          PROFITABILITY STATUS
          =================================================== */}

      <div
        className={`profitability-status ${
          isProfitable
            ? "profitable"
            : "not-profitable"
        }`}
      >
        <div>
          <span>
            Current profitability
          </span>

          <strong
            className={getClass(
              netProfit,
            )}
          >
            {isProfitable
              ? "PROFITABLE"
              : netProfit ===
                  0
                ? "BREAK EVEN"
                : "NOT PROFITABLE"}
          </strong>
        </div>

        <div>
          <span>
            Net profit after costs
          </span>

          <strong
            className={getClass(
              netProfit,
            )}
          >
            {formatMoney(
              netProfit,
            )}
          </strong>
        </div>

        <div>
          <span>
            Net return
          </span>

          <strong
            className={getClass(
              netReturn,
            )}
          >
            {formatPercent(
              netReturn,
            )}
          </strong>
        </div>
      </div>

      {/* ===================================================
          CORE PERFORMANCE
          =================================================== */}

      <div className="analytics-primary-grid">
        <article className="analytics-card">
          <span>
            Latest equity
          </span>

          <strong>
            {formatMoney(
              latest
                ?.equity,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Gross trading profit
          </span>

          <strong
            className={getClass(
              summary
                .grossTradingProfit,
            )}
          >
            {formatMoney(
              summary
                .grossTradingProfit,
            )}
          </strong>

          <small>
            Before fees and slippage
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Profit after fees
          </span>

          <strong
            className={getClass(
              summary
                .accountProfitAfterFees,
            )}
          >
            {formatMoney(
              summary
                .accountProfitAfterFees,
            )}
          </strong>

          <small>
            Actual paper-account result
          </small>
        </article>

        <article className="analytics-card profitability-highlight">
          <span>
            Net profit after costs
          </span>

          <strong
            className={getClass(
              summary
                .netProfitAfterCosts,
            )}
          >
            {formatMoney(
              summary
                .netProfitAfterCosts,
            )}
          </strong>

          <small>
            After fees + estimated slippage
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Net return after costs
          </span>

          <strong
            className={getClass(
              summary
                .netReturnAfterCostsPercent,
            )}
          >
            {formatPercent(
              summary
                .netReturnAfterCostsPercent,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Daily realized P/L
          </span>

          <strong
            className={getClass(
              summary
                .realizedProfitToday,
            )}
          >
            {formatMoney(
              summary
                .realizedProfitToday,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Win rate
          </span>

          <strong>
            {formatPercent(
              summary
                .winRate,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Profit factor
          </span>

          <strong>
            {formatProfitFactor(
              summary
                .profitFactor,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Maximum drawdown
          </span>

          <strong className="negative">
            {formatPercent(
              -Math.abs(
                Number(
                  summary
                    .maximumDrawdownPercent,
                ) ||
                  0,
              ),
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Closed trades
          </span>

          <strong>
            {
              summary
                .closedTrades
            }
          </strong>
        </article>
      </div>

      {/* ===================================================
          ROLLING PERFORMANCE — ROADMAP #8
          =================================================== */}

      <div className="portfolio-section-heading">
        <div>
          <h3>
            Rolling Performance
          </h3>

          <small>
            Account performance over the previous 1, 7, and 30 days
          </small>
        </div>
      </div>

      <div className="analytics-primary-grid">
        <PeriodPerformanceCard
          label="1-day performance"
          data={
            summary
              .performance1d
          }
        />

        <PeriodPerformanceCard
          label="7-day performance"
          data={
            summary
              .performance7d
          }
        />

        <PeriodPerformanceCard
          label="30-day performance"
          data={
            summary
              .performance30d
          }
        />
      </div>

      {/* ===================================================
          PROFIT FACTOR INTELLIGENCE
          =================================================== */}

      <div className="portfolio-section-heading">
        <div>
          <h3>
            Profit Factor Intelligence
          </h3>

          <small>
            How much gross winning profit the strategy produces for every dollar of gross loss
          </small>
        </div>
      </div>

      <div
        className={`profitability-status ${
          profitFactorSampleAdequate &&
          (
            summary
              .profitFactor ===
              null ||
            Number(
              summary
                .profitFactor,
            ) >= 1.5
          )
            ? "profitable"
            : "not-profitable"
        }`}
      >
        <div>
          <span>
            Profit factor rating
          </span>

          <strong
            className={getProfitFactorClass(
              profitFactorRating,
            )}
          >
            {
              profitFactorRating
            }
          </strong>
        </div>

        <div>
          <span>
            Profit factor
          </span>

          <strong>
            {formatProfitFactor(
              summary
                .profitFactor,
            )}
          </strong>
        </div>

        <div>
          <span>
            Sample
          </span>

          <strong
            className={
              profitFactorSampleAdequate
                ? "positive"
                : "neutral"
            }
          >
            {summary
              .profitFactorSampleSize ??
              0}
            {" / "}
            {summary
              .profitFactorMinimumSample ??
              20}
          </strong>
        </div>
      </div>

      <div className="analytics-primary-grid">
        <article className="analytics-card">
          <span>
            Gross winning profit
          </span>

          <strong className="positive">
            {formatMoney(
              summary
                .grossWinningProfit,
            )}
          </strong>

          <small>
            Total P/L from winning exits
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Gross losing amount
          </span>

          <strong className="negative">
            {formatMoney(
              -Math.abs(
                Number(
                  summary
                    .grossLosingAmount,
                ) ||
                  0,
              ),
            )}
          </strong>

          <small>
            Total magnitude of losing exits
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Profit factor
          </span>

          <strong
            className={
              summary
                .profitFactor ===
                null ||
              Number(
                summary
                  .profitFactor,
              ) >= 1
                ? "positive"
                : "negative"
            }
          >
            {formatProfitFactor(
              summary
                .profitFactor,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Rating
          </span>

          <strong
            className={getProfitFactorClass(
              summary
                .profitFactorRating,
            )}
          >
            {summary
              .profitFactorRating ||
              "NO DATA"}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Closed-trade sample
          </span>

          <strong>
            {summary
              .profitFactorSampleSize ??
              0}
          </strong>

          <small>
            Minimum for rating:{" "}
            {summary
              .profitFactorMinimumSample ??
              20}
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Sample quality
          </span>

          <strong
            className={
              profitFactorSampleAdequate
                ? "positive"
                : "neutral"
            }
          >
            {profitFactorSampleAdequate
              ? "SUFFICIENT"
              : "NOT ENOUGH DATA"}
          </strong>
        </article>
      </div>

      {/* ===================================================
          EXPECTANCY & TRADE QUALITY
          =================================================== */}

      <div className="portfolio-section-heading">
        <div>
          <h3>
            Expectancy & Trade Quality
          </h3>

          <small>
            Statistical edge based on completed trades
          </small>
        </div>
      </div>

      <div
        className={`profitability-status ${
          hasPositiveExpectancy
            ? "profitable"
            : "not-profitable"
        }`}
      >
        <div>
          <span>
            Strategy expectancy
          </span>

          <strong
            className={getClass(
              expectancy,
            )}
          >
            {hasPositiveExpectancy
              ? "POSITIVE EDGE"
              : expectancy ===
                  0
                ? "NO EDGE YET"
                : "NEGATIVE EDGE"}
          </strong>
        </div>

        <div>
          <span>
            Expectancy / trade
          </span>

          <strong
            className={getClass(
              expectancy,
            )}
          >
            {formatMoney(
              summary
                .expectancyPerTrade,
            )}
          </strong>
        </div>

        <div>
          <span>
            Expectancy %
          </span>

          <strong
            className={getClass(
              summary
                .expectancyPercent,
            )}
          >
            {formatPercent(
              summary
                .expectancyPercent,
            )}
          </strong>
        </div>
      </div>

      <div className="analytics-primary-grid">
        <article className="analytics-card">
          <span>
            Average winner
          </span>

          <strong className="positive">
            {formatMoney(
              summary
                .averageWinningTrade,
            )}
          </strong>

          <small>
            Average profit from winning exits
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Average loser
          </span>

          <strong className="negative">
            {formatMoney(
              summary
                .averageLosingTrade,
            )}
          </strong>

          <small>
            Average loss from losing exits
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Avg P/L / closed trade
          </span>

          <strong
            className={getClass(
              summary
                .averageProfitPerClosedTrade,
            )}
          >
            {formatMoney(
              summary
                .averageProfitPerClosedTrade,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Win / loss ratio
          </span>

          <strong>
            {summary
              .averageWinLossRatio ===
            null
              ? "∞"
              : formatNumber(
                  summary
                    .averageWinLossRatio,
                )}
          </strong>

          <small>
            Average winner ÷ average loser
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Largest winner
          </span>

          <strong className="positive">
            {formatMoney(
              summary
                .largestWinningTrade,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Largest loss
          </span>

          <strong className="negative">
            {formatMoney(
              summary
                .largestLosingTrade,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Maximum losing streak
          </span>

          <strong
            className={
              Number(
                summary
                  .maximumConsecutiveLosses,
              ) > 0
                ? "negative"
                : "neutral"
            }
          >
            {summary
              .maximumConsecutiveLosses ??
              0}
          </strong>

          <small>
            Most consecutive losing trades
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Current losing streak
          </span>

          <strong
            className={
              Number(
                summary
                  .currentConsecutiveLosses,
              ) > 0
                ? "negative"
                : "neutral"
            }
          >
            {summary
              .currentConsecutiveLosses ??
              0}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Winning probability
          </span>

          <strong className="positive">
            {formatProbability(
              summary
                .winProbability,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Losing probability
          </span>

          <strong className="negative">
            {formatProbability(
              summary
                .lossProbability,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Break-even trades
          </span>

          <strong>
            {summary
              .breakEvenTrades ??
              0}
          </strong>
        </article>
      </div>

      {/* ===================================================
          TRADING COSTS
          =================================================== */}

      <div className="portfolio-section-heading">
        <div>
          <h3>
            Trading costs
          </h3>

          <small>
            Costs that reduce strategy profitability
          </small>
        </div>
      </div>

      <div className="analytics-primary-grid">
        <article className="analytics-card">
          <span>
            Total fees
          </span>

          <strong className="negative">
            {formatMoney(
              summary
                .totalFees,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Estimated slippage
          </span>

          <strong className="negative">
            {formatMoney(
              summary
                .estimatedSlippage,
            )}
          </strong>

          <small>
            {summary
              .slippageBps ??
              0}{" "}
            bps assumption
          </small>
        </article>

        <article className="analytics-card">
          <span>
            Total trading costs
          </span>

          <strong className="negative">
            {formatMoney(
              summary
                .totalTradingCosts,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Avg cost / order
          </span>

          <strong>
            {formatMoney(
              summary
                .averageTradingCostPerOrder,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Avg fee / order
          </span>

          <strong>
            {formatMoney(
              summary
                .averageFeePerOrder,
            )}
          </strong>
        </article>

        <article className="analytics-card">
          <span>
            Avg slippage / order
          </span>

          <strong>
            {formatMoney(
              summary
                .averageSlippagePerOrder,
            )}
          </strong>
        </article>
      </div>

      {/* ===================================================
          EQUITY TRACKING
          =================================================== */}

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

      {/* ===================================================
          PERFORMANCE BREAKDOWNS
          =================================================== */}

      <div className="performance-groups">
        <PerformanceTable
          title="Performance by coin"
          rows={
            summary
              .bySymbol ||
            []
          }
        />

        <PerformanceTable
          title="Performance by timeframe"
          rows={
            summary
              .byTimeframe ||
            []
          }
        />

        {/* ===============================================
            ROADMAP #8 — STRATEGY INTELLIGENCE
            =============================================== */}

        <PerformanceTable
          title="Performance by strategy"
          rows={
            summary
              .byStrategy ||
            []
          }
        />

        <PerformanceTable
          title="Performance by signal label"
          rows={
            summary
              .bySignalLabel ||
            []
          }
        />

        <PerformanceTable
          title="Performance by confidence"
          rows={
            summary
              .byConfidenceBucket ||
            []
          }
        />

        <PerformanceTable
          title="Performance by score"
          rows={
            summary
              .byScoreBucket ||
            []
          }
        />

        <PerformanceTable
          title="Performance by exit type"
          rows={
            summary
              .byExitType ||
            []
          }
        />
      </div>

      <div className="performance-note">
        <span>
          Strategy breakdown scope
        </span>

        <strong>
          {summary
            .strategyBreakdownScope ||
            "CLOSED_TRADE_EXIT_METADATA"}
        </strong>

        <small>
          Strategy tables use metadata attached to closed SELL executions. Older trades may appear as Unknown if they were created before metadata persistence was enabled.
        </small>
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