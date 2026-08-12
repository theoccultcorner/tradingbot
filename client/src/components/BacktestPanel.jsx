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

function formatPlainPercent(
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
    2,
  );
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
    mode,
    setMode,
  ] =
    useState(
      "standard",
    );

  const [
    settings,
    setSettings,
  ] =
    useState({
      startingCash:
        300,

      buyAmount:
        40,

      minimumScore:
        40,

      minimumConfidence:
        60,

      stopLossPercent:
        1.5,

      takeProfitPercent:
        3,

      feePercent:
        0.1,

      limit:
        1000,

      walkForwardLimit:
        3000,

      trainingWindow:
        500,

      testingWindow:
        150,

      stepSize:
        150,

      minimumHistory:
        210,
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

  function changeMode(
    nextMode,
  ) {
    if (
      loading
    ) {
      return;
    }

    setMode(
      nextMode,
    );

    setResult(
      null,
    );

    setError(
      "",
    );
  }

  async function parseResponse(
    response,
  ) {
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
      !response.ok ||
      data.success ===
        false
    ) {
      throw new Error(
        data.message ||
          `The backtest failed with status ${response.status}.`,
      );
    }

    return (
      data.result ||
      data.data ||
      data
    );
  }

  async function runBacktest() {
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

                minimumScore:
                  Number(
                    settings.minimumScore,
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

                minimumHistory:
                  Number(
                    settings.minimumHistory,
                  ),

                feeRate:
                  Number(
                    settings.feePercent,
                  ) /
                  100,
              }),
          },
        );

      const nextResult =
        await parseResponse(
          response,
        );

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
          serverUrl(
            "/api/backtest/walk-forward",
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
                    settings.walkForwardLimit,
                  ),

                startingCash:
                  Number(
                    settings.startingCash,
                  ),

                buyAmount:
                  Number(
                    settings.buyAmount,
                  ),

                minimumScore:
                  Number(
                    settings.minimumScore,
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

                minimumHistory:
                  Number(
                    settings.minimumHistory,
                  ),

                trainingWindow:
                  Number(
                    settings.trainingWindow,
                  ),

                testingWindow:
                  Number(
                    settings.testingWindow,
                  ),

                stepSize:
                  Number(
                    settings.stepSize,
                  ),

                feeRate:
                  Number(
                    settings.feePercent,
                  ) /
                  100,
              }),
          },
        );

      const nextResult =
        await parseResponse(
          response,
        );

      setResult(
        nextResult,
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.message ||
          "The walk-forward test failed.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  const isWalkForward =
    mode ===
    "walk-forward";

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

      {/* ===================================================
          MODE SELECTOR
          =================================================== */}

      <div
        style={{
          display:
            "flex",

          gap:
            "10px",

          marginBottom:
            "20px",

          flexWrap:
            "wrap",
        }}
      >
        <button
          type="button"
          className={
            mode ===
            "standard"
              ? "run-backtest-button"
              : ""
          }
          disabled={
            loading
          }
          onClick={() =>
            changeMode(
              "standard",
            )
          }
        >
          Standard Backtest
        </button>

        <button
          type="button"
          className={
            mode ===
            "walk-forward"
              ? "run-backtest-button"
              : ""
          }
          disabled={
            loading
          }
          onClick={() =>
            changeMode(
              "walk-forward",
            )
          }
        >
          Walk-Forward Test
        </button>
      </div>

      {isWalkForward && (
        <p className="backtest-description">
          Walk-forward testing optimizes settings on historical training windows and evaluates them only on the unseen test windows that follow.
        </p>
      )}

      {/* ===================================================
          COMMON SETTINGS
          =================================================== */}

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
            Min score
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
            min="0.1"
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
            min="0.1"
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
            Indicator history
          </span>

          <input
            type="number"
            min="20"
            step="10"
            value={
              settings.minimumHistory
            }
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumHistory",
                event.target.value,
              )
            }
          />
        </label>

        {!isWalkForward && (
          <label>
            <span>
              Candles
            </span>

            <input
              type="number"
              min="250"
              max="5000"
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
        )}
      </div>

      {/* ===================================================
          WALK-FORWARD SETTINGS
          =================================================== */}

      {isWalkForward && (
        <>
          <div
            className="panel-heading"
            style={{
              marginTop:
                "24px",
            }}
          >
            <div>
              <span className="eyebrow">
                OUT-OF-SAMPLE VALIDATION
              </span>

              <h3>
                Walk-Forward Windows
              </h3>
            </div>
          </div>

          <div className="backtest-settings">
            <label>
              <span>
                Historical candles
              </span>

              <input
                type="number"
                min="500"
                max="5000"
                step="100"
                value={
                  settings.walkForwardLimit
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "walkForwardLimit",
                    event.target.value,
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
                max="4000"
                step="50"
                value={
                  settings.trainingWindow
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "trainingWindow",
                    event.target.value,
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
                max="2000"
                step="10"
                value={
                  settings.testingWindow
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "testingWindow",
                    event.target.value,
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
                max="2000"
                step="10"
                value={
                  settings.stepSize
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "stepSize",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        </>
      )}

      {/* ===================================================
          RUN BUTTON
          =================================================== */}

      <button
        type="button"
        className="run-backtest-button"
        disabled={
          loading
        }
        onClick={
          isWalkForward
            ? runWalkForwardTest
            : runBacktest
        }
      >
        {loading
          ? isWalkForward
            ? "Running walk-forward test…"
            : "Running server backtest…"
          : isWalkForward
            ? "Run and Save Walk-Forward Test"
            : "Run and Save Backtest"}
      </button>

      {error && (
        <p className="backtest-error">
          {error}
        </p>
      )}

      {/* ===================================================
          STANDARD BACKTEST RESULT
          =================================================== */}

      {result &&
        !isWalkForward && (
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
                  {formatPlainPercent(
                    result.winRate,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Profit factor
                </span>

                <strong>
                  {formatProfitFactor(
                    result.profitFactor,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Max drawdown
                </span>

                <strong className="negative">
                  {formatPlainPercent(
                    result.maximumDrawdownPercent,
                  )}
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

      {/* ===================================================
          WALK-FORWARD RESULT
          =================================================== */}

      {result &&
        isWalkForward && (
          <>
            <div
              className="panel-heading"
              style={{
                marginTop:
                  "28px",
              }}
            >
              <div>
                <span className="eyebrow">
                  OUT-OF-SAMPLE RESULTS
                </span>

                <h3>
                  Walk-Forward Performance
                </h3>
              </div>
            </div>

            <div className="backtest-summary">
              <article>
                <span>
                  Ending equity
                </span>

                <strong
                  className={
                    getClass(
                      result.totalProfit,
                    )
                  }
                >
                  {formatMoney(
                    result.endingEquity,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  OOS profit
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
                  OOS return
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
                  Profit factor
                </span>

                <strong>
                  {formatProfitFactor(
                    result.profitFactor,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  OOS expectancy
                </span>

                <strong
                  className={
                    getClass(
                      result.outOfSampleExpectancy,
                    )
                  }
                >
                  {formatMoney(
                    result.outOfSampleExpectancy,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Win rate
                </span>

                <strong>
                  {formatPlainPercent(
                    result.winRate,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Max drawdown
                </span>

                <strong className="negative">
                  {formatPlainPercent(
                    result.maximumDrawdownPercent,
                  )}
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
                  Windows
                </span>

                <strong>
                  {Number(
                    result.windowCount ||
                      0,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Profitable windows
                </span>

                <strong
                  className={
                    getClass(
                      Number(
                        result.profitableWindows,
                      ) -
                        Number(
                          result.losingWindows,
                        ),
                    )
                  }
                >
                  {Number(
                    result.profitableWindows ||
                      0,
                  )}
                  {" / "}
                  {Number(
                    result.windowCount ||
                      0,
                  )}
                </strong>

                <small>
                  {formatPlainPercent(
                    result.profitableWindowRate,
                  )}
                </small>
              </article>

              <article>
                <span>
                  Avg train return
                </span>

                <strong
                  className={
                    getClass(
                      result.averageTrainingReturnPercent,
                    )
                  }
                >
                  {formatPercent(
                    result.averageTrainingReturnPercent,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Avg test return
                </span>

                <strong
                  className={
                    getClass(
                      result.averageTestingReturnPercent,
                    )
                  }
                >
                  {formatPercent(
                    result.averageTestingReturnPercent,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Train → test degradation
                </span>

                <strong
                  className={
                    Number(
                      result.averageReturnDegradationPercent,
                    ) >
                    0
                      ? "negative"
                      : "positive"
                  }
                >
                  {formatPlainPercent(
                    result.averageReturnDegradationPercent,
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

            {/* ===============================================
                WALK-FORWARD WINDOW TABLE
                =============================================== */}

            <div
              style={{
                marginTop:
                  "28px",

                overflowX:
                  "auto",
              }}
            >
              <h3>
                Test Windows
              </h3>

              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",

                  marginTop:
                    "12px",
                }}
              >
                <thead>
                  <tr>
                    <th>
                      Window
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
                          {Number(
                            window.index,
                          ) +
                            1}
                        </td>

                        <td
                          className={
                            getClass(
                              window
                                .training
                                ?.totalReturnPercent,
                            )
                          }
                        >
                          {formatPercent(
                            window
                              .training
                              ?.totalReturnPercent,
                          )}
                        </td>

                        <td
                          className={
                            getClass(
                              window
                                .testing
                                ?.totalReturnPercent,
                            )
                          }
                        >
                          {formatPercent(
                            window
                              .testing
                              ?.totalReturnPercent,
                          )}
                        </td>

                        <td
                          className={
                            getClass(
                              window
                                .testing
                                ?.totalProfit,
                            )
                          }
                        >
                          {formatMoney(
                            window
                              .testing
                              ?.totalProfit,
                          )}
                        </td>

                        <td>
                          {Number(
                            window
                              .testing
                              ?.closedTradeCount ||
                              0,
                          )}
                        </td>

                        <td>
                          {formatPlainPercent(
                            window
                              .testing
                              ?.winRate,
                          )}
                        </td>

                        <td>
                          {formatProfitFactor(
                            window
                              .testing
                              ?.profitFactor,
                          )}
                        </td>

                        <td>
                          {window
                            .selectedSettings
                            ?.minimumScore ??
                            "—"}
                        </td>

                        <td>
                          {window
                            .selectedSettings
                            ?.minimumConfidence ??
                            "—"}
                        </td>

                        <td>
                          {window
                            .selectedSettings
                            ?.stopLossPercent ??
                            "—"}
                          %
                        </td>

                        <td>
                          {window
                            .selectedSettings
                            ?.takeProfitPercent ??
                            "—"}
                          %
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <p className="backtest-description">
              {result.id ? (
                <>
                  Saved as walk-forward test{" "}

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

              historical candles across{" "}

              {Number(
                result.windowCount ||
                  0,
              )}{" "}

              rolling out-of-sample windows.
            </p>

            <details
              style={{
                marginTop:
                  "20px",
              }}
            >
              <summary>
                Raw Walk-Forward JSON
              </summary>

              <pre
                style={{
                  marginTop:
                    "12px",

                  whiteSpace:
                    "pre-wrap",

                  overflowX:
                    "auto",

                  fontSize:
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

export default BacktestPanel;