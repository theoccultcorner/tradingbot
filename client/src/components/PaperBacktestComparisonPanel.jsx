import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
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
  {
    signed = false,
    decimals = 2,
  } = {},
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  const prefix =
    signed && number > 0
      ? "+"
      : "";

  return `${prefix}${number.toFixed(decimals)}%`;
}

function formatNumber(
  value,
  decimals = 2,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(decimals);
}

function formatProfitFactor(value) {
  if (value === null) {
    return "∞";
  }

  return formatNumber(
    value,
    2,
  );
}

function formatStatus(value) {
  return String(
    value || "UNKNOWN",
  )
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function toneFromNumber(value) {
  const number = Number(value);

  if (number > 0) {
    return "positive";
  }

  if (number < 0) {
    return "negative";
  }

  return "neutral";
}

function statusTone(status) {
  switch (status) {
    case "GOOD_MATCH":
      return "positive";

    case "MODERATE_DRIFT":
      return "neutral";

    case "POOR_MATCH":
      return "negative";

    case "INSUFFICIENT_SAMPLE":
      return "warning";

    case "NO_MATCHING_TEST":
    case "INSUFFICIENT_DATA":
      return "neutral";

    default:
      return "neutral";
  }
}

function MetricCard({
  label,
  value,
  detail = "",
  tone = "neutral",
}) {
  return (
    <article className="comparison-metric-card">
      <span className="comparison-metric-label">
        {label}
      </span>

      <strong
        className={`comparison-metric-value ${tone}`}
      >
        {value}
      </strong>

      {detail ? (
        <small className="comparison-metric-detail">
          {detail}
        </small>
      ) : null}
    </article>
  );
}

function ComparisonRow({
  label,
  paper,
  standard,
  walkForward,
  formatter = formatNumber,
  paperTone = "neutral",
  standardTone = "neutral",
  walkForwardTone = "neutral",
}) {
  return (
    <div className="comparison-table-row">
      <div className="comparison-table-label">
        {label}
      </div>

      <div
        className={`comparison-table-value ${paperTone}`}
      >
        {formatter(paper)}
      </div>

      <div
        className={`comparison-table-value ${standardTone}`}
      >
        {standard === undefined ||
        standard === null
          ? "—"
          : formatter(standard)}
      </div>

      <div
        className={`comparison-table-value ${walkForwardTone}`}
      >
        {walkForward === undefined ||
        walkForward === null
          ? "—"
          : formatter(walkForward)}
      </div>
    </div>
  );
}

function PaperBacktestComparisonPanel({
  symbol = "SOLUSD",
  timeframe = "1m",
}) {
  const [
    report,
    setReport,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadReport =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const query =
            new URLSearchParams({
              symbol,
              timeframe,
            });

          const response =
            await fetch(
              serverUrl(
                `/api/comparison?${query}`,
              ),
              {
                method: "GET",
                cache: "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const text =
            await response.text();

          let data = {};

          try {
            data = text
              ? JSON.parse(text)
              : {};
          } catch {
            throw new Error(
              "The comparison server returned invalid JSON.",
            );
          }

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Comparison request failed with status ${response.status}.`,
            );
          }

          setReport(
            data.report || null,
          );
        } catch (requestError) {
          setReport(null);

          setError(
            requestError.message ||
              "Could not load paper-vs-backtest comparison.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        symbol,
        timeframe,
      ],
    );

  useEffect(
    () => {
      loadReport();
    },
    [
      loadReport,
    ],
  );

  const standard =
    report?.standard;

  const walkForward =
    report?.walkForward;

  const paper =
    standard?.paper ||
    walkForward?.paper ||
    null;

  const standardResult =
    standard?.backtest ||
    null;

  const walkForwardResult =
    walkForward?.walkForward ||
    null;

  const combinedTone =
    statusTone(
      report?.combinedStatus,
    );

  const sampleProgress =
    paper
      ? Math.min(
          (
            Number(
              paper.closedTrades,
            ) /
            Number(
              report
                ?.minimumRecommendedClosedTrades ||
                20,
            )
          ) * 100,
          100,
        )
      : 0;

  return (
    <div className="view-stack paper-backtest-comparison-page">
      <section className="panel comparison-hero">
        <div className="panel-header comparison-hero-header">
          <div>
            <p className="panel-eyebrow">
              STRATEGY VALIDATION
            </p>

            <h2>
              Paper vs Backtest
            </h2>

            <p className="comparison-description">
              Compare live paper-trading behavior against your saved standard and walk-forward test results.
            </p>
          </div>

          <div className="comparison-market-badge">
            {symbol.replace(
              "USD",
              "/USD",
            )}
            {" · "}
            {timeframe}
          </div>
        </div>

        {loading ? (
          <div className="comparison-loading">
            Loading comparison…
          </div>
        ) : null}

        {error ? (
          <div className="error-banner">
            {error}
          </div>
        ) : null}

        {!loading &&
        !error &&
        report ? (
          <>
            <div className="comparison-summary-grid">
              <MetricCard
                label="Overall Status"
                value={
                  formatStatus(
                    report.combinedStatus,
                  )
                }
                tone={
                  combinedTone
                }
                detail={
                  report.statisticallyMeaningful
                    ? "Enough closed trades for evaluation"
                    : "Still gathering enough trades"
                }
              />

              <MetricCard
                label="Similarity Score"
                value={
                  report.combinedMatchScore ===
                  null
                    ? "—"
                    : `${formatNumber(
                        report.combinedMatchScore,
                        2,
                      )}%`
                }
                tone={
                  combinedTone
                }
                detail="Similarity only — not profitability"
              />

              <MetricCard
                label="Paper Trades"
                value={
                  paper?.closedTrades ??
                  0
                }
                tone={
                  paper?.sampleAdequate
                    ? "positive"
                    : "warning"
                }
                detail={`Target: ${
                  report.minimumRecommendedClosedTrades ||
                  20
                } closed trades`}
              />

              <MetricCard
                label="Available Comparisons"
                value={
                  report.availableComparisonCount ??
                  0
                }
                detail="Standard + walk-forward"
              />
            </div>

            {!report.statisticallyMeaningful ? (
              <div className="comparison-warning-banner">
                <div>
                  <strong>
                    Insufficient sample
                  </strong>

                  <span>
                    You currently have{" "}
                    {paper?.closedTrades ?? 0}{" "}
                    closed paper trades. At least{" "}
                    {report.minimumRecommendedClosedTrades ||
                      20}{" "}
                    closed trades are recommended before treating the comparison as statistically meaningful.
                  </span>
                </div>

                <div className="comparison-progress">
                  <div className="comparison-progress-track">
                    <div
                      className="comparison-progress-fill"
                      style={{
                        width:
                          `${sampleProgress}%`,
                      }}
                    />
                  </div>

                  <small>
                    {formatNumber(
                      sampleProgress,
                      0,
                    )}
                    % of minimum sample
                  </small>
                </div>
              </div>
            ) : null}

            <div className="comparison-section">
              <div className="comparison-section-header">
                <div>
                  <p className="panel-eyebrow">
                    PERFORMANCE
                  </p>

                  <h3>
                    Side-by-Side Results
                  </h3>
                </div>

                <button
                  type="button"
                  className="comparison-refresh-button"
                  onClick={
                    loadReport
                  }
                  disabled={
                    loading
                  }
                >
                  Refresh
                </button>
              </div>

              <div className="comparison-table">
                <div className="comparison-table-header">
                  <div>
                    Metric
                  </div>

                  <div>
                    Paper
                  </div>

                  <div>
                    Standard
                  </div>

                  <div>
                    Walk-Forward
                  </div>
                </div>

                <ComparisonRow
                  label="Return"
                  paper={
                    paper?.returnPercent
                  }
                  standard={
                    standardResult
                      ?.returnPercent
                  }
                  walkForward={
                    walkForwardResult
                      ?.returnPercent
                  }
                  formatter={(
                    value,
                  ) =>
                    formatPercent(
                      value,
                      {
                        signed: true,
                      },
                    )
                  }
                  paperTone={
                    toneFromNumber(
                      paper?.returnPercent,
                    )
                  }
                  standardTone={
                    toneFromNumber(
                      standardResult
                        ?.returnPercent,
                    )
                  }
                  walkForwardTone={
                    toneFromNumber(
                      walkForwardResult
                        ?.returnPercent,
                    )
                  }
                />

                <ComparisonRow
                  label="Profit"
                  paper={
                    paper?.profit
                  }
                  standard={
                    standardResult
                      ?.profit
                  }
                  walkForward={
                    walkForwardResult
                      ?.profit
                  }
                  formatter={
                    formatMoney
                  }
                  paperTone={
                    toneFromNumber(
                      paper?.profit,
                    )
                  }
                  standardTone={
                    toneFromNumber(
                      standardResult
                        ?.profit,
                    )
                  }
                  walkForwardTone={
                    toneFromNumber(
                      walkForwardResult
                        ?.profit,
                    )
                  }
                />

                <ComparisonRow
                  label="Win Rate"
                  paper={
                    paper?.winRate
                  }
                  standard={
                    standardResult
                      ?.winRate
                  }
                  walkForward={
                    walkForwardResult
                      ?.winRate
                  }
                  formatter={(
                    value,
                  ) =>
                    formatPercent(
                      value,
                    )
                  }
                />

                <ComparisonRow
                  label="Profit Factor"
                  paper={
                    paper?.profitFactor
                  }
                  standard={
                    standardResult
                      ?.profitFactor
                  }
                  walkForward={
                    walkForwardResult
                      ?.profitFactor
                  }
                  formatter={
                    formatProfitFactor
                  }
                />

                <ComparisonRow
                  label="Expectancy / Trade"
                  paper={
                    paper?.expectancy
                  }
                  standard={
                    standardResult
                      ?.expectancy
                  }
                  walkForward={
                    walkForwardResult
                      ?.expectancy
                  }
                  formatter={
                    formatMoney
                  }
                  paperTone={
                    toneFromNumber(
                      paper?.expectancy,
                    )
                  }
                  standardTone={
                    toneFromNumber(
                      standardResult
                        ?.expectancy,
                    )
                  }
                  walkForwardTone={
                    toneFromNumber(
                      walkForwardResult
                        ?.expectancy,
                    )
                  }
                />

                <ComparisonRow
                  label="Max Drawdown"
                  paper={
                    paper
                      ?.maximumDrawdownPercent
                  }
                  standard={
                    standardResult
                      ?.maximumDrawdownPercent
                  }
                  walkForward={
                    walkForwardResult
                      ?.maximumDrawdownPercent
                  }
                  formatter={(
                    value,
                  ) =>
                    formatPercent(
                      value,
                    )
                  }
                />

                <ComparisonRow
                  label="Closed Trades"
                  paper={
                    paper?.closedTrades
                  }
                  standard={
                    standardResult
                      ?.closedTrades
                  }
                  walkForward={
                    walkForwardResult
                      ?.closedTrades
                  }
                  formatter={(
                    value,
                  ) =>
                    Number(
                      value || 0,
                    ).toLocaleString()
                  }
                />

                <ComparisonRow
                  label="Trading Costs"
                  paper={
                    paper
                      ?.totalTradingCosts
                  }
                  standard={
                    standardResult
                      ?.totalTradingCosts
                  }
                  walkForward={
                    walkForwardResult
                      ?.totalTradingCosts
                  }
                  formatter={
                    formatMoney
                  }
                />
              </div>
            </div>

            <div className="comparison-two-column">
              <section className="panel comparison-subpanel">
                <div className="panel-header">
                  <div>
                    <p className="panel-eyebrow">
                      STANDARD BACKTEST
                    </p>

                    <h3>
                      Match Analysis
                    </h3>
                  </div>

                  <span
                    className={`comparison-status-pill ${statusTone(
                      standard?.status,
                    )}`}
                  >
                    {formatStatus(
                      standard?.status,
                    )}
                  </span>
                </div>

                {standard?.success ? (
                  <>
                    <div className="comparison-score-line">
                      <span>
                        Similarity
                      </span>

                      <strong>
                        {formatNumber(
                          standard.matchScore,
                          2,
                        )}
                        %
                      </strong>
                    </div>

                    <div className="comparison-detail-list">
                      <div>
                        <span>
                          Backtest Trades
                        </span>

                        <strong>
                          {standardResult
                            ?.closedTrades ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Candle Count
                        </span>

                        <strong>
                          {standardResult
                            ?.candleCount ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Return Gap
                        </span>

                        <strong>
                          {formatPercent(
                            standard
                              ?.difference
                              ?.returnPercent
                              ?.absoluteGap,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Win Rate Gap
                        </span>

                        <strong>
                          {formatPercent(
                            standard
                              ?.difference
                              ?.winRate
                              ?.absoluteGap,
                          )}
                        </strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="comparison-empty">
                    No exact standard backtest exists for this symbol and timeframe.
                  </p>
                )}
              </section>

              <section className="panel comparison-subpanel">
                <div className="panel-header">
                  <div>
                    <p className="panel-eyebrow">
                      WALK-FORWARD
                    </p>

                    <h3>
                      Match Analysis
                    </h3>
                  </div>

                  <span
                    className={`comparison-status-pill ${statusTone(
                      walkForward?.status,
                    )}`}
                  >
                    {formatStatus(
                      walkForward?.status,
                    )}
                  </span>
                </div>

                {walkForward?.success ? (
                  <>
                    <div className="comparison-score-line">
                      <span>
                        Similarity
                      </span>

                      <strong>
                        {formatNumber(
                          walkForward.matchScore,
                          2,
                        )}
                        %
                      </strong>
                    </div>

                    <div className="comparison-detail-list">
                      <div>
                        <span>
                          OOS Trades
                        </span>

                        <strong>
                          {walkForwardResult
                            ?.closedTrades ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Windows
                        </span>

                        <strong>
                          {walkForwardResult
                            ?.windowCount ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Profitable Windows
                        </span>

                        <strong>
                          {walkForwardResult
                            ?.profitableWindows ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Profitable Window Rate
                        </span>

                        <strong>
                          {formatPercent(
                            walkForwardResult
                              ?.profitableWindowRate,
                          )}
                        </strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="comparison-empty">
                    No exact walk-forward test exists for this symbol and timeframe.
                  </p>
                )}
              </section>
            </div>

            {Array.isArray(
              report.warnings,
            ) &&
            report.warnings.length >
              0 ? (
              <section className="panel comparison-notes">
                <div className="panel-header">
                  <div>
                    <p className="panel-eyebrow">
                      NOTES
                    </p>

                    <h3>
                      Comparison Warnings
                    </h3>
                  </div>
                </div>

                <ul>
                  {report.warnings.map(
                    (
                      warning,
                      index,
                    ) => (
                      <li
                        key={`${warning}-${index}`}
                      >
                        {warning}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

export default PaperBacktestComparisonPanel;