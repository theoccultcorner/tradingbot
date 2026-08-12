import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

function formatNumber(
  value,
  decimals = 2,
) {
  const number =
    Number(
      value,
    );

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

function formatPercent(
  value,
  {
    signed = false,
    decimals = 2,
  } = {},
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  const prefix =
    signed &&
    number >
      0
      ? "+"
      : "";

  return `${prefix}${number.toFixed(
    decimals,
  )}%`;
}

function formatMoney(
  value,
) {
  const number =
    Number(
      value,
    );

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

function formatStatus(
  value,
) {
  return String(
    value ||
      "UNKNOWN",
  )
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}

function scoreTone(
  score,
) {
  const value =
    Number(
      score,
    );

  if (
    value >=
    80
  ) {
    return "positive";
  }

  if (
    value >=
    65
  ) {
    return "warning";
  }

  return "negative";
}

function statusTone(
  status,
) {
  switch (
    status
  ) {
    case "READY_FOR_TINY_LIVE":
      return "positive";

    case "CAUTION":
      return "warning";

    case "NEEDS_MORE_DATA":
      return "warning";

    case "NOT_READY":
      return "negative";

    default:
      return "neutral";
  }
}

function CategoryCard({
  category,
}) {
  if (
    !category
  ) {
    return null;
  }

  return (
    <article className="readiness-category-card">
      <div className="readiness-category-top">
        <div>
          <span className="readiness-category-name">
            {
              category.name
            }
          </span>

          <strong
            className={
              category.passed
                ? "positive"
                : "neutral"
            }
          >
            {formatNumber(
              category.score,
              2,
            )}
            {" / "}
            {formatNumber(
              category.maximumScore,
              0,
            )}
          </strong>
        </div>

        <span
          className={
            category.passed
              ? "readiness-pass-pill positive"
              : "readiness-pass-pill warning"
          }
        >
          {category.passed
            ? "PASS"
            : "WAIT"}
        </span>
      </div>

      <div className="readiness-category-progress">
        <div
          className="readiness-category-progress-fill"
          style={{
            width:
              `${
                Math.min(
                  (
                    Number(
                      category.score,
                    ) /
                    Math.max(
                      Number(
                        category.maximumScore,
                      ),
                      1,
                    )
                  ) *
                    100,
                  100,
                )
              }%`,
          }}
        />
      </div>

      <p>
        {
          category.message
        }
      </p>
    </article>
  );
}

function GoLiveReadinessPanel({
  symbol =
    "SOLUSD",

  timeframe =
    "1m",
}) {
  const [
    report,
    setReport,
  ] =
    useState(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const loadReport =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError(
          "",
        );

        try {
          const query =
            new URLSearchParams({
              symbol,

              timeframe,
            });

          const response =
            await fetch(
              serverUrl(
                `/api/readiness?${query}`,
              ),
              {
                method:
                  "GET",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const text =
            await response.text();

          let data =
            {};

          try {
            data =
              text
                ? JSON.parse(
                    text,
                  )
                : {};
          } catch {
            throw new Error(
              "The readiness server returned invalid JSON.",
            );
          }

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                `Readiness request failed with status ${response.status}.`,
            );
          }

          setReport(
            data.report ||
              null,
          );
        } catch (
          requestError
        ) {
          setReport(
            null,
          );

          setError(
            requestError.message ||
              "Could not load go-live readiness.",
          );
        } finally {
          setLoading(
            false,
          );
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

  const categories =
    report
      ?.categories ||
    {};

  const blockers =
    Array.isArray(
      report
        ?.safetyBlockers,
    )
      ? report
          .safetyBlockers
      : [];

  const dataGaps =
    Array.isArray(
      report
        ?.dataGaps,
    )
      ? report
          .dataGaps
      : [];

  const evidence =
    report
      ?.evidence ||
    {};

  const validation =
    report
      ?.validation ||
    {};

  const readinessScore =
    Number(
      report
        ?.readinessScore,
    ) ||
    0;

  return (
    <div className="view-stack go-live-readiness-page">
      <section className="panel readiness-hero">
        <div className="panel-header readiness-hero-header">
          <div>
            <p className="panel-eyebrow">
              LIVE TRADING GATE
            </p>

            <h2>
              Go-Live Readiness
            </h2>

            <p className="readiness-description">
              This page evaluates whether the bot has enough evidence, consistency, and risk control to be considered for a tiny real-money trial.
            </p>
          </div>

          <div className="readiness-market-badge">
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
            Loading readiness report…
          </div>
        ) : null}

        {error ? (
          <div className="error-banner">
            {
              error
            }
          </div>
        ) : null}

        {!loading &&
        !error &&
        report ? (
          <>
            <div className="readiness-overview-grid">
              <article className="readiness-score-card">
                <span>
                  Readiness Score
                </span>

                <strong
                  className={
                    scoreTone(
                      readinessScore,
                    )
                  }
                >
                  {formatNumber(
                    readinessScore,
                    2,
                  )}
                </strong>

                <small>
                  out of 100
                </small>

                <div className="readiness-score-track">
                  <div
                    className="readiness-score-fill"
                    style={{
                      width:
                        `${Math.min(
                          readinessScore,
                          100,
                        )}%`,
                    }}
                  />
                </div>
              </article>

              <article className="readiness-status-card">
                <span>
                  Current Status
                </span>

                <strong
                  className={
                    statusTone(
                      report.status,
                    )
                  }
                >
                  {
                    report.statusLabel ||
                    formatStatus(
                      report.status,
                    )
                  }
                </strong>

                <small>
                  {
                    report.readyForTinyLive
                      ? "Eligible for tiny-live review"
                      : "Real-money trading is not approved"
                  }
                </small>
              </article>

              <article className="readiness-status-card">
                <span>
                  Closed Paper Trades
                </span>

                <strong>
                  {
                    evidence.closedTrades ??
                    0
                  }
                </strong>

                <small>
                  Minimum:{" "}
                  {report
                    ?.thresholds
                    ?.minimumClosedTrades ??
                    20}
                </small>
              </article>

              <article className="readiness-status-card">
                <span>
                  Validation Match
                </span>

                <strong>
                  {validation
                    .combinedMatchScore ===
                  null ||
                  validation
                    .combinedMatchScore ===
                    undefined
                    ? "—"
                    : `${formatNumber(
                        validation
                          .combinedMatchScore,
                        2,
                      )}%`}
                </strong>

                <small>
                  {
                    validation
                      .statisticallyMeaningful
                      ? "Statistically meaningful"
                      : "Still gathering evidence"
                  }
                </small>
              </article>
            </div>

            <div className="readiness-section-header">
              <div>
                <p className="panel-eyebrow">
                  SCORE BREAKDOWN
                </p>

                <h3>
                  Readiness Categories
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

            <div className="readiness-category-grid">
              <CategoryCard
                category={
                  categories
                    .profitability
                }
              />

              <CategoryCard
                category={
                  categories
                    .expectancy
                }
              />

              <CategoryCard
                category={
                  categories
                    .profitFactor
                }
              />

              <CategoryCard
                category={
                  categories
                    .risk
                }
              />

              <CategoryCard
                category={
                  categories
                    .validation
                }
              />

              <CategoryCard
                category={
                  categories
                    .sample
                }
              />

              <CategoryCard
                category={
                  categories
                    .recentConsistency
                }
              />
            </div>

            <div className="readiness-two-column">
              <section className="panel readiness-subpanel">
                <div className="panel-header">
                  <div>
                    <p className="panel-eyebrow">
                      HARD BLOCKERS
                    </p>

                    <h3>
                      Must Be Fixed
                    </h3>
                  </div>

                  <span
                    className={
                      blockers.length >
                      0
                        ? "readiness-count-pill negative"
                        : "readiness-count-pill positive"
                    }
                  >
                    {
                      blockers.length
                    }
                  </span>
                </div>

                {blockers.length >
                0 ? (
                  <div className="readiness-issue-list">
                    {blockers.map(
                      (
                        blocker,
                      ) => (
                        <article
                          className="readiness-issue-card blocker"
                          key={
                            blocker.code
                          }
                        >
                          <strong>
                            {formatStatus(
                              blocker.code,
                            )}
                          </strong>

                          <p>
                            {
                              blocker.message
                            }
                          </p>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="comparison-empty">
                    No hard safety blockers are currently active.
                  </p>
                )}
              </section>

              <section className="panel readiness-subpanel">
                <div className="panel-header">
                  <div>
                    <p className="panel-eyebrow">
                      DATA GAPS
                    </p>

                    <h3>
                      More Evidence Needed
                    </h3>
                  </div>

                  <span className="readiness-count-pill warning">
                    {
                      dataGaps.length
                    }
                  </span>
                </div>

                {dataGaps.length >
                0 ? (
                  <div className="readiness-issue-list">
                    {dataGaps.map(
                      (
                        gap,
                      ) => (
                        <article
                          className="readiness-issue-card gap"
                          key={
                            gap.code
                          }
                        >
                          <strong>
                            {formatStatus(
                              gap.code,
                            )}
                          </strong>

                          <p>
                            {
                              gap.message
                            }
                          </p>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="comparison-empty">
                    No missing evidence requirements remain.
                  </p>
                )}
              </section>
            </div>

            <section className="panel readiness-subpanel">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">
                    LIVE EVIDENCE
                  </p>

                  <h3>
                    Current Paper Performance
                  </h3>
                </div>
              </div>

              <div className="readiness-evidence-grid">
                <div>
                  <span>
                    Net Profit After Costs
                  </span>

                  <strong
                    className={
                      Number(
                        evidence
                          .netProfitAfterCosts,
                      ) >
                      0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {formatMoney(
                      evidence
                        .netProfitAfterCosts,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Net Return
                  </span>

                  <strong
                    className={
                      Number(
                        evidence
                          .netReturnAfterCostsPercent,
                      ) >
                      0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {formatPercent(
                      evidence
                        .netReturnAfterCostsPercent,
                      {
                        signed:
                          true,
                      },
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Expectancy / Trade
                  </span>

                  <strong
                    className={
                      Number(
                        evidence
                          .expectancyPerTrade,
                      ) >
                      0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {formatMoney(
                      evidence
                        .expectancyPerTrade,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Profit Factor
                  </span>

                  <strong>
                    {evidence
                      .profitFactor ===
                    null
                      ? "∞"
                      : formatNumber(
                          evidence
                            .profitFactor,
                          2,
                        )}
                  </strong>
                </div>

                <div>
                  <span>
                    Win Rate
                  </span>

                  <strong>
                    {formatPercent(
                      evidence
                        .winRate,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Maximum Drawdown
                  </span>

                  <strong>
                    {formatPercent(
                      evidence
                        .maximumDrawdownPercent,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Total Trading Costs
                  </span>

                  <strong>
                    {formatMoney(
                      evidence
                        .totalTradingCosts,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Estimated Slippage
                  </span>

                  <strong>
                    {formatMoney(
                      evidence
                        .estimatedSlippage,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="panel readiness-subpanel">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">
                    VALIDATION
                  </p>

                  <h3>
                    Historical Agreement
                  </h3>
                </div>
              </div>

              <div className="readiness-validation-grid">
                <article>
                  <span>
                    Standard Backtest
                  </span>

                  <strong>
                    {validation
                      ?.standard
                      ?.available
                      ? `${formatNumber(
                          validation
                            .standard
                            .matchScore,
                          2,
                        )}%`
                      : "Unavailable"}
                  </strong>

                  <small>
                    {validation
                      ?.standard
                      ?.available
                      ? `${validation.standard.closedTrades ?? 0} closed trades`
                      : "No exact match"}
                  </small>
                </article>

                <article>
                  <span>
                    Walk-Forward
                  </span>

                  <strong>
                    {validation
                      ?.walkForward
                      ?.available
                      ? `${formatNumber(
                          validation
                            .walkForward
                            .matchScore,
                          2,
                        )}%`
                      : "Unavailable"}
                  </strong>

                  <small>
                    {validation
                      ?.walkForward
                      ?.available
                      ? `${validation.walkForward.closedTrades ?? 0} OOS trades`
                      : "No exact match"}
                  </small>
                </article>

                <article>
                  <span>
                    Walk-Forward Return
                  </span>

                  <strong
                    className={
                      Number(
                        validation
                          ?.walkForward
                          ?.returnPercent,
                      ) >
                      0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {formatPercent(
                      validation
                        ?.walkForward
                        ?.returnPercent,
                      {
                        signed:
                          true,
                      },
                    )}
                  </strong>

                  <small>
                    Out-of-sample result
                  </small>
                </article>

                <article>
                  <span>
                    Profitable Windows
                  </span>

                  <strong>
                    {formatPercent(
                      validation
                        ?.walkForward
                        ?.profitableWindowRate,
                    )}
                  </strong>

                  <small>
                    Walk-forward stability
                  </small>
                </article>
              </div>
            </section>

            <div className="readiness-disclaimer">
              This score measures readiness evidence only. It does not predict or guarantee future profitability.
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

export default GoLiveReadinessPanel;