import {
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

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

function formatPercent(
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

  return `${
    number >= 0
      ? "+"
      : ""
  }${number.toFixed(
    2,
  )}%`;
}

function getClass(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    number > 0
  ) {
    return "positive";
  }

  if (
    number < 0
  ) {
    return "negative";
  }

  return "neutral";
}

function BacktestPanel({
  symbol =
    "SOLUSD",

  timeframe =
    "15m",
}) {
  const [
    settings,
    setSettings,
  ] =
    useState({
      startingCash:
        300,

      buyAmount:
        50,

      minimumConfidence:
        60,

      stopLossPercent:
        2,

      takeProfitPercent:
        4,

      feePercent:
        0.1,

      limit:
        1000,
    });

  const [
    result,
    setResult,
  ] =
    useState(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  function updateSetting(
    name,
    value,
  ) {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        [name]:
          value,
      }),
    );
  }

  async function runBacktest() {
    setLoading(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          serverUrl(
            "/api/backtest/run",
          ),
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                symbol,

                timeframe,

                limit:
                  Number(
                    settings.limit,
                  ),

                startingCash:
                  Number(
                    settings.startingCash,
                  ),

                buyAmount:
                  Number(
                    settings.buyAmount,
                  ),

                minimumConfidence:
                  Number(
                    settings.minimumConfidence,
                  ),

                stopLossPercent:
                  Number(
                    settings.stopLossPercent,
                  ),

                takeProfitPercent:
                  Number(
                    settings.takeProfitPercent,
                  ),

                feeRate:
                  Number(
                    settings.feePercent,
                  ) /
                  100,
              }),
          },
        );

      const text =
        await response.text();

      let data =
        {};

      if (
        text
      ) {
        try {
          data =
            JSON.parse(
              text,
            );
        } catch {
          throw new Error(
            "The backtest server returned invalid JSON.",
          );
        }
      }

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            `The backtest failed with status ${response.status}.`,
        );
      }

      const nextResult =
        data.result ||
        data.data ||
        data;

      setResult(
        nextResult,
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.message ||
          "The backtest failed.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  return (
    <section className="panel-card backtest-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            SERVER-SIDE VALIDATION
          </span>

          <h2>
            Strategy 2.0 Backtester
          </h2>
        </div>

        <span className="backtest-market">
          {symbol.replace(
            "USD",
            "/USD",
          )}{" "}
          ·{" "}
          {timeframe}
        </span>
      </div>

      <div className="backtest-settings">
        <label>
          <span>
            Starting cash
          </span>

          <input
            type="number"
            min="1"
            step="1"
            value={
              settings.startingCash
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "startingCash",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Buy amount
          </span>

          <input
            type="number"
            min="1"
            step="1"
            value={
              settings.buyAmount
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "buyAmount",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Min confidence
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={
              settings.minimumConfidence
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumConfidence",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Stop loss %
          </span>

          <input
            type="number"
            min="0"
            step="0.1"
            value={
              settings.stopLossPercent
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "stopLossPercent",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Take profit %
          </span>

          <input
            type="number"
            min="0"
            step="0.1"
            value={
              settings.takeProfitPercent
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "takeProfitPercent",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Fee %
          </span>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              settings.feePercent
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "feePercent",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Candles
          </span>

          <input
            type="number"
            min="250"
            max="1000"
            step="50"
            value={
              settings.limit
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "limit",
                event.target.value,
              )
            }
          />
        </label>
      </div>

      <button
        type="button"
        className="run-backtest-button"
        disabled={
          loading
        }
        onClick={
          runBacktest
        }
      >
        {loading
          ? "Running server backtest…"
          : "Run and Save Backtest"}
      </button>

      {error && (
        <p className="backtest-error">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="backtest-summary">
            <article>
              <span>
                Ending equity
              </span>

              <strong>
                {formatMoney(
                  result.endingEquity,
                )}
              </strong>
            </article>

            <article>
              <span>
                Total profit
              </span>

              <strong
                className={
                  getClass(
                    result.totalProfit,
                  )
                }
              >
                {formatMoney(
                  result.totalProfit,
                )}
              </strong>
            </article>

            <article>
              <span>
                Total return
              </span>

              <strong
                className={
                  getClass(
                    result.totalReturnPercent,
                  )
                }
              >
                {formatPercent(
                  result.totalReturnPercent,
                )}
              </strong>
            </article>

            <article>
              <span>
                Win rate
              </span>

              <strong>
                {Number.isFinite(
                  Number(
                    result.winRate,
                  ),
                )
                  ? Number(
                      result.winRate,
                    ).toFixed(
                      2,
                    )
                  : "0.00"}
                %
              </strong>
            </article>

            <article>
              <span>
                Profit factor
              </span>

              <strong>
                {result.profitFactor ===
                null
                  ? "∞"
                  : Number.isFinite(
                        Number(
                          result.profitFactor,
                        ),
                      )
                    ? Number(
                        result.profitFactor,
                      ).toFixed(
                        2,
                      )
                    : "—"}
              </strong>
            </article>

            <article>
              <span>
                Max drawdown
              </span>

              <strong className="negative">
                {Number.isFinite(
                  Number(
                    result.maximumDrawdownPercent,
                  ),
                )
                  ? Number(
                      result.maximumDrawdownPercent,
                    ).toFixed(
                      2,
                    )
                  : "0.00"}
                %
              </strong>
            </article>

            <article>
              <span>
                Closed trades
              </span>

              <strong>
                {Number(
                  result.closedTradeCount ||
                    0,
                )}
              </strong>
            </article>

            <article>
              <span>
                Fees
              </span>

              <strong>
                {formatMoney(
                  result.totalFees,
                )}
              </strong>
            </article>
          </div>
<TemporaryWalkForwardPanel />
          <p className="backtest-description">
            {result.id ? (
              <>
                Saved as backtest{" "}

                <strong>
                  {result.id}
                </strong>

                .{" "}
              </>
            ) : null}

            Tested{" "}

            {Number(
              result.candleCount ||
                0,
            )}{" "}

            candles with Strategy Engine 2.0.
          </p>
        </>
      )}
    </section>
  );
}

export default BacktestPanel;