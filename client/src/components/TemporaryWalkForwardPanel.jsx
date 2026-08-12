import {
  useState,
} from "react";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://tradingbot-wgxa.onrender.com";

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

  return `${number.toFixed(
    2,
  )}%`;
}

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

function TemporaryWalkForwardPanel() {
  const [
    settings,
    setSettings,
  ] =
    useState({
      symbol:
        "SOLUSD",

      timeframe:
        "15m",

      limit:
        3000,

      startingCash:
        300,

      buyAmount:
        40,

      feeRate:
        0.001,

      minimumScore:
        40,

      minimumConfidence:
        60,

      stopLossPercent:
        1.5,

      takeProfitPercent:
        3,

      trainingWindow:
        500,

      testingWindow:
        150,

      stepSize:
        150,
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
    key,
    value,
  ) {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        [key]:
          value,
      }),
    );
  }

  async function runWalkForwardTest() {
    setLoading(
      true,
    );

    setError(
      "",
    );

    setResult(
      null,
    );

    try {
      const response =
        await fetch(
          `${API_BASE}/api/backtest/walk-forward`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                settings,
              ),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Walk-forward test failed.",
        );
      }

      setResult(
        data.result,
      );
    } catch (
      runError
    ) {
      setError(
        runError.message ||
          "Could not run walk-forward test.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            ROADMAP #8
          </p>

          <h2>
            Temporary Walk-Forward Tester
          </h2>

          <small>
            Training windows are optimized first, then evaluated on unseen test windows.
          </small>
        </div>
      </div>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",

          gap:
            "12px",

          marginBottom:
            "20px",
        }}
      >
        <label>
          <span>
            Symbol
          </span>

          <input
            type="text"
            value={
              settings.symbol
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "symbol",
                event.target
                  .value
                  .toUpperCase(),
              )
            }
          />
        </label>

        <label>
          <span>
            Timeframe
          </span>

          <select
            value={
              settings.timeframe
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "timeframe",
                event.target
                  .value,
              )
            }
          >
            <option value="1m">
              1m
            </option>

            <option value="3m">
              3m
            </option>

            <option value="5m">
              5m
            </option>

            <option value="15m">
              15m
            </option>

            <option value="30m">
              30m
            </option>

            <option value="1h">
              1h
            </option>

            <option value="4h">
              4h
            </option>

            <option value="1d">
              1d
            </option>
          </select>
        </label>

        <label>
          <span>
            Candle limit
          </span>

          <input
            type="number"
            min="500"
            max="5000"
            step="100"
            value={
              settings.limit
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "limit",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Starting cash
          </span>

          <input
            type="number"
            min="1"
            step="10"
            value={
              settings
                .startingCash
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "startingCash",
                Number(
                  event.target
                    .value,
                ),
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
            step="5"
            value={
              settings.buyAmount
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "buyAmount",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Fee rate
          </span>

          <input
            type="number"
            min="0"
            step="0.0001"
            value={
              settings.feeRate
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "feeRate",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Minimum score
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={
              settings.minimumScore
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumScore",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Minimum confidence
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={
              settings
                .minimumConfidence
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumConfidence",
                Number(
                  event.target
                    .value,
                ),
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
            min="0.1"
            step="0.1"
            value={
              settings
                .stopLossPercent
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "stopLossPercent",
                Number(
                  event.target
                    .value,
                ),
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
            min="0.1"
            step="0.1"
            value={
              settings
                .takeProfitPercent
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "takeProfitPercent",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Training window
          </span>

          <input
            type="number"
            min="250"
            step="50"
            value={
              settings
                .trainingWindow
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "trainingWindow",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Testing window
          </span>

          <input
            type="number"
            min="10"
            step="10"
            value={
              settings
                .testingWindow
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "testingWindow",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <label>
          <span>
            Step size
          </span>

          <input
            type="number"
            min="1"
            step="10"
            value={
              settings.stepSize
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "stepSize",
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>
      </div>

      <button
        type="button"
        onClick={
          runWalkForwardTest
        }
        disabled={
          loading
        }
      >
        {loading
          ? "Running Walk-Forward Test…"
          : "Run Walk-Forward Test"}
      </button>

      {error && (
        <p
          className="scanner-error"
          style={{
            marginTop:
              "16px",
          }}
        >
          {error}
        </p>
      )}

      {result && (
        <>
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",

              gap:
                "12px",

              marginTop:
                "24px",
            }}
          >
            <article className="analytics-card">
              <span>
                Windows
              </span>

              <strong>
                {
                  result.windowCount
                }
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Profitable windows
              </span>

              <strong>
                {
                  result
                    .profitableWindows
                }
              </strong>

              <small>
                {formatPercent(
                  result
                    .profitableWindowRate,
                )}
              </small>
            </article>

            <article className="analytics-card">
              <span>
                OOS profit
              </span>

              <strong>
                {formatMoney(
                  result.totalProfit,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                OOS return
              </span>

              <strong>
                {formatPercent(
                  result
                    .totalReturnPercent,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Profit factor
              </span>

              <strong>
                {result
                  .profitFactor ===
                null
                  ? "∞"
                  : formatNumber(
                      result
                        .profitFactor,
                    )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                OOS expectancy
              </span>

              <strong>
                {formatMoney(
                  result
                    .outOfSampleExpectancy,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Win rate
              </span>

              <strong>
                {formatPercent(
                  result.winRate,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Closed trades
              </span>

              <strong>
                {
                  result
                    .closedTradeCount
                }
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Max drawdown
              </span>

              <strong>
                {formatPercent(
                  result
                    .maximumDrawdownPercent,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Avg training return
              </span>

              <strong>
                {formatPercent(
                  result
                    .averageTrainingReturnPercent,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Avg testing return
              </span>

              <strong>
                {formatPercent(
                  result
                    .averageTestingReturnPercent,
                )}
              </strong>
            </article>

            <article className="analytics-card">
              <span>
                Train → test degradation
              </span>

              <strong>
                {formatPercent(
                  result
                    .averageReturnDegradationPercent,
                )}
              </strong>
            </article>
          </div>

          <div
            style={{
              marginTop:
                "24px",
            }}
          >
            <h3>
              Walk-Forward Windows
            </h3>

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th>
                      #
                    </th>

                    <th>
                      Train Return
                    </th>

                    <th>
                      Test Return
                    </th>

                    <th>
                      Test P/L
                    </th>

                    <th>
                      Trades
                    </th>

                    <th>
                      Win Rate
                    </th>

                    <th>
                      PF
                    </th>

                    <th>
                      Score
                    </th>

                    <th>
                      Confidence
                    </th>

                    <th>
                      Stop
                    </th>

                    <th>
                      Take
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(result.windows ||
                    []).map(
                    (
                      window,
                    ) => (
                      <tr
                        key={
                          window.index
                        }
                      >
                        <td>
                          {window.index +
                            1}
                        </td>

                        <td>
                          {formatPercent(
                            window
                              .training
                              .totalReturnPercent,
                          )}
                        </td>

                        <td>
                          {formatPercent(
                            window
                              .testing
                              .totalReturnPercent,
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            window
                              .testing
                              .totalProfit,
                          )}
                        </td>

                        <td>
                          {
                            window
                              .testing
                              .closedTradeCount
                          }
                        </td>

                        <td>
                          {formatPercent(
                            window
                              .testing
                              .winRate,
                          )}
                        </td>

                        <td>
                          {window
                            .testing
                            .profitFactor ===
                          null
                            ? "∞"
                            : formatNumber(
                                window
                                  .testing
                                  .profitFactor,
                              )}
                        </td>

                        <td>
                          {
                            window
                              .selectedSettings
                              .minimumScore
                          }
                        </td>

                        <td>
                          {
                            window
                              .selectedSettings
                              .minimumConfidence
                          }
                        </td>

                        <td>
                          {
                            window
                              .selectedSettings
                              .stopLossPercent
                          }
                          %
                        </td>

                        <td>
                          {
                            window
                              .selectedSettings
                              .takeProfitPercent
                          }
                          %
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <details
            style={{
              marginTop:
                "24px",
            }}
          >
            <summary>
              Raw JSON
            </summary>

            <pre
              style={{
                whiteSpace:
                  "pre-wrap",

                overflowX:
                  "auto",

                marginTop:
                  "12px",
              }}
            >
              {JSON.stringify(
                result,
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}

export default TemporaryWalkForwardPanel;